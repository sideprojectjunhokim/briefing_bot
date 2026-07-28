// Claude 요약 — 한 장당 1회 호출.
//
// 매시 도는 선별·리드는 전부 fast 티어(Haiku)다(06 문서 C-5). 시계가 매시라
// 호출 수가 하루 1회이던 때보다 늘었고 운영비가 하드 제약이라, 이 경로를
// 상위 모델로 올리지 않는다. deep 티어는 사람이 한 건을 파고들라고 시킬 때만
// 쓴다 — models.ts 참고.
import Anthropic from "@anthropic-ai/sdk";
import type { RawItem } from "./types";
import { MODELS, type ModelTier } from "./models";

// 리드 문단 + 항목 8줄이면 한국어로 넉넉히 들어간다. 잘리면 카드가 문장 중간에서
// 끝나 버리므로 조금 여유를 뒀다.
const MAX_TOKENS = 2000;

let client: Anthropic | null = null;

/**
 * 인증은 둘 중 하나다 — Anthropic API 키(`ANTHROPIC_API_KEY`)이거나,
 * 호환 엔드포인트의 베어러 토큰(`ANTHROPIC_AUTH_TOKEN`).
 *
 * **둘을 같이 보내면 안 된다.** SDK가 헤더 두 개를 다 실어 보내고 서버가
 * 거절한다. 그래서 키가 있으면 토큰 쪽을, 없으면 키 쪽을 명시적으로 죽인다.
 * 엔드포인트(`ANTHROPIC_BASE_URL`)는 SDK가 알아서 읽는다.
 */
function getClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim() || undefined;
  if (!apiKey && !authToken) {
    throw new Error("ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN이 필요합니다");
  }

  client = apiKey ? new Anthropic({ apiKey }) : new Anthropic({ apiKey: null, authToken });
  return client;
}

export interface Summary {
  /** 화면에 렌더할 본문. THREAD 줄은 떼어낸 뒤다 */
  content: string;
  threadOf: number | null;
  threadNote: string | null;
}

/** 골라낼 게 없다고 모델이 판단한 경우 */
export const SKIPPED: unique symbol = Symbol("skipped");

export async function summarize(
  items: RawItem[],
  systemPrompt: string,
  maxInput: number,
): Promise<Summary | typeof SKIPPED> {
  const clipped = items.slice(0, maxInput).map((it) => ({
    title: it.title,
    url: it.url,
    origin: it.origin,
    ...it.payload,
  }));

  const text = await ask(
    systemPrompt,
    "아래 JSON은 이번 회차에 새로 수집된 아이템이다. 지시대로 한국어 마크다운으로 써라.\n\n" +
      JSON.stringify(clipped, null, 2),
  );

  if (!text || /^SKIP\b/i.test(text)) return SKIPPED;
  return splitThread(text);
}

/**
 * 모델 호출은 여기 한 곳만 — 모델·토큰 상한을 두 군데서 관리하지 않으려고.
 *
 * **지시를 `system` 파라미터가 아니라 user 턴 맨 앞에 넣는다.** 원래는 system이
 * 맞는 자리인데, Anthropic 호환 엔드포인트 중에는 system을 자기 프롬프트로
 * 덮어쓰는 곳이 있다. 그런 데서는 우리 지시가 통째로 사라져서 모델이 제목만
 * 나열한다(실측: 07-28, 같은 입력으로 system은 무시·user 턴은 정상).
 *
 * 진짜 Anthropic API에서도 이 방식은 그대로 동작한다. 잃는 건 system 프롬프트
 * 캐싱뿐인데, 우리 지시는 800토큰 남짓이라 Haiku의 캐시 최소 길이(4096)에
 * 애초에 못 미친다. 그래서 한 경로로 통일했다.
 */
async function ask(instructions: string, user: string, tier: ModelTier = "fast"): Promise<string> {
  const msg = await getClient().messages.create({
    model: MODELS[tier],
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: `${instructions}\n\n---\n\n${user}` }],
  });
  // 실비용을 눈으로 보려고 남긴다. Vercel 로그와 Actions 로그에 그대로 찍힌다.
  console.log(
    `[llm] ${MODELS[tier]} in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}`,
  );
  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  return stripCodeFence(text);
}

/**
 * 본문 전체를 ```markdown 펜스로 감싸 오는 경우가 있다. 그대로 두면 화면에
 * 백틱 줄이 항목으로 잡혀서 첫 줄이 깨진다.
 */
function stripCodeFence(text: string): string {
  const m = text.match(/^```[a-z]*\n([\s\S]*?)\n?```$/i);
  return m ? m[1].trim() : text;
}

/**
 * 하루 끝 한 장 — 오늘 **읽은** 것들이 합쳐서 무슨 이야기였는지 한 문단.
 * 안 읽은 건 재료가 아니다. 읽지도 않은 걸 요약해 주면 그건 또 다른 밀린 숙제다.
 */
export async function summarizeDay(readContents: string[]): Promise<string | typeof SKIPPED> {
  if (readContents.length === 0) return SKIPPED;

  const text = await ask(
    [
      "너는 오늘 하루 이 사람이 읽은 것들을 한 문단으로 되짚어 주는 사람이다.",
      "",
      "평문 한 문단, 4~6문장. 불릿·소제목·목록을 쓰지 마라.",
      "오늘 읽은 것들을 다시 나열하지 마라 — 그건 이미 읽었다.",
      "관통하는 줄기가 있으면 그걸 말하고, 없으면 없다고 솔직히 써라.",
      "억지로 교훈을 만들지 마라. 인사말·맺음말도 쓰지 마라.",
    ].join("\n"),
    "오늘 읽은 것들:\n\n" + readContents.join("\n\n---\n\n"),
  );

  return text || SKIPPED;
}

/**
 * 첫 줄의 `THREAD: <id> | <한 문장>`을 떼어 구조로 옮긴다.
 *
 * 없으면 없는 것이다 — 이 장치는 억지로 만드는 순간 거짓말이 되므로,
 * 형식이 안 맞으면 조용히 무시하고 본문으로 돌린다.
 */
export function splitThread(text: string): Summary {
  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";
  const m = first.match(/^THREAD:\s*(\d+)\s*\|\s*(.+)$/i);
  if (!m) return { content: text, threadOf: null, threadNote: null };

  return {
    content: lines.slice(1).join("\n").trim(),
    threadOf: Number(m[1]),
    threadNote: m[2].trim(),
  };
}
