// M1. hotdeal — 핫딜/특가 (03 문서)
// render=llm. 소스: 뽐뿌 → 퀘이사존 → 루리웹핫딜 순차 추가.
// ※ 틀만: 소스 fetch는 Phase 3. 뽐뿌 RSS는 fetchRss로 거의 재사용 가능.
import type { RawItem, Source, SourceModule } from "../types.ts";

const ppomppu: Source = {
  key: "ppomppu",
  label: "뽐뿌",
  enabled: false, // TODO(Phase3): 뽐뿌 핫딜 RSS → fetchRss
  async fetch(): Promise<RawItem[]> {
    throw new Error("hotdeal/ppomppu 미구현");
  },
};

// TODO(Phase3): quasarzone, ruliweb_hotdeal 소스 추가

export const hotdeal: SourceModule = {
  key: "hotdeal",
  label: "🔥 핫딜",
  sources: [ppomppu],
  render: {
    mode: "llm",
    maxItems: 30,
    systemPrompt:
      "너는 핫딜 큐레이터다. 주어진 특가 아이템 중 쓸만한 것 5~8개만 골라라.\n\n" +
      "출력은 두 부분이다.\n" +
      "1) 먼저 **리드 문단** 2~4문장. 오늘 딜의 주인공이 무엇이고 왜 지금 값이 " +
      "움직였는지, 지금 사도 되는지 아니면 더 기다릴 만한지를 쓴다. 품목을 " +
      "다시 나열하지 마라. 불릿 없이 평문 한 문단. " +
      "이 문단이 없으면 이 브리핑은 링크 목록일 뿐이다.\n" +
      "2) 빈 줄 뒤에 '- [품목/가격](링크) — 한줄평' 마크다운 리스트.\n\n" +
      "광고성·종료된 딜·중복은 제외. 인사말·맺음말은 쓰지 마라.",
  },
};
