// M2. market — 주식/코인 (03 문서)
// render=template (숫자 환각 리스크 0). 소스: Upbit(코인) + 지수(D-3 미정).
// ※ 틀만: 소스 fetch는 Phase 3에서 구현. enabled:false로 지금은 스킵됨.
import type { RawItem, Source, SourceModule } from "../types.ts";

const upbit: Source = {
  key: "upbit",
  label: "Upbit",
  enabled: false, // TODO(Phase3): GET /v1/ticker?markets=KRW-BTC,KRW-ETH
  async fetch(): Promise<RawItem[]> {
    // external_id는 'upbit:KRW-BTC:<날짜>' 로 하루 1스냅샷 (03 문서)
    throw new Error("market/upbit 미구현");
  },
};

const indexes: Source = {
  key: "indexes",
  label: "지수",
  enabled: false, // TODO(Phase3, D-3): Yahoo Finance chart API (^KS11 등)
  async fetch(): Promise<RawItem[]> {
    throw new Error("market/indexes 미구현");
  },
};

export const market: SourceModule = {
  key: "market",
  label: "📈 시세",
  sources: [upbit, indexes],
  render: {
    // 숫자는 LLM 없이 코드로 조립 — 환각 0, 비용 0
    mode: "template",
    format(items: RawItem[]): string {
      // TODO(Phase3): payload의 가격/등락률을 04 문서 포맷으로 조립
      return items.map((it) => `- ${it.title}`).join("\n");
    },
  },
};
