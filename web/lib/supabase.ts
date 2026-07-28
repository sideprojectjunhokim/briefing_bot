import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** env 미설정(Phase 0 전)이면 데모 데이터로 화면·애니메이션을 확인할 수 있다. */
export const hasSupabaseEnv = Boolean(url && anon);

// anon 키는 공개돼도 RLS(briefings 읽기 전용)로 안전.
export const supabase: SupabaseClient | null = hasSupabaseEnv
  ? createClient(url!, anon!, { auth: { persistSession: false } })
  : null;

export interface Briefing {
  id: number;
  module_key: string;
  item_count: number;
  content: string | null;
  status: "ok" | "failed" | "skipped_empty";
  error: string | null;
  created_at: string;
}
