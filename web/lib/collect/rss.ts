// 가벼운 RSS 파서. fast-xml-parser로 <item>/<entry> 추출.
import { XMLParser } from "fast-xml-parser";

export interface RssItem {
  title: string;
  link?: string;
  guid?: string;
  description?: string;
  pubDate?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

// 소스 하나가 안 붙어서 회차 전체가 늦어지면 안 된다. 시계가 매시라 여유가 없다.
const FETCH_TIMEOUT_MS = 12_000;

/** RSS URL을 fetch해서 item 배열로. 실패는 throw(소스별 try/catch가 잡는다). */
export async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { "user-agent": "briefing-bot/1.0 (+personal use)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RSS fetch ${res.status}: ${url}`);
  const xml = await res.text();
  const doc = parser.parse(xml);

  // rss>channel>item 또는 (Atom) feed>entry 둘 다 완만히 지원
  const channel = doc?.rss?.channel ?? doc?.feed;
  const rawItems = channel?.item ?? channel?.entry ?? [];
  const arr = Array.isArray(rawItems) ? rawItems : [rawItems];

  return arr.filter(Boolean).map((it: Record<string, unknown>) => ({
    title: asText(it.title),
    link: asText(it.link) || asHref(it.link),
    guid: asText(it.guid) || asText(it.id),
    // Atom은 description 대신 content를 쓴다(GeekNews가 그렇다)
    description: stripHtml(asText(it.description) || asText(it.summary) || asText(it.content)),
    pubDate: asText(it.pubDate) || asText(it.published) || asText(it.updated),
  }));
}

/**
 * 문자열이 아닌 값에서 텍스트를 꺼낸다.
 *
 * **객체는 빈 문자열로 돌려준다** — 예전엔 String(v)로 밀었는데, Atom의
 * `<link rel="alternate" href="…"/>`가 그대로 "[object Object]"가 돼서 링크가
 * 전부 깨졌다. 게다가 그 값이 truthy라 뒤따르는 asHref 폴백이 아예 안 돌았다.
 */
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && "#text" in (v as object)) {
    return String((v as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

/** 본문은 HTML로 온다. 태그째 넘기면 토큰만 먹고 모델에 도움이 안 된다. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Atom <link href="..."/> 형태 대응
function asHref(v: unknown): string {
  if (v && typeof v === "object" && "@_href" in (v as object)) {
    return String((v as Record<string, unknown>)["@_href"] ?? "");
  }
  return "";
}

/** guid/link를 안정적 external_id로 축약 (djb2) */
export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
