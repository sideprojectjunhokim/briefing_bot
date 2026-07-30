// wikidot 위키 헬퍼 — SCP·백룸 로어 모듈이 같이 쓴다.
//
// 이 위키들은 API가 없거나(백룸) 본문까지는 안 준다(Crom). 그래서 렌더된
// 페이지 HTML에서 #page-content만 잘라 텍스트로 만든다. 위키텍스트 원문보다
// 이쪽이 낫다 — [[include]] 모듈이 전개된 뒤라 사람이 읽는 그대로다.

const FETCH_TIMEOUT_MS = 12_000;
const UA = "briefing-bot/1.0 (+personal use)";

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fetch ${res.status}: ${url}`);
  return res.text();
}

/** #page-content부터 페이지 꼬리(태그·정보 블록)까지만 잘라낸다 */
function contentSlice(html: string): string {
  const start = html.indexOf('id="page-content"');
  if (start < 0) return "";
  const rest = html.slice(start);
  const end = rest.search(/class="page-tags"|id="page-info-break"|id="footer"/);
  return end > 0 ? rest.slice(0, end) : rest;
}

/** 본문 텍스트. 접힌 블록·각주까지 포함해 통짜로 편다 */
export function pageText(html: string): string {
  return contentSlice(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 페이지 제목(#page-title). 없으면 null — 호출자가 슬러그로 폴백한다 */
export function pageTitle(html: string): string | null {
  const m = html.match(/id="page-title"[^>]*>([\s\S]*?)<\/div>/);
  const title = m?.[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return title || null;
}

/**
 * 본문 첫 이미지. 위키 페이지의 이미지는 대부분 문서 상단의 "현장 사진"이라
 * 첫 장이 곧 표지다. 컴포넌트 장식·국기 아이콘·테마 이미지는 걸러낸다.
 */
export function pageImage(html: string): string | null {
  const imgs = contentSlice(html).match(/<img[^>]+src="([^"]+)"/g) ?? [];
  for (const tag of imgs) {
    const src = tag.match(/src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
    if (!src) continue;
    // 장식·아바타를 거른다. avatar.php는 상단 저자 정보 블록의 프로필 사진이다
    // (실측: SCP-984-KO 표지가 역자 아바타로 나왔다)
    if (/component|nav%3A|nav:|icon|flag|theme|black\.png|sandbox|avatar|karma|logo|ui\//i.test(src))
      continue;
    if (!/^https?:\/\//.test(src)) continue;
    return src;
  }
  return null;
}
