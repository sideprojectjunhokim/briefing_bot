// M6. backrooms — 백룸 다이제스트. scp와 같은 탐험형이지만 **형식이 다르다**.
//
// scp는 문서 한 편을 깊이 파고, 백룸은 **여러 레벨을 가볍게** 들고 온다(유저
// 확정, 07-30). 백룸 문서는 어차피 위키에서 직접 읽는 맛이 있어서, 카드는
// "오늘은 이런 레벨들이 있다"는 입구 역할만 한다 — 한두 문장씩, 원문 링크로.
//
// 풀은 **사이트맵**에서 만든다. 처음에는 목록 페이지(/normal-levels-i 등)를
// 긁었는데, 그건 허브라서 번역 안 된 레벨까지 전부 링크한다 — 뽑는 족족
// 404였다(실측). 사이트맵에는 실재하는 문서만 있다.
// 한국어 위키(문서 137편)를 먼저 소진하고, 다 보면 영어 위키(9천 편)로 넘어간다.
import type { RawItem, Source, SourceContext, SourceModule } from "../types";
import { fetchHtml, pageImage, pageText, pageTitle } from "../wikidot";
import { filterUnseen, upsertAndGetNew } from "../db";
import { LORE_QUEUE_CAP, lorePostProcess } from "./lore";

const KO_BASE = "http://backrooms-wiki-ko.wikidot.com";
const EN_BASE = "http://backrooms-wiki.wikidot.com";

const SLUG_RE = /\/((?:level|entity)-[0-9][a-z0-9-]*)<\/loc>/g;

/** 한 장에 담는 문서 수. 죽은 링크 대비로 두어 개 더 뽑아 둔다 */
const PICK_COUNT = 5;
const PICK_EXTRA = 2;

/** 이보다 짧으면 스텁으로 보고 영어 위키로 폴백한다 */
const STUB_CHARS = 400;
/** 다이제스트라 문서당 텍스트를 짧게 문다 — 5편이면 이것만으로 충분히 무겁다 */
const MAX_TEXT = 2500;

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
  async fetch({ userId }: SourceContext): Promise<RawItem[]> {
    // 한국어 풀 먼저, 소진되면 영어 풀. 슬러그가 같으면 같은 문서로 본다 —
    // 한국어로 이미 본 레벨이 영어 풀에서 또 나오면 안 된다.
    let unseen = await filterUnseen(
      userId,
      "backrooms",
      (await poolFrom(KO_BASE)).map((s) => `bkko:${s}`),
    );
    if (unseen.length === 0) {
      unseen = await filterUnseen(
        userId,
        "backrooms",
        (await poolFrom(EN_BASE)).map((s) => `bkko:${s}`),
      );
    }
    if (unseen.length === 0) return []; // 풀 소진 — no_new로 끝난다

    // 무작위로 넉넉히 뽑아 병렬로 가져오고, 성공한 것 중 앞의 PICK_COUNT만 싣는다
    const chosen: string[] = [];
    while (chosen.length < PICK_COUNT + PICK_EXTRA && unseen.length > 0) {
      chosen.push(unseen.splice(Math.floor(Math.random() * unseen.length), 1)[0]);
    }
    const docs = await Promise.all(
      chosen.map(async (id) => ({ id, doc: await fetchDoc(id.slice("bkko:".length)) })),
    );

    // 사이트맵 생성 후 삭제된 문서 — 툼스톤으로 풀에서 영구히 뺀다
    const dead = docs.filter((d) => !d.doc);
    if (dead.length > 0) {
      await upsertAndGetNew(
        userId,
        "backrooms",
        dead.map((d) => ({
          externalId: d.id,
          title: d.id,
          origin: "bkwiki",
          payload: { dead: true },
        })),
      );
    }

    return docs
      .filter((d): d is { id: string; doc: NonNullable<(typeof docs)[0]["doc"]> } => !!d.doc)
      .slice(0, PICK_COUNT)
      .map(({ id, doc }) => {
        const slug = id.slice("bkko:".length);
        return {
          externalId: id,
          url: doc.url,
          title: pageTitle(doc.html) ?? slug.replace(/-/g, " ").toUpperCase(),
          origin: "bkwiki",
          payload: {
            kind: slug.startsWith("level-") ? "level" : "entity",
            text: doc.text.slice(0, MAX_TEXT),
            imageUrl: pageImage(doc.html),
          },
        };
      });
  },
};

export const backrooms: SourceModule = {
  key: "backrooms",
  label: "백룸",
  sources: [wiki],
  queueCap: LORE_QUEUE_CAP,
  render: {
    mode: "llm",
    maxInput: PICK_COUNT,
    // scp의 lorePrompt(한 편 깊이 파기)와 다르다 — 여긴 다이제스트다.
    // 고르는 것도 모델 일이 아니다: 코드가 이미 무작위로 골랐고, 전부 싣는다.
    // 여기서 모델이 몇 개를 떨구면 그 문서는 카드 없이 "봤음"으로 타 버린다.
    prompt: () =>
      [
        "너는 백룸(The Backrooms) 아카이브의 안내인이다. 읽는 사람은 일하다 잠깐",
        "쉬면서 \"오늘은 어떤 레벨들이 있나\" 하고 열어 본다. 뉴스가 아니다 —",
        "오래된 문서여도 좋은 문서면 된다.",
        "",
        "입력은 위키 문서 여러 편의 본문 텍스트다(태그를 벗긴 것이라 메뉴·평점",
        "같은 잡음이 섞여 있을 수 있다 — 무시해라).",
        "",
        "출력은 두 부분이다.",
        "",
        "1) 리드 한두 문장 — 오늘 묶음의 인상. 라벨·소제목 없이 바로 문장으로 시작해라.",
        "",
        "2) 빈 줄 뒤, **주어진 문서 전부**를 각각 불릿 하나로:",
        "   `- [문서 제목](#번호) — 한두 문장`",
        "   그 한두 문장이 답할 것: 여긴 어떤 곳이고(뭐가 살고), 왜 눌러 볼 만한가.",
        "   생존 난이도 등급이 문서에 있으면 `등급 2` 꼴로 문장에 녹여라.",
        "   자세한 건 쓰지 마라 — 문서로 넘어가게 만드는 게 이 카드의 일이다.",
        "",
        "**빼지 마라.** 고르는 건 이미 끝났다 — 스텁이라 쓸 게 없는 문서만 빼고,",
        "그 경우에도 나머지는 전부 실어라.",
        "링크 자리에는 주소 대신 `#번호`를 써라. 실제 주소는 코드가 붙인다.",
        "**전부 한국어.** 원문이 영어면 읽고 자연스러운 한국어로 옮겨라.",
        "인사말·맺음말은 쓰지 마라.",
      ].join("\n"),
    postProcess: lorePostProcess,
  },
};
