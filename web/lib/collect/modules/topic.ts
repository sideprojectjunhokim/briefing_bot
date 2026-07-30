// 검색으로 채우는 관심사. 프리셋에서 고른 것도, 직접 친 것도 여기로 온다.
import type { RawItem, Source, SourceModule } from "../types";
import { fetchRss, hash } from "../rss";
import { buildPrompt } from "../prompt";
import { clusterByTitle } from "../cluster";

export interface TopicRow {
  key: string;
  label: string;
  query: string;
  pick_max: number;
}

/**
 * Google 뉴스 RSS. 임의 키워드에 붙고, 키가 필요 없고, 돈이 안 든다.
 * 손으로 소스를 붙일 수 없는 관심사(사용자가 방금 친 단어)를 감당하는 유일한 방법이다.
 */
function newsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

export function topicModule(row: TopicRow): SourceModule {
  const source: Source = {
    key: "gnews",
    label: "Google 뉴스",
    enabled: true,
    async fetch(): Promise<RawItem[]> {
      const items = await fetchRss(newsUrl(row.query));

      // 검색 결과는 100건씩 온다. 전부 upsert하면 source_items만 불어나고
      // 어차피 선별에서 대부분 떨어진다.
      const flat = items.slice(0, 40).map((it) => ({
        externalId: `gnews:${hash(it.guid || it.link || it.title)}`,
        url: it.link,
        // Google 뉴스 제목은 "제목 - 매체명" 꼴이라 매체를 따로 떼어 둔다
        title: it.title.replace(/\s-\s[^-]+$/, "").trim() || it.title,
        publisher: (it.title.match(/\s-\s([^-]+)$/) ?? [])[1] ?? "",
        description: (it.description || "").slice(0, 300),
      }));

      // 같은 사건끼리 묶어 대표만 남긴다. coverage(몇 개 매체가 다뤘나)가
      // 이 소스에서 얻을 수 있는 유일한 중요도 신호다 — 조회수도 추천수도 안 온다.
      return clusterByTitle(flat, row.query.split(/\s+/)).map(({ item, coverage }) => ({
        externalId: item.externalId,
        url: item.url,
        title: item.title,
        origin: "gnews",
        payload: {
          publisher: item.publisher,
          description: item.description,
          coverage,
        },
      }));
    },
  };

  return {
    key: row.key,
    label: row.label,
    sources: [source],
    render: {
      mode: "llm",
      maxInput: 25,
      prompt: (ctx) =>
        buildPrompt(
          {
            role: `너는 "${row.label}"에 관심 있는 사람 한 명을 위한 큐레이터다. 그 사람은 일하는 중에 잠깐 쉬면서 이걸 읽는다.`,
            // 검색으로 긁어 온 것이라 태반이 재탕이거나 광고다. 그래서 이 질문이
            // "무슨 뉴스가 있나"가 아니라 "실제로 달라진 게 있나"여야 한다.
            leadAsk: `${row.label}에서 **실제로 달라진 게 있나.** 없으면 없다고 써라 — 검색 결과가 100건이어도 새 소식이 0건인 날이 대부분이다.`,
            itemFormat: "- [제목](#번호) — 2~3문장 한국어 요약",
            // 조회수·추천수를 주는 피드가 없어서 coverage가 유일한 중요도 신호다.
            // 이걸 안 알려 주면 모델은 시간순으로 온 40건을 동등하게 보고 고른다.
            extra:
              "각 아이템의 `coverage`는 **같은 사건을 다룬 매체 수**다. 이게 이 목록에서 유일한 중요도 신호이니 " +
              "우선순위로 삼아라 — 여러 매체가 동시에 쓴 건 실제로 일어난 일이고, coverage가 1인 건 대개 " +
              "홍보성이거나 키워드만 스친 기사다. 다만 숫자만 보고 줄 세우지는 마라. coverage가 낮아도 " +
              "이 사람에게 값어치가 분명하면 넣고, 높아도 알맹이가 없으면 빼라.\n" +
              "**coverage는 네가 고를 때만 쓰는 값이다. 본문에는 절대 쓰지 마라** — 숫자도, " +
              "'coverage'라는 말도, '여러 매체가 다뤘다' 같은 언급도. 읽는 사람에겐 아무 의미 없는 내부 값이다.\n" +
              "검색 결과에 영문 기사가 섞여 있으면 제목·스니펫을 읽고 한국어로 옮겨 요약해라.",
            exclude:
              "광고·협찬성 기사, 제목만 자극적이고 알맹이 없는 것, 키워드만 스친 무관한 기사",
          },
          ctx,
        ),
    },
  };
}
