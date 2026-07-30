/**
 * 브리핑봇 안의 대화.
 *
 * **여기 있어야 하는 이유는 하나다 — 지금 읽고 있는 게 뭔지 알고 있다는 것.**
 * ChatGPT를 켜서 물어보려면 카드를 복붙해야 하는데, 여기서는 그냥 "이거 진짜야?"
 * 라고 물으면 된다. 그 이점이 없는 기능은 굳이 여기 둘 이유가 없다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "../collect/models";
import { stripModelNoise } from "../collect/modelText";
import {
  addTopic,
  getBriefing,
  getChatStatus,
  listTopicsForChat,
  setStar,
  setTopicEnabled,
  type Briefing,
  type ChatStatus,
} from "../db";
import { customKey } from "../topics";
import { parseItems } from "../briefing";

/** 도구를 부르고 결과를 받아 다시 부르는 왕복 상한. 넘으면 그냥 답하게 둔다 */
const MAX_ROUNDS = 4;
const MAX_TOKENS = 2000;

/**
 * 깊게 봐야 하는 질문인지 대충 가른다.
 *
 * 이 엔드포인트에서 deep(Sonnet thinking)은 첫 글자까지 10초가 걸린다(실측).
 * 짧은 질문까지 그걸로 받으면 대화가 안 된다. 그래서 기본은 fast(Haiku)이고,
 * 확인·검증처럼 틀리면 안 되는 말이 보일 때만 올린다. 거친 기준이라
 * 며칠 써 보고 고칠 것.
 */
const DEEP_HINTS = /사실|진짜|맞아|맞나|검증|확인|자세|깊게|왜\s|근거|출처|반박|비교/;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** 실제로 일어난 일 한 줄. 안 된 것도 남긴다 — 성공만 적으면 기록이 거짓말이 된다 */
export interface ChatAction {
  ok: boolean;
  text: string;
}

export interface ChatResult {
  reply: string;
  /** 실제로 실행된 것 — 화면에 "무엇을 했는지" 남긴다 */
  actions: ChatAction[];
  model: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim() || undefined;
  if (!apiKey && !authToken) throw new Error("ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN이 필요합니다");
  client = apiKey ? new Anthropic({ apiKey }) : new Anthropic({ apiKey: null, authToken });
  return client;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "fetch_article",
    description:
      "지금 보고 있는 카드에 실린 기사의 원문을 가져온다. 요약만으로 답할 수 없는 질문" +
      "(사실 확인, 자세한 내용, 숫자 대조)일 때 쓴다. url은 카드에 있는 링크 그대로 넘긴다.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "카드에 실린 기사 링크" } },
      required: ["url"],
    },
  },
  {
    name: "add_topic",
    description:
      "새 관심사를 추가한다. label은 화면에 보일 이름, query는 뉴스 검색어다. " +
      "**query는 label을 그대로 쓰지 말고 더 잘 잡히게 다듬어라** — 예: label '홈서버'라면 " +
      "query는 '홈서버 NAS 자가호스팅'. 엉뚱한 분야가 섞이지 않게 하는 게 중요하다.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "화면에 보일 이름 (짧게)" },
        query: { type: "string", description: "뉴스 검색어 (다듬어서)" },
      },
      required: ["label", "query"],
    },
  },
  {
    name: "set_topic_enabled",
    description: "관심사를 켜거나 끈다. 끄면 그 관심사의 안 읽은 카드도 큐에서 내려간다.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "관심사 목록에 있는 key" },
        enabled: { type: "boolean" },
      },
      required: ["key", "enabled"],
    },
  },
  {
    name: "star_topic",
    description: "관심사에 별표를 붙이거나 뗀다. 별표를 붙이면 한 장에 더 많이 받는다.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "관심사 목록에 있는 key" },
        starred: { type: "boolean" },
      },
      required: ["key", "starred"],
    },
  },
];

/** 카드 본문에 실제로 실린 링크만 열어 준다 — 아무 주소나 열면 다른 물건이 된다 */
function allowedUrls(card: Briefing | null): Set<string> {
  if (!card?.content) return new Set();
  return new Set(parseItems(card.content).map((i) => i.url).filter((u): u is string => Boolean(u)));
}

/**
 * 원문을 읽어 온다.
 *
 * **Google 뉴스 링크는 못 연다.** 리다이렉트가 JS로 일어나고, 서버에서 받으면
 * 589KB짜리 앱 껍데기만 온다(실측). 원문 주소가 HTML 안에 없어서 긁어낼 방법이
 * 없다. 그럴 땐 못 연다고 분명히 돌려줘서, 모델이 안 본 걸 본 것처럼 말하지
 * 않게 한다 — 사실 확인이 목적인 도구라 이게 제일 중요하다.
 *
 * GeekNews·Hacker News 링크는 실제 페이지라 그대로 읽힌다.
 */
/**
 * 열렸는지를 같이 돌려준다. 실행 기록에 "원문을 열어 확인했습니다"라고 찍히는데
 * 정작 본문은 못 읽은 경우가 있었다 — 답에는 "못 열었다"고 쓰면서 기록은 성공이라
 * 서로 어긋났다. 사실 확인이 목적인 도구라 이 거짓말이 제일 나쁘다.
 */
async function readArticle(url: string): Promise<{ text: string; opened: boolean }> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
  if (!res.ok) return { text: `원문을 못 가져왔습니다 (HTTP ${res.status}).`, opened: false };

  if (/news\.google\.com/.test(res.url)) {
    return {
      opened: false,
      text:
        "이 링크는 Google 뉴스를 거쳐 가는 주소라 원문을 열 수 없습니다. " +
        "**원문을 못 봤다는 걸 분명히 밝히고**, 카드에 있는 제목·요약·매체명 범위에서만 답하세요. " +
        "확인이 필요하면 사용자가 링크를 직접 눌러야 한다고 알려 주세요.",
    };
  }

  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // 통째로 넣으면 토큰만 먹는다. 앞부분이면 기사 본문은 대개 들어온다
  return text
    ? { text: text.slice(0, 4000), opened: true }
    : { text: "원문에서 본문을 찾지 못했습니다.", opened: false };
}

const KST = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })
    : "기록 없음";

function buildContext(
  card: Briefing | null,
  topics: Awaited<ReturnType<typeof listTopicsForChat>>,
  status: ChatStatus,
) {
  const lines = [
    "너는 '안 읽은 파일'이라는 개인용 뉴스 브리핑 앱 안에 있는 어시스턴트다.",
    "",
    "**앱 밖의 질문도 그냥 답해라.** 잡담이든 사적인 질문이든 일반 상식이든, 아는 대로 답하면 된다.",
    '"나는 앱 내부 동작을 확인할 수 없다" 같은 말로 밀어내지 마라 — 아래에 이 앱이 어떻게',
    "도는지와 지금 상태가 다 적혀 있고, 도구로 실제로 바꿀 수도 있다.",
    "",
    "한국어로, 짧고 곧게 답해라. 모르면 모른다고 하되, 아래에 답이 있는 건 아래를 보고 답해라.",
    // 말풍선에 표를 그릴 자리가 없고, 이 화면엔 이모지를 쓰는 곳이 한 군데도 없다
    "서식은 **굵게**와 `- ` 목록만 쓴다. 표·제목(#)·인용(>)·이모지는 쓰지 마라.",
    "",
    "── 이 앱이 도는 방식 ──",
    "- 수집은 **매시 한 번** 돈다(GitHub Actions cron). 정시에 딱 맞지 않고 5~20분 밀린다.",
    "- **그 시간에 건질 게 없으면 아무것도 안 쌓는다. 그게 정상이고 고장이 아니다.**",
    "  뉴스가 시간당 쏟아지지 않으므로, 새 카드가 없는 시간이 오히려 더 많다.",
    "- 새 기사가 있어도 광고성이거나 알맹이가 없으면 전부 걸러서 카드를 안 만든다.",
    "- 한 번 실린 기사는 다시 안 온다(중복제거). 그래서 같은 관심사도 갈수록 조용해진다.",
    "- 카드 하나 = 한 회차에 한 관심사가 건진 묶음. 읽으면 큐에서 빠진다.",
    "- 3일 넘게 안 읽은 카드는 큐에서 내려간다(지워지진 않고 관심사별 지난 목록에 남는다).",
    "- 별표를 붙이면 그 관심사만 한 장에 더 많이 담는다.",
    "",
    "── 지금 상태 ──",
    `- 마지막 수집: ${KST(status.lastCollectedAt)} (한국 시간)`,
    `- 최근 2시간 동안 새로 들어온 기사: ${status.freshLast2h}건`,
    `- 큐에 안 읽은 카드: ${status.unread}장`,
    ...(status.lastCards.length
      ? ["- 관심사별 마지막 카드:", ...status.lastCards.map((c) => `    ${c.module_key}: ${KST(c.at)}`)]
      : ["- 아직 만들어진 카드가 없다"]),
    "",
    "'왜 새 게 없냐'고 물으면 위 숫자를 근거로 답해라. 마지막 수집 시각이 한 시간 안이면",
    "시계는 도는 것이고, 새 기사가 0건이거나 전부 걸러졌다는 뜻이다.",
    "",
    "── 할 수 있는 일 ──",
    "요약만으로 답할 수 없는 질문이면 fetch_article로 원문을 가져와서 답해라.",
    "관심사를 바꿔 달라고 하면 도구로 실제로 바꾸고, 무엇을 바꿨는지 한 줄로 알려라.",
    "",
    "── 지금 받고 있는 관심사 ──",
    ...topics.map((t) => `  - ${t.label} (key: ${t.key})${t.enabled ? "" : " — 꺼짐"}${t.starred ? " ★" : ""}`),
  ];

  if (card?.content) {
    lines.push(
      "",
      "사용자가 지금 열어 놓은 카드:",
      "```",
      card.content.slice(0, 6000),
      "```",
    );
  } else {
    lines.push("", "지금 열어 놓은 카드는 없다. 기사에 대한 질문이면 어느 카드인지 먼저 물어봐라.");
  }

  // 여기 한 번 더 못박는 이유: 위가 40줄짜리 앱 설명이라 fast 모델이 거기에 닻을 내린다.
  // "저녁에 뭐 해먹지"를 관심사 정리 요청으로 읽는 걸 실제로 봤다. 마지막에 온 말이 세다.
  lines.push(
    "",
    "── 답하기 전에 ──",
    "위는 참고 자료일 뿐이다. 질문이 이 앱과 상관없으면(저녁 메뉴, 잡담, 일반 상식, 사적인 고민)",
    "**위 내용은 잊고 그냥 평범하게 답해라.** 뉴스나 관심사 얘기로 끌고 오지 마라.",
    "질문이 짧거나 흐릿해도 되물어 시간 끌지 말고, 가장 그럴듯하게 읽어서 일단 답해라.",
  );
  return lines.join("\n");
}

export async function runChat(turns: ChatTurn[], cardId?: number): Promise<ChatResult> {
  const [card, topics, status] = await Promise.all([
    cardId ? getBriefing(cardId) : Promise.resolve(null),
    listTopicsForChat(),
    getChatStatus(),
  ]);
  const urls = allowedUrls(card);

  const last = turns[turns.length - 1]?.content ?? "";
  const model = DEEP_HINTS.test(last) ? MODELS.deep : MODELS.fast;

  // 지시는 user 턴 맨 앞에 넣는다 — 이 엔드포인트는 system을 자기 것으로 덮어쓴다
  const messages: Anthropic.MessageParam[] = turns.map((t, i) =>
    i === 0
      ? { role: t.role, content: `${buildContext(card, topics, status)}\n\n---\n\n${t.content}` }
      : { role: t.role, content: t.content },
  );

  const actions: ChatAction[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await getClient().messages.create({
      model,
      max_tokens: MAX_TOKENS,
      tools: TOOLS,
      messages,
    });

    const text = stripModelNoise(
      res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim(),
    );

    if (res.stop_reason !== "tool_use") {
      return { reply: text || "답을 만들지 못했습니다.", actions, model };
    }

    messages.push({ role: "assistant", content: res.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const { out, note } = await runTool(block.name, block.input as Record<string, unknown>, urls);
      if (note) actions.push(note);
      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }

  return { reply: "여러 번 시도했는데 마무리하지 못했습니다. 다시 물어봐 주세요.", actions, model };
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  urls: Set<string>,
): Promise<{ out: string; note?: ChatAction }> {
  try {
    switch (name) {
      case "fetch_article": {
        const url = String(input.url ?? "");
        // 카드에 실린 링크만 — 아무 주소나 열어 주면 그건 다른 물건이 된다
        if (!urls.has(url)) {
          return { out: "그 링크는 지금 열어 놓은 카드에 없습니다. 카드에 있는 링크만 열 수 있습니다." };
        }
        const { text, opened } = await readArticle(url);
        return {
          out: text,
          note: opened
            ? { ok: true, text: "원문을 열어 확인했습니다" }
            : { ok: false, text: "원문을 열지 못했습니다" },
        };
      }
      case "add_topic": {
        const label = String(input.label ?? "").trim().slice(0, 40);
        const query = String(input.query ?? "").trim().slice(0, 120) || label;
        if (!label) return { out: "이름이 비었습니다." };
        const key = customKey(label);
        await addTopic(key, label, query);
        return {
          out: `추가했습니다. key=${key}, 검색어="${query}". 다음 수집부터 쌓입니다.`,
          note: { ok: true, text: `관심사 추가: ${label} (검색어 "${query}")` },
        };
      }
      case "set_topic_enabled": {
        const key = String(input.key ?? "");
        const enabled = input.enabled !== false;
        const ok = await setTopicEnabled(key, enabled);
        if (!ok) return { out: `${key}라는 관심사를 못 찾았습니다.` };
        return {
          out: `${enabled ? "켰습니다" : "껐습니다"}.`,
          note: { ok: true, text: `${key} ${enabled ? "켬" : "끔"}` },
        };
      }
      case "star_topic": {
        const key = String(input.key ?? "");
        const starred = input.starred !== false;
        const max = await setStar(key, starred);
        return {
          out: starred ? `별표를 붙였습니다. 이제 한 장에 최대 ${max}개까지 받습니다.` : "별표를 뗐습니다.",
          note: { ok: true, text: `${key} 별표 ${starred ? "붙임" : "뗌"}` },
        };
      }
      default:
        return { out: `모르는 도구입니다: ${name}` };
    }
  } catch (e) {
    return { out: `실패했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
}
