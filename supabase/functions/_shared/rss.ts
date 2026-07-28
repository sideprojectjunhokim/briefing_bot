// 가벼운 RSS 파서 (Edge 런타임). fast-xml-parser로 <item> 추출.
import { XMLParser } from "npm:fast-xml-parser@4.5.0";

export interface RssItem {
  title: string;
  link?: string;
  guid?: string;
  description?: string;
  pubDate?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

/** RSS URL을 fetch해서 item 배열로. 실패는 throw(소스별 try/catch가 잡는다). */
export async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { "user-agent": "briefing-bot/1.0 (+personal use)" },
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
    description: asText(it.description) || asText(it.summary),
    pubDate: asText(it.pubDate) || asText(it.published) || asText(it.updated),
  }));
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as object)) {
    return String((v as Record<string, unknown>)["#text"] ?? "");
  }
  return String(v);
}

// Atom <link href="..."/> 형태 대응
function asHref(v: unknown): string {
  if (v && typeof v === "object" && "@_href" in (v as object)) {
    return String((v as Record<string, unknown>)["@_href"] ?? "");
  }
  return "";
}
