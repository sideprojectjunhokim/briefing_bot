// 모듈 레지스트리 — 수집기는 이 배열만 순회한다.
// 모듈 추가 = 파일 1개 + 여기 1줄 + prompt.ts의 LEAD_ASK 한 줄.
import type { SourceModule } from "../types";
import { technews } from "./technews";
import { market } from "./market";
import { hotdeal } from "./hotdeal";
import { community } from "./community";

export const MODULES: SourceModule[] = [technews, market, hotdeal, community];

export function getModule(key: string): SourceModule | undefined {
  return MODULES.find((m) => m.key === key);
}
