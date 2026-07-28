import { notFound } from "next/navigation";
import { getArchiveView } from "@/lib/data";
import { metaOf } from "@/lib/modules";
import { ModuleArchive } from "@/components/folders/ModuleArchive";

// 읽음 표시가 여기서도 보이므로 캐시하지 않는다.
// (그래서 generateStaticParams도 없앴다 — force-dynamic과 같이 쓰면 의미가 없다)
export const dynamic = "force-dynamic";

/**
 * 라우트 파라미터는 **인코딩된 채로 온다.**
 *
 * 직접 추가한 관심사의 키에는 한글이 들어간다(`my-스팀게임`). 링크는
 * encodeURIComponent로 만드는데 Next가 그걸 풀어 주지 않아서, 서버가
 * `my-%EC%8A%A4...`를 그대로 받아 DB 키와 안 맞고 404가 났다. 영문 키는
 * 인코딩될 게 없어서 우연히 통과하고 있었다.
 *
 * 이미 풀린 값에 다시 걸어도 %가 없으니 그대로 돌아온다. 홀로 선 % 같은
 * 깨진 입력만 던지므로 그때는 원문을 쓴다.
 */
function decodeKey(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 관심사 하나의 지난 장들 */
export default async function ModulePage({ params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = decodeKey(raw);
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
