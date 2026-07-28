// briefing-job — 수집→중복제거→요약→briefings 저장 (발송 없음, 웹이 읽음)
// 호출: pg_cron → pg_net http_post, body {"module":"technews"} (없으면 전체)
// 보안: 헤더 x-job-secret 검증. 배포는 --no-verify-jwt.
import type { RawItem, SourceModule } from "../_shared/types.ts";
import { MODULES, getModule } from "../_shared/modules/index.ts";
import {
  countTodayOk,
  insertBriefing,
  upsertAndGetNew,
} from "../_shared/db.ts";
import { summarize } from "../_shared/summarize.ts";

const JOB_SECRET = Deno.env.get("JOB_SECRET")!;
const MAX_RUNS_PER_DAY = 3; // 비용 가드: 모듈당 하루 ok 브리핑 상한

Deno.serve(async (req) => {
  if (req.headers.get("x-job-secret") !== JOB_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const only: string | undefined = body?.module;
  const targets = only ? [getModule(only)].filter(Boolean) as SourceModule[] : MODULES;
  if (only && targets.length === 0) return json({ error: `unknown module: ${only}` }, 400);

  const results: Record<string, unknown> = {};

  // 모듈별 격리: 하나가 던져도 나머지는 계속
  for (const mod of targets) {
    try {
      results[mod.key] = await runModule(mod);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results[mod.key] = { status: "failed", error: message };
      await insertBriefing({
        moduleKey: mod.key,
        itemCount: 0,
        content: null,
        status: "failed",
        error: message,
      }).catch(() => {});
    }
  }

  return json({ ok: true, results });
});

async function runModule(mod: SourceModule) {
  // 비용 가드
  if ((await countTodayOk(mod.key)) >= MAX_RUNS_PER_DAY) {
    return { status: "skipped_guard" };
  }

  // 소스별 격리 수집 → 통합
  const collected: RawItem[] = [];
  const sourceStatus: Record<string, string> = {};
  for (const src of mod.sources) {
    if (!src.enabled) {
      sourceStatus[src.key] = "disabled";
      continue;
    }
    try {
      const items = await src.fetch();
      collected.push(...items);
      sourceStatus[src.key] = `ok(${items.length})`;
    } catch (e) {
      sourceStatus[src.key] = `fail(${e instanceof Error ? e.message : e})`;
    }
  }

  // 중복제거: 신규만
  const fresh = await upsertAndGetNew(mod.key, collected);
  if (fresh.length === 0) {
    await insertBriefing({
      moduleKey: mod.key,
      itemCount: 0,
      content: null,
      status: "skipped_empty",
    });
    return { status: "skipped_empty", sources: sourceStatus };
  }

  // 렌더
  let content: string;
  if (mod.render.mode === "llm") {
    content = await summarize(fresh, mod.render.systemPrompt, mod.render.maxItems);
  } else {
    content = mod.render.format(fresh);
  }

  await insertBriefing({
    moduleKey: mod.key,
    itemCount: fresh.length,
    content,
    status: "ok",
  });
  return { status: "ok", itemCount: fresh.length, sources: sourceStatus };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
