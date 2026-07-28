// 홈·카테고리 페이지 공용 데이터 모듈 — 실데이터(Supabase)와 데모를 여기 한 곳에서 스왑.
import { supabase, type Briefing } from "./supabase";
import { DEMO_BRIEFINGS } from "./demo";

/** 모듈별 최신 브리핑 1행씩. Supabase env 미설정(Phase 0 전)이면 데모 데이터. */
export async function getLatestBriefings(): Promise<Briefing[]> {
  if (!supabase) return DEMO_BRIEFINGS;
  const { data, error } = await supabase.from("latest_briefings").select("*");
  if (error) {
    console.error("브리핑 조회 실패:", error.message);
    return [];
  }
  return (data ?? []) as Briefing[];
}
