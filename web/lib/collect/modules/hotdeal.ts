// M1. hotdeal — 핫딜/특가. 소스는 뽐뿌 → 퀘이사존 → 루리웹핫딜 순으로 붙인다.
// ※ 아직 틀만: 소스 fetch 미구현이라 enabled:false로 자동 스킵된다.
import type { RawItem, Source, SourceModule } from "../types";
import { buildPrompt, LEAD_ASK } from "../prompt";

const ppomppu: Source = {
  key: "ppomppu",
  label: "뽐뿌",
  enabled: false, // TODO: 뽐뿌 핫딜 RSS → fetchRss로 거의 그대로 재사용 가능
  async fetch(): Promise<RawItem[]> {
    throw new Error("hotdeal/ppomppu 미구현");
  },
};

export const hotdeal: SourceModule = {
  key: "hotdeal",
  label: "핫딜",
  sources: [ppomppu],
  render: {
    mode: "llm",
    maxInput: 30,
    prompt: (ctx) =>
      buildPrompt(
        {
          role: "너는 핫딜 큐레이터다. 읽는 사람은 지금 살지 말지를 정하려고 이걸 연다.",
          leadAsk: LEAD_ASK.hotdeal,
          itemFormat: "- [품목 / 가격](#번호) — 한줄평",
          exclude: "광고성, 이미 종료된 딜, 같은 물건의 중복 게시",
        },
        ctx,
      ),
  },
};
