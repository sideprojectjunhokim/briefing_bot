// M3. technews — 개발/테크 뉴스 (03 문서)
// v1 소스: GeekNews RSS 1개. 이후 Hacker News 소스 추가 예정.
import type { RawItem, Source, SourceModule } from "../types.ts";
import { fetchRss } from "../rss.ts";

const geeknews: Source = {
  key: "geeknews",
  label: "GeekNews",
  enabled: true,
  async fetch(): Promise<RawItem[]> {
    const items = await fetchRss("https://news.hada.io/rss/news");
    return items.map((it) => ({
      externalId: `geeknews:${hash(it.guid || it.link || it.title)}`,
      url: it.link,
      title: it.title,
      origin: "geeknews",
      payload: { description: (it.description || "").slice(0, 500) },
    }));
  },
};

export const technews: SourceModule = {
  key: "technews",
  label: "👨‍💻 테크 뉴스",
  sources: [geeknews],
  render: {
    mode: "llm",
    maxItems: 30,
    systemPrompt:
      "너는 개발자를 위한 테크 뉴스 큐레이터다. 주어진 아이템 중 개발자 관심도 기준 " +
      "상위 5~8개만 골라라.\n\n" +
      "출력은 두 부분이다.\n" +
      "1) 먼저 **리드 문단** 2~4문장. 오늘 이 항목들이 합쳐서 무슨 이야기인지 쓴다. " +
      "제목을 다시 늘어놓지 말고, 무엇이 달라졌고 그래서 뭘 해야 하는지를 말해라. " +
      "불릿 없이 평문 한 문단. 이 문단이 없으면 이 브리핑은 링크 목록일 뿐이다.\n" +
      "2) 빈 줄 뒤에 '- [제목](링크) — 1~2문장 한국어 요약' 형식의 마크다운 리스트.\n\n" +
      "광고성·중복·저품질은 제외. 인사말·맺음말은 쓰지 마라.",
  },
};

/** guid/link를 안정적 external_id로 축약 (djb2). */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
