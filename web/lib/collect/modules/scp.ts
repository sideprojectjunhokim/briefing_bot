// M5. scp — SCP 재단 아카이브 탐험. 뉴스가 아니다.
//
// SCP는 유저들이 위키에서 쌓아 온 창작 세계관이라 뉴스 검색에는 잡힐 게 없다.
// 그래서 이 모듈은 "오늘 무슨 일이 있었나"가 아니라 **"오늘은 이 문서"**를
// 한 편 꺼내 온다. 최신성이 무의미한 유일한 모듈이고, 대신 읽는 속도만큼
// 나온다(queueCap — 안 읽은 게 남아 있으면 그 회차는 쉰다).
//
// 풀은 Crom API(한국 위키 색인, CC BY-SA)에서 평점순으로 받는다. 본문은
// 위키 페이지를 직접 긁는다 — Crom의 source는 위키텍스트라 [[include]]가
// 전개 전이고, 렌더된 HTML이 사람이 읽는 그대로다.
import type { RawItem, Source, SourceContext, SourceModule } from "../types";
import { fetchHtml, pageImage, pageText } from "../wikidot";
import { filterUnseen } from "../db";
import { LORE_QUEUE_CAP, lorePostProcess, lorePrompt } from "./lore";

const CROM_API = "https://api.crom.avn.sh/graphql";
const KO_BASE = "http://scpko.wikidot.com";
/** 평점 상위 몇 편을 풀로 두나. 소진되면 no_new — 그때 페이지네이션을 붙인다 */
const POOL_SIZE = 100;
/** LLM에 넘길 본문 상한(문자). SCP 한 편이 보통 3~8천 자다 */
const MAX_TEXT = 8000;

interface CromNode {
  url: string;
  wikidotInfo: { title: string; rating: number; tags: string[] } | null;
}

async function cromTopPages(): Promise<CromNode[]> {
  const query = `{
    pages(
      filter: {anyBaseUrl: ["${KO_BASE}"]},
      sort: {order: DESC, key: RATING},
      first: ${POOL_SIZE}
    ) { edges { node { url wikidotInfo { title rating tags } } } }
  }`;
  const res = await fetch(CROM_API, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "briefing-bot/1.0 (+personal use)" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`crom ${res.status}`);
  const json = (await res.json()) as {
    data?: { pages?: { edges?: { node: CromNode }[] } };
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(`crom: ${json.errors[0].message}`);
  return (json.data?.pages?.edges ?? []).map((e) => e.node);
}

const crom: Source = {
  key: "crom",
  label: "SCP 한국어 위키",
  enabled: true,
  async fetch({ userId }: SourceContext): Promise<RawItem[]> {
    // 풀에서 **이 유저가** 아직 안 본 것만 남기고 한 편을 뽑는다.
    // 번역·오리지널이 섞여 있는 게 맞다 — 읽는 사람에겐 같은 아카이브다.
    const pool = (await cromTopPages()).filter(
      (n) => n.wikidotInfo && n.wikidotInfo.tags.includes("scp"),
    );
    const byId = new Map(pool.map((n) => [`scpko:${n.url.split("/").pop()}`, n]));
    const unseen = await filterUnseen(userId, "scp", [...byId.keys()]);
    if (unseen.length === 0) return []; // 풀 소진 — no_new로 끝난다

    const id = unseen[Math.floor(Math.random() * unseen.length)];
    const node = byId.get(id)!;
    const html = await fetchHtml(node.url);

    return [
      {
        externalId: id,
        url: node.url,
        title: node.wikidotInfo!.title,
        origin: "scpko",
        payload: {
          text: pageText(html).slice(0, MAX_TEXT),
          rating: node.wikidotInfo!.rating,
          tags: node.wikidotInfo!.tags.filter((t) => t !== "scp"),
          imageUrl: pageImage(html),
        },
      },
    ];
  },
};

export const scp: SourceModule = {
  key: "scp",
  label: "SCP 재단",
  sources: [crom],
  queueCap: LORE_QUEUE_CAP,
  render: {
    mode: "llm",
    maxInput: 1,
    prompt: () =>
      lorePrompt({
        world: "SCP 재단",
        doc: "SCP 문서 한 편",
        ask: "이 개체가 뭐고 왜 무서운가(또는 웃긴가). 격리 절차가 왜 그 모양인지가 곧 이야기다.",
        bullets: [
          "**등급** — 격리 등급과 그게 뜻하는 것",
          "**정체** — 뭐하는 개체인지, 실제 묘사 중심으로",
          "**격리 절차** — 왜 이렇게까지 하는지가 드러나게",
          "**읽을 포인트** — 이 문서가 사랑받는 이유, 반전이나 뒷맛",
        ],
      }),
    postProcess: lorePostProcess,
  },
};
