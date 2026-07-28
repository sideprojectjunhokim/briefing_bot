// 모듈 레지스트리 — briefing-job은 이 배열만 순회한다.
// 모듈 추가 = 파일 1개 + 여기 1줄. (03 문서)
import type { SourceModule } from "../types.ts";
import { technews } from "./technews.ts";
import { market } from "./market.ts";
import { hotdeal } from "./hotdeal.ts";
import { community } from "./community.ts";

// 4모듈 전부 등록(전체 틀). Phase 2는 technews만 소스 활성(enabled:true),
// 나머지는 소스 enabled:false라 수집 시 자동 스킵됨 → Phase 3에서 소스 fetch 채우고 켠다.
export const MODULES: SourceModule[] = [
  technews,
  market,
  hotdeal,
  community,
];

export function getModule(key: string): SourceModule | undefined {
  return MODULES.find((m) => m.key === key);
}
