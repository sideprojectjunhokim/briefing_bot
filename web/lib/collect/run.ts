// 수집 파이프라인. /api/collect가 부르고, GitHub Actions가 매시 그걸 때린다.
//
// 핵심 규칙 하나: **그 시간에 건질 게 없으면 아무것도 안 쌓는다.** 예전 설계는
// 빈 회차마다 skipped_empty 행을 남겼는데, 매시로 돌리면 그게 하루 96행이고
// 큐에 잡음만 는다. 없으면 없는 것이고, 화면은 "안 읽은 것 0개"라고 말한다.
import type { RawItem, SourceModule } from "./types";
import { MODULES, getModule } from "./modules";
import { summarize, summarizeDay, SKIPPED } from "./summarize";
import { estimateReadSeconds } from "./readtime";
import { parseItems } from "../briefing";
import {
  MAX_OK_PER_DAY,
  archiveStale,
  briefingExists,
  countTodayOk,
  countUnread,
  getPrefs,
  getRecentlyRead,
  getTodayRead,
  hasRecentWrap,
  insertBriefing,
  lastBriefingState,
  linkItems,
  resurfaceOne,
  upsertAndGetNew,
} from "./db";

/** 하루 끝 한 장을 만드는 시각(KST). 일과가 끝날 무렵 한 번. */
const WRAP_HOUR_KST = 18;

export interface ModuleOutcome {
  status: "ok" | "no_new" | "skipped_by_model" | "skipped_guard" | "muted" | "failed";
  itemCount?: number;
  briefingId?: number;
  threadOf?: number | null;
  error?: string;
  sources?: Record<string, string>;
}

export interface RunResult {
  archived: number;
  modules: Record<string, ModuleOutcome>;
  wrap: "created" | "skipped" | "not_time" | null;
  resurfaced: number | null;
  unread: number;
}

export async function runCollection(opts: { only?: string; now?: Date } = {}): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const targets = opts.only
    ? ([getModule(opts.only)].filter(Boolean) as SourceModule[])
    : MODULES;
  if (opts.only && targets.length === 0) throw new Error(`unknown module: ${opts.only}`);

  const archived = await archiveStale();
  const prefs = await getPrefs();

  const modules: Record<string, ModuleOutcome> = {};
  let produced = 0;

  // 모듈별 격리 — 하나가 던져도 나머지는 계속
  for (const mod of targets) {
    const pref = prefs[mod.key];
    if (pref?.muted) {
      modules[mod.key] = { status: "muted" };
      continue;
    }
    try {
      const outcome = await runModule(mod, pref?.pick_max ?? 8);
      modules[mod.key] = outcome;
      if (outcome.status === "ok") produced++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      modules[mod.key] = { status: "failed", error: message };
      await recordFailure(mod.key, message);
    }
  }

  const wrap = await maybeWrap(now);
  if (wrap === "created") produced++;

  // 새로 쌓인 것도 없고 읽을 것도 없을 때만 아카이브에서 하나 꺼낸다.
  // 새것으로 위장하지 않는다 — 화면이 "N일 전 것"이라고 밝힌다.
  let resurfaced: number | null = null;
  if (produced === 0 && (await countUnread()) === 0) {
    resurfaced = (await resurfaceOne())?.id ?? null;
  }

  return { archived, modules, wrap, resurfaced, unread: await countUnread() };
}

async function runModule(mod: SourceModule, pickMax: number): Promise<ModuleOutcome> {
  if ((await countTodayOk(mod.key)) >= MAX_OK_PER_DAY) {
    return { status: "skipped_guard" };
  }

  // 소스별 격리 수집 → 통합
  const collected: RawItem[] = [];
  const sources: Record<string, string> = {};
  for (const src of mod.sources) {
    if (!src.enabled) {
      sources[src.key] = "disabled";
      continue;
    }
    try {
      const items = await src.fetch();
      collected.push(...items);
      sources[src.key] = `ok(${items.length})`;
    } catch (e) {
      sources[src.key] = `fail(${e instanceof Error ? e.message : e})`;
    }
  }

  const fresh = await upsertAndGetNew(mod.key, collected);
  if (fresh.length === 0) return { status: "no_new", sources };

  let content: string;
  let threadOf: number | null = null;
  let threadNote: string | null = null;

  if (mod.render.mode === "llm") {
    const recentlyRead = await getRecentlyRead(mod.key);
    const result = await summarize(fresh, mod.render.prompt({ pickMax, recentlyRead }), mod.render.maxInput);
    if (result === SKIPPED) return { status: "skipped_by_model", sources };
    content = result.content;
    // LLM이 지어낸 번호를 그대로 FK로 넣지 않는다
    if (result.threadOf !== null && (await briefingExists(result.threadOf, mod.key))) {
      threadOf = result.threadOf;
      threadNote = result.threadNote;
    }
  } else {
    content = mod.render.format(fresh);
  }

  if (!content.trim()) return { status: "skipped_by_model", sources };

  // 50건을 훑고 8건을 실었으면 이 장은 8건짜리다. 화면의 "N ITEMS"와
  // "+N MORE"가 이 숫자를 쓰므로, 훑은 수를 넣으면 카드가 거짓말을 한다.
  const shown = parseItems(content);
  const picked = pickedItems(fresh, content);

  const briefingId = await insertBriefing({
    moduleKey: mod.key,
    itemCount: shown.length || fresh.length,
    content,
    status: "ok",
    estReadSeconds: estimateReadSeconds(content),
    threadOf,
    threadNote,
  });
  // 실린 것만 장에 묶는다 — 떨어진 42건까지 묶으면 나중에 이어 붙이기가
  // "읽은 장에 있었다"고 착각한다
  await linkItems(briefingId, mod.key, picked.map((it) => it.externalId));

  return { status: "ok", itemCount: shown.length || fresh.length, briefingId, threadOf, sources };
}

/**
 * 본문에 실제로 실린 아이템만 골라낸다. URL이 본문에 있으면 실린 것으로 본다
 * (링크가 없는 항목은 제목으로 확인). 선별에서 떨어진 것과 구분하는 게 목적이다.
 */
function pickedItems(fresh: RawItem[], content: string): RawItem[] {
  const hit = fresh.filter((it) => (it.url ? content.includes(it.url) : content.includes(it.title)));
  // 형식이 어긋나 하나도 못 맞추면 판단을 포기하고 전부 묶는다 — 링크를 잃는 것보다 낫다
  return hit.length > 0 ? hit : fresh;
}

/** 같은 실패를 매시 새 행으로 쌓지 않는다 — 서 있는 실패는 하나면 된다 */
async function recordFailure(moduleKey: string, message: string): Promise<void> {
  const last = await lastBriefingState(moduleKey);
  if (last?.status === "failed" && last.error === message) return;
  await insertBriefing({
    moduleKey,
    itemCount: 0,
    content: null,
    status: "failed",
    error: message,
  }).catch(() => {});
}

async function maybeWrap(now: Date): Promise<RunResult["wrap"]> {
  // 시계가 GitHub Actions라 정시에 안 돈다(5~20분 밀린다). 그래서 "18시 정각"이
  // 아니라 "18시대"로 본다.
  const kstHour = new Date(now.getTime() + 9 * 3_600_000).getUTCHours();
  if (kstHour !== WRAP_HOUR_KST) return "not_time";
  if (await hasRecentWrap()) return "skipped";

  const read = await getTodayRead();
  const contents = read.map((r) => r.content).filter((c): c is string => Boolean(c));
  const result = await summarizeDay(contents);
  if (result === SKIPPED) return "skipped";

  await insertBriefing({
    moduleKey: "wrap",
    kind: "wrap",
    itemCount: read.length,
    content: result,
    status: "ok",
    estReadSeconds: estimateReadSeconds(result),
  });
  return "created";
}
