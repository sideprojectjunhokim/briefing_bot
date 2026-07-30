// M7. steamgame — 스팀. 뉴스 검색이 아니라 스토어 자체가 소스다.
//
// "스팀게임"을 뉴스로 검색하면 홍보 기사 몇 개가 전부다. 정작 알고 싶은 건
// 지금 뭐가 세일 중이고 뭐가 잘 나가는가인데, 그건 스팀 스토어 API가 키도
// 없이 그대로 준다. 뉴스는 구글 뉴스를 보조로 한 줄 얹는다.
import type { RawItem, Source, SourceModule } from "../types";
import { fetchRss, hash } from "../rss";
import { buildPrompt, LEAD_ASK } from "../prompt";
import { clusterByTitle } from "../cluster";

const STORE_API = "https://store.steampowered.com/api/featuredcategories?cc=KR&l=korean";

interface SteamItem {
  id: number;
  name: string;
  discounted: boolean;
  discount_percent: number;
  original_price: number | null;
  final_price: number | null;
  currency: string;
}

/**
 * 특가·최고 판매·신작 세 버킷을 한 소스로 합친다.
 *
 * external_id에 가격을 넣는 게 요점이다 — id만 쓰면 한 번 실린 게임은
 * 다음 세일 때 영영 안 나온다. 가격이 바뀌면 다른 아이템으로 취급한다.
 */
const store: Source = {
  key: "steamstore",
  label: "스팀 스토어",
  enabled: true,
  async fetch(): Promise<RawItem[]> {
    const res = await fetch(STORE_API, {
      headers: { "user-agent": "briefing-bot/1.0 (+personal use)" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`steam ${res.status}`);
    const json = (await res.json()) as Record<
      string,
      { id?: string; items?: SteamItem[] } | undefined
    >;

    const buckets: [string, string][] = [
      ["specials", "특가"],
      ["top_sellers", "최고 판매"],
      ["new_releases", "신작"],
    ];

    const out: RawItem[] = [];
    const seen = new Set<number>();
    for (const [key, label] of buckets) {
      for (const it of json[key]?.items ?? []) {
        if (!it?.id || !it.name || seen.has(it.id)) continue;
        seen.add(it.id);
        out.push({
          externalId: `steam:${it.id}:${it.final_price ?? 0}`,
          url: `https://store.steampowered.com/app/${it.id}`,
          title: it.name,
          origin: "steam",
          payload: {
            bucket: label,
            discountPercent: it.discount_percent,
            // 스팀 API의 가격은 KRW×100이다. 여기서 원으로 바꿔 둔다 —
            // 모델에게 나누기를 시키면 언젠가 66,000원이 6,600,000원이 된다.
            priceWon: it.final_price != null ? Math.round(it.final_price / 100) : null,
            originalWon: it.original_price != null ? Math.round(it.original_price / 100) : null,
          },
        });
      }
    }
    return out;
  },
};

/** 구글 뉴스 보조 — 대형 업데이트·출시 소식은 스토어 목록에 안 뜬다 */
const gnews: Source = {
  key: "gnews",
  label: "Google 뉴스",
  enabled: true,
  async fetch(): Promise<RawItem[]> {
    const q = "스팀 게임";
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
    const items = await fetchRss(url);
    const flat = items.slice(0, 30).map((it) => ({
      externalId: `gnews:${hash(it.guid || it.link || it.title)}`,
      url: it.link,
      title: it.title.replace(/\s-\s[^-]+$/, "").trim() || it.title,
      publisher: (it.title.match(/\s-\s([^-]+)$/) ?? [])[1] ?? "",
      description: (it.description || "").slice(0, 300),
    }));
    return clusterByTitle(flat, q.split(/\s+/)).map(({ item, coverage }) => ({
      externalId: item.externalId,
      url: item.url,
      title: item.title,
      origin: "gnews",
      payload: { publisher: item.publisher, description: item.description, coverage },
    }));
  },
};

export const steamgame: SourceModule = {
  key: "steamgame",
  label: "스팀 게임",
  sources: [store, gnews],
  render: {
    mode: "llm",
    maxInput: 35,
    prompt: (ctx) =>
      buildPrompt(
        {
          role: "너는 스팀 라이브러리에 게임이 수백 개인 사람을 위한 큐레이터다. 그 사람은 또 살 게임을 찾는 게 아니라 **살 값어치가 있는 것만** 알고 싶다.",
          leadAsk: LEAD_ASK.steamgame,
          itemFormat:
            "- [게임명](#번호) — 가격·할인이 있으면 `12,000원 (-70%)` 꼴로 먼저, 그다음 어떤 게임이고 왜 지금인지 1~2문장",
          exclude:
            "DLC 단품, 성인 노림수 게임, 할인율만 크고 원가가 뻥튀기인 것, 알맹이 없는 홍보 기사",
          extra:
            "`bucket`은 스토어의 어느 목록에서 왔는지다(특가/최고 판매/신작). `priceWon`은 원화 가격 그대로다 — 계산하지 말고 그대로 써라.\n" +
            "뉴스 아이템(gnews)의 `coverage`는 같은 소식을 다룬 매체 수다. 고를 때만 쓰고 본문에는 언급하지 마라.\n" +
            "스토어 아이템과 뉴스 아이템을 섞어 골라도 된다 — 세일 소식과 출시 소식이 같은 장에 있는 게 자연스럽다.",
        },
        ctx,
      ),
  },
};
