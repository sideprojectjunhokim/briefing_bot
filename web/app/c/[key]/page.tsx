import { notFound } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase";
import { getLatestBriefings } from "@/lib/data";
import { metaOf, MODULE_ORDER } from "@/lib/modules";
import { FilePage } from "@/components/folders/FilePage";

// 최신 브리핑을 매 방문 반영 (짧은 ISR)
export const revalidate = 300;

export function generateStaticParams() {
  return MODULE_ORDER.map((m) => ({ key: m.key }));
}

/** 펼쳐진 파일 — 카테고리 하나의 오늘 브리핑 전체 */
export default async function CategoryPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const meta = metaOf(key);
  if (!meta) notFound();
  const briefings = await getLatestBriefings();
  return <FilePage briefings={briefings} meta={meta} demo={!hasSupabaseEnv} />;
}
