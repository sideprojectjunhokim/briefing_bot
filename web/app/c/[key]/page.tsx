import { notFound } from "next/navigation";
import { getArchiveView } from "@/lib/data";
import { metaOf } from "@/lib/modules";
import { ModuleArchive } from "@/components/folders/ModuleArchive";

// 읽음 표시가 여기서도 보이므로 캐시하지 않는다.
// (그래서 generateStaticParams도 없앴다 — force-dynamic과 같이 쓰면 의미가 없다)
export const dynamic = "force-dynamic";

/** 관심사 하나의 지난 장들 */
export default async function ModulePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { briefings, index, demo } = await getArchiveView(key);

  // 색인에 있거나 지난 장이 남아 있으면 연다. 코드에 박힌 4모듈만 통과시키던
  // 예전 검사로는 직접 추가한 관심사가 404가 난다.
  const entry = index.find((e) => e.key === key);
  if (!entry && briefings.length === 0) notFound();

  return (
    <ModuleArchive
      briefings={briefings}
      meta={metaOf(key, entry?.label)}
      index={index}
      demo={demo}
    />
  );
}
