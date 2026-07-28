// M2. market — 시세. 소스는 Upbit(코인) + 지수.
//
// **render는 template이다 — 숫자에 LLM을 대지 않는다.** 환각 0, 비용 0.
// 이 경계는 넘기지 마라.
//
// 그래서 이 모듈만 리드 문단이 없다. LEAD_ASK.market("왜 움직였나")을 쓰려면
// LLM이 필요한데, 그러면 같은 호출이 숫자도 만지게 된다. 실데이터를 며칠 본 뒤
// "숫자는 template, 리드만 별도 호출"로 나눌지 판단한다 — 지금은 안 만든다.
//
// ※ 아직 틀만: 소스 fetch 미구현이라 enabled:false로 자동 스킵된다.
import type { RawItem, Source, SourceModule } from "../types";

const upbit: Source = {
  key: "upbit",
  label: "Upbit",
  enabled: false, // TODO: GET /v1/ticker?markets=KRW-BTC,KRW-ETH
  async fetch(): Promise<RawItem[]> {
    // external_id는 'upbit:KRW-BTC:<날짜>' — 날짜를 넣어 하루 1스냅샷으로 묶는다
    throw new Error("market/upbit 미구현");
  },
};

const indexes: Source = {
  key: "indexes",
  label: "지수",
  enabled: false, // TODO(D-3): Yahoo Finance chart API (^KS11 등)
  async fetch(): Promise<RawItem[]> {
    throw new Error("market/indexes 미구현");
  },
};

export const market: SourceModule = {
  key: "market",
  label: "시세",
  sources: [upbit, indexes],
  render: {
    mode: "template",
    format(items: RawItem[]): string {
      // toMarketRows가 "값 (등락)" 꼴을 읽는다 — 형식을 바꾸면 화면도 같이 고쳐야 한다
      return items
        .map((it) => {
          const value = it.payload?.value ?? "";
          const delta = it.payload?.delta;
          return `- **${it.title}** ${value}${delta ? ` (${delta})` : ""}`;
        })
        .join("\n");
    },
  },
};
