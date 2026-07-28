import type { PromptContext, ReadRef } from "./types";

/**
 * 모듈별 리드 문단이 답해야 할 질문 — **한곳에 모아 둔 이유가 있다.**
 *
 * 넷이 같은 톤으로 끝나면 사흘 만에 안 읽는다. 그런데 이걸 모듈 파일에 흩어
 * 놓으면 하나씩 고칠 때마다 조금씩 닮아 가고, 다 닮은 뒤에도 아무도 눈치채지
 * 못한다(CAS에서 17장이 전부 같은 리듬으로 끝난 게 이 경로였다).
 * 그래서 나란히 둔다 — 고칠 때 옆칸이 같이 보이게.
 *
 * 새 모듈을 추가할 때 여기 한 줄을 쓰면서 "옆칸과 다른 질문인가"를 먼저 본다.
 */
export const LEAD_ASK = {
  hotdeal: "지금 사도 되는가. 값이 왜 움직였고, 이게 바닥인지 더 기다릴 만한지.",
  market: "왜 움직였나. 숫자를 다시 읽어 주지 말고, 방향이 같이 간 게 무슨 뜻인지.",
  technews: "내 코드가 어떻게 바뀌나. 새 소식 소개가 아니라 내일 뭘 해야 하는지.",
  community: "읽을 값어치가 있나. 무엇으로 시끄러운지, 그리고 솔직히 넘겨도 되는지.",
} as const;

/** 어느 모듈이든 공통인 뼈대. 모듈은 leadAsk와 항목 형식만 다르다. */
export interface LeadBrief {
  /** "너는 …다" 한 줄 */
  role: string;
  /** LEAD_ASK에서 가져온다 */
  leadAsk: string;
  /** 항목 한 줄의 형식 */
  itemFormat: string;
  /** 빼야 할 것 */
  exclude: string;
}

export function buildPrompt(brief: LeadBrief, ctx: PromptContext): string {
  const parts = [
    brief.role,
    "",
    `주어진 아이템 중 **최대 ${ctx.pickMax}개**만 골라라. ` +
      "고르는 게 네 일이다 — 12개 중 11개를 버리는 게 맞는 날이 대부분이다. " +
      "기준을 넘는 게 3개뿐이면 3개만 써라. 억지로 채우면 신뢰가 먼저 죽는다. " +
      "쓸 만한 게 하나도 없으면 첫 줄에 `SKIP` 한 단어만 쓰고 끝내라.",
    "",
    "출력은 두 부분이다.",
    "",
    "1) **리드 문단** 2~4문장, 불릿 없는 평문 한 문단.",
    `   이 문단이 답해야 하는 질문: ${brief.leadAsk}`,
    "   제목을 다시 나열하는 문장은 아무것도 안 한 것이다. 목록은 데이터고 이 문단이 상품이다.",
    "",
    `2) 빈 줄 뒤에 마크다운 리스트. 형식: ${brief.itemFormat}`,
    "",
    `제외: ${brief.exclude}`,
    "인사말·맺음말·\"오늘도 좋은 하루\" 류는 쓰지 마라.",
  ];

  const thread = threadingBlock(ctx.recentlyRead);
  if (thread) parts.push("", thread);

  return parts.join("\n");
}

/**
 * 이어 붙이기 지시. 사용자가 최근에 읽은 장의 제목을 보여 주고, 새 항목이
 * 그 후속이면 리드보다 먼저 한 줄로 연결하게 한다.
 *
 * 기계가 읽을 수 있게 `THREAD:` 첫 줄을 고정 형식으로 받는다 — 이 한 줄이
 * briefings.thread_of / thread_note가 된다. 없으면 그냥 없는 것이고,
 * 억지로 만들면 이 장치는 바로 거짓말이 된다.
 */
function threadingBlock(recentlyRead: ReadRef[]): string | null {
  if (recentlyRead.length === 0) return null;

  const digest = recentlyRead
    .map((r) => `  [${r.briefingId}] ${r.daysAgo}일 전: ${r.titles.slice(0, 6).join(" / ")}`)
    .join("\n");

  return [
    "아래는 사용자가 최근에 **읽은** 것들이다.",
    digest,
    "",
    "새 항목 중 위의 어느 것의 후속·반전·결말인 게 있으면, 리드 문단보다 먼저",
    "다음 형식의 줄을 하나만 써라(그다음 빈 줄, 그다음 리드):",
    "  THREAD: <대괄호 안의 번호> | 사용자에게 건네는 한 문장",
    '  예) THREAD: 812 | 사흘 전에 본 React 컴파일러 이야기, 오늘 후속이 나왔다.',
    "확실한 후속이 아니면 이 줄을 쓰지 마라. 주제가 비슷한 정도로는 안 된다.",
  ].join("\n");
}
