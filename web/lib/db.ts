// Neon 클라이언트 + 화면이 쓰는 조회. 수집 전용 쓰기는 lib/collect/db.ts에 있다.
//
// DATABASE_URL이 없으면 데모 데이터로 화면을 볼 수 있다(hasDb=false). Neon 계정
// 붙이기 전에도 레이아웃·애니메이션을 확인할 수 있게 남겨 둔 경로다.
//
// 쿼리는 전부 태그드 템플릿으로만 쓴다. 문자열을 조립해 넘기는 형태(sql.query)는
// 드라이버 버전에 따라 있고 없고 해서, 컬럼 목록을 상수로 빼는 것보다 그냥
// 매번 나열하는 쪽을 골랐다.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
export const hasDb = Boolean(url);

// 서버에서만 부른다. anon 키 같은 개념이 없어 브라우저로 나가면 안 된다.
const client = url ? neon(url) : null;

export function requireSql() {
  if (!client) throw new Error("DATABASE_URL 미설정 — DB 없이 호출됨");
  return client;
}

export type BriefingStatus = "ok" | "failed" | "skipped_empty";

export interface Briefing {
  id: number;
  module_key: string;
  kind: "live" | "wrap";
  item_count: number;
  content: string | null;
  status: BriefingStatus;
  error: string | null;
  est_read_seconds: number;
  thread_of: number | null;
  thread_note: string | null;
  read_at: string | null;
  archived_at: string | null;
  resurfaced_at: string | null;
  created_at: string;
}

/**
 * 큐 = 안 읽었고 아직 안 내려간 것 전부. 홈이 보여 주는 유일한 목록이다.
 * 개수는 정해져 있지 않다 — 한가한 날엔 0장, 바쁜 날엔 7장.
 */
export async function getUnread(): Promise<Briefing[]> {
  const sql = requireSql();
  const rows = await sql`
    select id, module_key, kind, item_count, content, status, error,
           est_read_seconds, thread_of, thread_note,
           read_at, archived_at, resurfaced_at, created_at
    from briefings
    where status = 'ok' and read_at is null and archived_at is null
    order by created_at desc`;
  return rows as Briefing[];
}

/** 사이드바 색인 — 모듈별 안 읽은 장 수 */
export async function getUnreadCountsByModule(): Promise<Record<string, number>> {
  const sql = requireSql();
  const rows = (await sql`
    select module_key, count(*)::int as n
    from briefings
    where status = 'ok' and read_at is null and archived_at is null
    group by module_key`) as { module_key: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.module_key, r.n]));
}

/** 지금 서 있는 수집 실패(모듈별 최신 장이 failed인 것) — 상단 배너용 */
export async function getStandingFailures(): Promise<{ module_key: string; error: string | null }[]> {
  const sql = requireSql();
  const rows = (await sql`
    select distinct on (module_key) module_key, status, error
    from briefings
    where kind = 'live'
    order by module_key, created_at desc`) as {
    module_key: string;
    status: string;
    error: string | null;
  }[];
  return rows.filter((r) => r.status === "failed").map((r) => ({ module_key: r.module_key, error: r.error }));
}

/** 모듈 하나의 지난 장들 — /c/[key] 아카이브 뷰 */
export async function getModuleArchive(moduleKey: string, limit = 20): Promise<Briefing[]> {
  const sql = requireSql();
  const rows = await sql`
    select id, module_key, kind, item_count, content, status, error,
           est_read_seconds, thread_of, thread_note,
           read_at, archived_at, resurfaced_at, created_at
    from briefings
    where module_key = ${moduleKey} and status = 'ok'
    order by created_at desc
    limit ${limit}`;
  return rows as Briefing[];
}

export async function markRead(id: number, read: boolean): Promise<void> {
  const sql = requireSql();
  if (read) {
    await sql`update briefings set read_at = now() where id = ${id}`;
  } else {
    await sql`update briefings set read_at = null where id = ${id}`;
  }
}

// ── 건너뛰기 계측 (#4) ───────────────────────────────────────────
// 설정 화면이 아니라 실제 행동에서 배운다. "큐에서 내려갔는데 끝내 안 읽힌"
// 비율이 곧 관심 없다는 신호다. 조용히 줄이지 않고 한 번 물어본다.

/** 6장은 지나가야 통계라고 부를 수 있다 */
const NUDGE_MIN_SAMPLE = 6;
const NUDGE_SKIP_RATIO = 0.7;

export interface SkipNudge {
  module_key: string;
  skipped: number;
  total: number;
}

/** "이 모듈, 줄일까요?" 후보. 한 번 답하면 2주 동안 다시 안 묻는다. */
export async function getSkipNudge(): Promise<SkipNudge | null> {
  const sql = requireSql();
  const rows = (await sql`
    select b.module_key,
           count(*) filter (where b.read_at is null)::int as skipped,
           count(*)::int as total
    from briefings b
    left join module_prefs p on p.module_key = b.module_key
    where b.kind = 'live' and b.status = 'ok'
      and b.archived_at is not null
      and b.created_at > now() - interval '14 days'
      and (p.nudged_at is null or p.nudged_at < now() - interval '14 days')
      and coalesce(p.muted, false) = false
    group by b.module_key
    having count(*) >= ${NUDGE_MIN_SAMPLE}
       and count(*) filter (where b.read_at is null)::float / count(*) >= ${NUDGE_SKIP_RATIO}
    order by count(*) filter (where b.read_at is null)::float / count(*) desc
    limit 1`) as SkipNudge[];
  return rows[0] ?? null;
}

/**
 * 온보딩에서 고른 값을 module_prefs에 반영한다.
 *
 * 고르지 않은 모듈은 muted가 된다 — 수집 자체를 건너뛰므로 LLM 호출도 안 나간다.
 * nudged_at은 건드리지 않는다. 여기서 찍으면 "물어보고 답 받았다"가 되어
 * 건너뛰기 알림이 2주 동안 안 뜬다.
 */
export interface SetupTopic {
  key: string;
  label: string;
  query: string;
  custom: boolean;
}

export async function applySetup(
  pickedModules: string[],
  topics: SetupTopic[],
  pickMax: number,
): Promise<void> {
  const sql = requireSql();

  // 코드에 소스가 있는 4모듈 — 고르지 않은 건 muted
  const keys = MODULE_KEYS;
  const muted = keys.map((k) => !pickedModules.includes(k));
  const maxes = keys.map(() => pickMax);
  await sql`
    insert into module_prefs (module_key, pick_max, muted, updated_at)
    select k, m, mu, now()
    from unnest(${keys}::text[], ${maxes}::int[], ${muted}::boolean[]) as x(k, m, mu)
    on conflict (module_key) do update
      set pick_max = excluded.pick_max,
          muted = excluded.muted,
          updated_at = now()`;

  // 검색 관심사 — 고른 것만 켜고 나머지는 끈다(지우지 않는다. 지우면
  // 다시 켰을 때 예전에 본 것들이 전부 새 소식으로 되살아난다)
  const picked = topics.map((t) => t.key);
  await sql`update topics set enabled = false where key <> all(${picked}::text[])`;
  if (topics.length === 0) return;

  await sql`
    insert into topics (key, label, query, custom, pick_max, enabled)
    select k, l, q, c, ${pickMax}, true
    from unnest(
      ${picked}::text[], ${topics.map((t) => t.label)}::text[],
      ${topics.map((t) => t.query)}::text[], ${topics.map((t) => t.custom)}::boolean[]
    ) as x(k, l, q, c)
    on conflict (key) do update
      set label = excluded.label,
          query = excluded.query,
          pick_max = excluded.pick_max,
          enabled = true`;
}

/** 코드에 소스가 있는 모듈 키. lib/modules.ts의 MODULE_ORDER와 같아야 한다 */
const MODULE_KEYS = ["hotdeal", "market", "technews", "community"];

/** 답을 받았다. 줄이거나, 아예 끄거나, 그대로 두거나. */
export async function answerNudge(
  moduleKey: string,
  answer: "reduce" | "mute" | "keep",
): Promise<void> {
  const sql = requireSql();
  const pickMax = answer === "reduce" ? 3 : 8;
  const muted = answer === "mute";
  await sql`
    insert into module_prefs (module_key, pick_max, muted, nudged_at, updated_at)
    values (${moduleKey}, ${pickMax}, ${muted}, now(), now())
    on conflict (module_key) do update
      set pick_max = excluded.pick_max,
          muted = excluded.muted,
          nudged_at = now(),
          updated_at = now()`;
}
