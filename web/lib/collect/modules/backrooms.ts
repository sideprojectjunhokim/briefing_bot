// M6. backrooms — 백룸 아카이브 탐험. scp.ts와 같은 탐험형이다.
//
// 백룸에는 Crom 같은 색인 API가 없다. 대신 위키의 목록 페이지(레벨·엔티티)에서
// 문서 링크를 긁어 풀을 만든다. 한국어 위키(backrooms-wiki-ko)를 본진으로 쓰되,
// 번역이 스텁이면 영어 위키의 같은 문서로 폴백한다 — 파이프라인이 어차피
// 영어를 한국어로 옮겨 요약한다.
import type { RawItem, Source, SourceModule } from "../types";
import { fetchHtml, pageImage, pageText, pageTitle } from "../wikidot";
import { filterUnseen, upsertAndGetNew } from "../db";
import { LORE_QUEUE_CAP, lorePostProcess, lorePrompt } from "./lore";

const KO_BASE = "http://backrooms-wiki-ko.wikidot.com";
const EN_BASE = "http://backrooms-wiki.wikidot.com";

/**
 * 풀은 **사이트맵**에서 만든다. 처음에는 목록 페이지(/normal-levels-i 등)를
 * 긁었는데, 그건 허브라서 번역 안 된 레벨까지 전부 링크한다 — 뽑는 족족
 * 404였다(실측). 사이트맵에는 실재하는 문서만 있다.
 * 한국어 위키(문서 137편)를 먼저 소진하고, 다 보면 영어 위키(9천 편)로 넘어간다.
 */
const SLUG_RE = /\/((?:level|entity)-[0-9][a-z0-9-]*)<\/loc>/g;

/** 이보다 짧으면 스텁으로 보고 영어 위키로 폴백한다 */
const STUB_CHARS = 400;
const MAX_TEXT = 8000;

async function poolFrom(base: string): Promise<string[]> {
  const xml = await fetchHtml(`${base}/sitemap.xml`);
  const slugs = new Set<string>();
  for (const m of xml.matchAll(SLUG_RE)) slugs.add(m[1]);
  return [...slugs];
}

/**
 * 문서 하나를 가져온다. 한국어 위키 우선, 없거나 스텁이면 영어 위키.
 * 양쪽 다 없으면 null — 호출자가 툼스톤 처리한다.
 */
async function fetchDoc(slug: string): Promise<{ url: string; html: string; text: string } | null> {
  let ko: { url: string; html: string; text: string } | null = null;
  try {
    const html = await fetchHtml(`${KO_BASE}/${slug}`);
    ko = { url: `${KO_BASE}/${slug}`, html, text: pageText(html) };
    if (ko.text.length >= STUB_CHARS) return ko;
  } catch {
    /* 미번역 — 영어판으로 */
  }
  try {
    const html = await fetchHtml(`${EN_BASE}/${slug}`);
    const en = { url: `${EN_BASE}/${slug}`, html, text: pageText(html) };
    if (en.text.length >= STUB_CHARS || !ko) return en.text.length > 0 ? en : ko;
  } catch {
    /* 영어판도 없다 */
  }
  // 영어판이 없는 한국 오리지널 스텁 — 짧아도 있는 쪽을 쓴다
  return ko;
}

const wiki: Source = {
  key: "bkwiki",
  label: "백룸 위키",
  enabled: true,
  async fetch(): Promise<RawItem[]> {
    // 한국어 풀 먼저, 소진되면 영어 풀. 슬러그가 같으면 같은 문서로 본다 —
    // 한국어로 이미 본 레벨이 영어 풀에서 또 나오면 안 된다.
    let unseen = await filterUnseen(
      "backrooms",
      (await poolFrom(KO_BASE)).map((s) => `bkko:${s}`),
    );
    if (unseen.length === 0) {
      unseen = await filterUnseen(
        "backrooms",
        (await poolFrom(EN_BASE)).map((s) => `bkko:${s}`),
      );
    }

    // 사이트맵 생성 후 삭제된 문서가 걸릴 수 있다 — 몇 번 다시 뽑고,
    // 양쪽 위키 다 없는 슬러그는 툼스톤으로 upsert해 풀에서 영구히 뺀다.
    for (let attempt = 0; attempt < 3 && unseen.length > 0; attempt++) {
      const id = unseen.splice(Math.floor(Math.random() * unseen.length), 1)[0];
      const slug = id.slice("bkko:".length);

      const doc = await fetchDoc(slug);
      if (!doc) {
        await upsertAndGetNew("backrooms", [
          { externalId: id, title: slug, origin: "bkwiki", payload: { dead: true } },
        ]);
        continue;
      }

      return [
        {
          externalId: id,
          url: doc.url,
          title: pageTitle(doc.html) ?? slug.replace(/-/g, " ").toUpperCase(),
          origin: "bkwiki",
          payload: {
            kind: slug.startsWith("level-") ? "level" : "entity",
            text: doc.text.slice(0, MAX_TEXT),
            imageUrl: pageImage(doc.html),
          },
        },
      ];
    }
    return []; // 풀 소진 또는 연속으로 죽은 링크 — no_new로 끝난다
  },
};

export const backrooms: SourceModule = {
  key: "backrooms",
  label: "백룸",
  sources: [wiki],
  queueCap: LORE_QUEUE_CAP,
  render: {
    mode: "llm",
    maxInput: 1,
    prompt: () =>
      lorePrompt({
        world: "백룸(The Backrooms)",
        doc: "레벨 또는 엔티티 문서 한 편",
        ask: "여기가 어떤 곳이고(또는 이게 뭐고) 마주치면 어떻게 되나. 살아나갈 방법이 있긴 한가.",
        bullets: [
          "**생존 난이도** — 문서의 등급 표기와 그 의미",
          "**묘사** — 그곳의 풍경·소리·질감, 들어가면 뭐가 보이는지",
          "**엔티티** — 뭐가 살고 있고 얼마나 위험한지 (레벨 문서일 때)",
          "**입장과 탈출** — 어떻게 들어가게 되고, 어떻게 나오는지",
          "**생존 수칙** — 문서가 말하는 해야 할 것과 하지 말아야 할 것",
        ],
      }),
    postProcess: lorePostProcess,
  },
};
