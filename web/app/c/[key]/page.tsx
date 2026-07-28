import { notFound } from "next/navigation";
import { getArchiveView } from "@/lib/data";
import { metaOf, isIndexedModule } from "@/lib/modules";
import { ModuleArchive } from "@/components/folders/ModuleArchive";

// 읽음 표시가 여기서도 보이므로 캐시하지 않는다.
// (그래서 generateStaticParams도 없앴다 — force-dynamic과 같이 쓰면 의미가 없다)
export const dynamic = "force-dynamic";

/** 모듈 하나의 지난 장들 */
export default async function ModulePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isIndexedModule(key)) notFound();
  const { briefings, unreadByModule, demo } = await getArchiveView(key);
  return (
    <ModuleArchive
      briefings={briefings}
      meta={metaOf(key)}
      unreadByModule={unreadByModule}
      demo={demo}
    />
  );
}
