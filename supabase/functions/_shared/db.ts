// Supabase service-role 클라이언트 (Edge Function 전용, RLS 우회)
import { createClient } from "jsr:@supabase/supabase-js@2";
import type { RawItem } from "./types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/**
 * 수집 아이템을 upsert하고 "이번에 처음 본" 신규 아이템만 반환한다.
 * (module_key, external_id) 충돌 = 이미 본 것 → 제외.
 * ignoreDuplicates + select 로 실제 insert된 행만 돌려받는다.
 */
export async function upsertAndGetNew(
  moduleKey: string,
  items: RawItem[],
): Promise<RawItem[]> {
  if (items.length === 0) return [];

  const rows = items.map((it) => ({
    module_key: moduleKey,
    external_id: it.externalId,
    url: it.url ?? null,
    title: it.title,
    payload: it.payload ?? {},
  }));

  const { data, error } = await supabase
    .from("source_items")
    .upsert(rows, {
      onConflict: "module_key,external_id",
      ignoreDuplicates: true, // 기존 행은 건드리지 않고, 신규만 반환
    })
    .select("external_id");

  if (error) throw new Error(`source_items upsert 실패: ${error.message}`);

  const newIds = new Set((data ?? []).map((r) => r.external_id));
  return items.filter((it) => newIds.has(it.externalId));
}

/** 오늘(KST 기준 자정 이후) 특정 모듈의 status='ok' 브리핑 개수 — 비용 가드용 */
export async function countTodayOk(moduleKey: string): Promise<number> {
  const since = kstMidnightUtcIso();
  const { count, error } = await supabase
    .from("briefings")
    .select("id", { count: "exact", head: true })
    .eq("module_key", moduleKey)
    .eq("status", "ok")
    .gte("created_at", since);
  if (error) throw new Error(`countTodayOk 실패: ${error.message}`);
  return count ?? 0;
}

export async function insertBriefing(row: {
  moduleKey: string;
  itemCount: number;
  content: string | null;
  status: "ok" | "failed" | "skipped_empty";
  error?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("briefings").insert({
    module_key: row.moduleKey,
    item_count: row.itemCount,
    content: row.content,
    status: row.status,
    error: row.error ?? null,
  });
  if (error) throw new Error(`briefings insert 실패: ${error.message}`);
}

/** KST 자정을 UTC ISO로. (KST = UTC+9) */
function kstMidnightUtcIso(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600_000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600_000).toISOString();
}
