import { hasSupabaseEnv } from "@/lib/supabase";
import { getLatestBriefings } from "@/lib/data";
import { FolderStack } from "@/components/folders/FolderStack";

// 최신 브리핑을 매 방문 반영 (짧은 ISR)
export const revalidate = 300;

export default async function Home() {
  const briefings = await getLatestBriefings();
  return <FolderStack briefings={briefings} demo={!hasSupabaseEnv} />;
}
