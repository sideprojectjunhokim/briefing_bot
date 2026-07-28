// M3. technews — 개발/테크 뉴스. v1 소스는 GeekNews RSS 하나.
import type { RawItem, Source, SourceModule } from "../types";
import { fetchRss, hash } from "../rss";
import { buildPrompt, LEAD_ASK } from "../prompt";

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
  label: "테크 뉴스",
  sources: [geeknews],
  render: {
    mode: "llm",
    maxInput: 30,
    prompt: (ctx) =>
      buildPrompt(
        {
          role: "너는 개발자 한 사람을 위한 테크 뉴스 큐레이터다. 그 사람은 일하는 중에 잠깐 쉬면서 이걸 읽는다.",
          leadAsk: LEAD_ASK.technews,
          itemFormat: "- [제목](#번호) — 2~3문장 한국어 요약",
          exclude: "제품 홍보성 글, 이미 한 번 지나간 이야기의 재탕, 제목만 자극적인 것",
        },
        ctx,
      ),
  },
};
