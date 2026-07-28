// M3. technews — 개발/테크 뉴스. GeekNews + Hacker News 두 소스.
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

/**
 * Hacker News. **여기만 진짜 인기 지표가 온다** — points와 댓글 수가 숫자로 있다.
 * 다른 소스는 조회수도 추천수도 안 줘서 중요도를 추정해야 하는데, 여기는 안 그렇다.
 *
 * 지난 24시간 중 30점을 넘긴 것만 본다. 매시 돌면서 같은 글을 다시 보게 되지만
 * 중복제거가 걸러 주고, 대신 **글이 올라온 시점이 아니라 인기를 얻은 시점에**
 * 큐로 들어온다. 갓 올라온 0점짜리를 집어 오는 것보다 이쪽이 맞다.
 */
const HN_WINDOW_HOURS = 24;
const HN_MIN_POINTS = 30;

const hackernews: Source = {
  key: "hackernews",
  label: "Hacker News",
  enabled: true,
  async fetch(): Promise<RawItem[]> {
    const since = Math.floor(Date.now() / 1000) - HN_WINDOW_HOURS * 3600;
    const url =
      `https://hn.algolia.com/api/v1/search?tags=story` +
      `&numericFilters=created_at_i>${since},points>${HN_MIN_POINTS}&hitsPerPage=40`;

    const res = await fetch(url, {
      headers: { "user-agent": "briefing-bot/1.0 (+personal use)" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HN fetch ${res.status}`);

    const json = (await res.json()) as {
      hits: {
        objectID: string;
        title: string;
        url: string | null;
        points: number;
        num_comments: number | null;
        story_text?: string | null;
      }[];
    };

    return json.hits.map((h) => ({
      externalId: `hn:${h.objectID}`,
      // Ask/Show HN은 외부 링크가 없다 — 그럴 땐 토론 페이지로 보낸다
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      title: h.title,
      origin: "hackernews",
      payload: {
        points: h.points,
        comments: h.num_comments ?? 0,
        description: (h.story_text ?? "").replace(/<[^>]+>/g, " ").slice(0, 400),
      },
    }));
  },
};

export const technews: SourceModule = {
  key: "technews",
  label: "테크 뉴스",
  sources: [geeknews, hackernews],
  render: {
    mode: "llm",
    // 소스가 둘이라 상한을 올렸다. 겹치는 게 많아 실제로 살아남는 건 훨씬 적다.
    maxInput: 45,
    prompt: (ctx) =>
      buildPrompt(
        {
          role: "너는 개발자 한 사람을 위한 테크 뉴스 큐레이터다. 그 사람은 일하는 중에 잠깐 쉬면서 이걸 읽는다.",
          leadAsk: LEAD_ASK.technews,
          itemFormat: "- [제목](#번호) — 2~3문장 한국어 요약",
          exclude: "제품 홍보성 글, 이미 한 번 지나간 이야기의 재탕, 제목만 자극적인 것",
          extra: [
            "아이템은 두 곳에서 왔다.",
            "- `origin: hackernews` — **`points`(추천)와 `comments`(댓글 수)가 실제 숫자로 있다.** " +
              "이 목록에서 가장 믿을 만한 중요도 신호이니 우선순위로 삼아라. 다만 숫자만 보고 줄 세우지는 " +
              "마라 — 점수가 높아도 이 사람과 무관하면 빼고, 낮아도 값어치가 분명하면 넣어라.",
            "- `origin: geeknews` — 점수가 없다. 제목과 본문만 보고 판단해라.",
            "",
            "**GeekNews는 Hacker News 글을 한국어로 옮겨 싣는 일이 잦다.** 같은 이야기가 양쪽에 있으면 " +
              "하나로 합쳐 한 번만 써라. 이때 링크는 한국어 쪽(geeknews)을 쓰고, 중요도 판단은 " +
              "Hacker News의 points를 쓴다.",
            "",
            "영문 제목은 한국어로 자연스럽게 옮겨 써라. 원문 표기를 괄호로 덧붙이지 마라 — 줄만 길어진다.",
            "**points·comments 숫자는 본문에 쓰지 마라.** 네가 고를 때만 쓰는 값이다.",
          ].join("\n"),
        },
        ctx,
      ),
  },
};
