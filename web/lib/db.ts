// Neon 클라이언트 + 화면이 쓰는 조회. 수집 전용 쓰기는 lib/collect/db.ts에 있다.
//
// DATABASE_URL이 없으면 데모 데이터로 화면을 볼 수 있다(hasDb=false). Neon 계정
// 붙이기 전에도 레이아웃·애니메이션을 확인할 수 있게 남겨 둔 경로다.
//
// 쿼리는 전부 태그드 템플릿으로만 쓴다. 문자열을 조립해 넘기는 형태(sql.query)는
// 드라이버 버전에 따라 있고 없고 해서, 컬럼 목록을 상수로 빼는 것보다 그냥
// 매번 나열하는 쪽을 골랐다.
import { neon } from "@neondatabase/serverless";
import { starredPickMax } from "./topics";

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

export interface IndexEntry {
  key: string;
  label: string;
  unread: number;
  /** 검색으로 채우는 관심사인가(직접 추가한 것 포함) */
  topic: boolean;
  /** 별표 — 더 많이 받기로 한 것 */
  starred: boolean;
}

/**
 * 별표 하나만 뒤집는다.
 *
 * 설정 화면을 거치지 않고 읽던 자리에서 바로 누르는 경로다. 읽다가 "이거
 * 재밌네" 싶은 순간이 별을 붙일 진짜 타이밍인데, 그때 설정으로 나가야 하면
 * 아무도 안 붙인다.
 */
export async function setStar(key: string, starred: boolean): Promise<number> {
  const sql = requireSql();

  // 기본 상한은 별표 **안 한** 행에서 읽는다. 별표한 행은 이미 부풀려져 있어서
  // 그걸 기준으로 삼으면 누를 때마다 상한이 두 배씩 커진다.
  const baseRows = (await sql`
    select pick_max from topics where enabled and not starred
    union all
    select pick_max from module_prefs where not muted and not starred
    limit 1`) as { pick_max: number }[];
  const base = baseRows[0]?.pick_max ?? 8;
  const max = starred ? starredPickMax(base) : base;

  const hit = (await sql`
    update topics set pick_max = ${max}, starred = ${starred}
    where key = ${key} and enabled returning key`) as unknown[];

  if (hit.length === 0) {
    await sql`
      update module_prefs set pick_max = ${max}, starred = ${starred}, updated_at = now()
      where module_key = ${key}`;
  }
  return max;
}

/**
 * 사이드바 색인 = **지금 받기로 한 것 전부.**
 *
 * 예전엔 코드에 박힌 4모듈만 그렸다. 관심사를 22개로 늘리고 직접 추가까지
 * 되게 해 놓고 색인은 그대로 뒀더니, 큐에는 카드가 있는데 색인엔 그 항목이
 * 아예 없어서 숫자가 안 맞았다.
 */
export async function getIndex(): Promise<IndexEntry[]> {
  const sql = requireSql();
  const [counts, prefRows, topicRows] = await Promise.all([
    getUnreadCountsByModule(),
    sql`select module_key, muted, starred from module_prefs`,
    sql`select key, label, starred from topics where enabled = true order by created_at`,
  ]);
  const prefs = prefRows as { module_key: string; muted: boolean; starred: boolean }[];
  const topics = topicRows as { key: string; label: string; starred: boolean }[];

  const prefOf = new Map(prefs.map((p) => [p.module_key, p]));
  const curated = MODULE_LABELS.filter(({ key }) => !prefOf.get(key)?.muted).map(
    ({ key, label }) => ({
      key,
      label,
      unread: counts[key] ?? 0,
      topic: false,
      starred: Boolean(prefOf.get(key)?.starred),
    }),
  );

  return [
    ...curated,
    ...topics.map((t) => ({
      key: t.key,
      label: t.label,
      unread: counts[t.key] ?? 0,
      topic: true,
      starred: t.starred,
    })),
  ];
}

/** 코드에 소스가 있는 모듈. lib/modules.ts의 MODULE_ORDER와 같아야 한다 */
const MODULE_LABELS = [
  { key: "hotdeal", label: "핫딜" },
  { key: "market", label: "시세" },
  { key: "technews", label: "테크 뉴스" },
  { key: "community", label: "커뮤니티" },
];

/** 모듈·관심사별 안 읽은 장 수 */
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
export interface CurrentSetup {
  /** 지금 켜져 있는 프리셋 키 (코드 모듈 + 검색 관심사) */
  keys: string[];
  /** 직접 추가한 관심사 */
  custom: { key: string; label: string }[];
  /** 별표 — 더 많이 받기로 한 것 */
  starred: string[];
  /** 별표 안 한 것의 기본 상한 */
  pickMax: number;
}


/** 설정 화면이 지금 상태를 그대로 띄우려고 읽는다 */
export async function getCurrentSetup(): Promise<CurrentSetup> {
  const sql = requireSql();
  const [prefRows, topicRows] = await Promise.all([
    sql`select module_key, muted, pick_max, starred from module_prefs`,
    // 꺼진 것도 가져온다 — 직접 추가한 관심사를 다시 켜려면 목록에 있어야 한다
    sql`select key, label, custom, pick_max, starred, enabled from topics order by created_at`,
  ]);
  const prefs = prefRows as {
    module_key: string;
    muted: boolean;
    pick_max: number;
    starred: boolean;
  }[];
  const topics = topicRows as {
    key: string;
    label: string;
    custom: boolean;
    pick_max: number;
    starred: boolean;
    enabled: boolean;
  }[];

  // 아직 아무것도 저장 안 됐으면(온보딩 전) 코드 모듈은 전부 켜진 것으로 본다
  const curated = prefs.length
    ? prefs.filter((p) => !p.muted).map((p) => p.module_key)
    : MODULE_LABELS.map((m) => m.key);

  // 기본 상한은 별표 **안 한** 것에서 읽는다. 별표한 건 부풀려 저장돼 있어서,
  // 그걸 읽으면 저장할 때마다 상한이 계속 커진다.
  const base =
    topics.find((t) => t.enabled && !t.starred)?.pick_max ??
    prefs.find((p) => !p.starred)?.pick_max ??
    8;

  return {
    // keys = 지금 켜져 있는 것 (커스텀도 포함해야 카드가 켜진 것으로 그려진다)
    keys: [...curated, ...topics.filter((t) => t.enabled).map((t) => t.key)],
    // custom = 꺼진 것까지 전부. 다시 켜려면 목록에 있어야 한다
    custom: topics.filter((t) => t.custom).map((t) => ({ key: t.key, label: t.label })),
    // 켜져 있는 커스텀도 keys에 넣어야 카드가 켜진 것으로 그려진다
    starred: [
      ...prefs.filter((p) => p.starred && !p.muted).map((p) => p.module_key),
      ...topics.filter((t) => t.enabled && t.starred).map((t) => t.key),
    ],
    pickMax: base,
  };
}

export interface SetupTopic {
  key: string;
  label: string;
  query: string;
  custom: boolean;
  /**
   * 꺼진 관심사도 행은 남긴다. 직접 추가한 것은 코드에 목록이 없어서,
   * 지워 버리면 다시 켤 방법이 없고 이름을 또 쳐야 한다.
   */
  enabled: boolean;
}

/** 관심사를 완전히 지운다 — 직접 추가한 것만. 프리셋은 끄기만 한다 */
export async function deleteTopic(key: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from topics where key = ${key} and custom = true`;
}

export async function applySetup(
  pickedModules: string[],
  topics: SetupTopic[],
  pickMax: number,
  starred: string[] = [],
): Promise<void> {
  const sql = requireSql();
  const star = new Set(starred);
  const maxFor = (key: string) => (star.has(key) ? starredPickMax(pickMax) : pickMax);

  // 코드에 소스가 있는 4모듈 — 고르지 않은 건 muted
  const keys = MODULE_KEYS;
  const muted = keys.map((k) => !pickedModules.includes(k));
  const maxes = keys.map(maxFor);
  const stars = keys.map((k) => star.has(k));
  await sql`
    insert into module_prefs (module_key, pick_max, muted, starred, updated_at)
    select k, m, mu, st, now()
    from unnest(
      ${keys}::text[], ${maxes}::int[], ${muted}::boolean[], ${stars}::boolean[]
    ) as x(k, m, mu, st)
    on conflict (module_key) do update
      set pick_max = excluded.pick_max,
          muted = excluded.muted,
          starred = excluded.starred,
          updated_at = now()`;

  // 검색 관심사. 목록에 없는 건 끈다 — **지우지 않는다.** 지우면 이미 본 기사
  // 기록(source_items)과의 연결이 흐려지고, 직접 추가한 것은 다시 켤 수도 없다.
  const all = topics.map((t) => t.key);
  await sql`update topics set enabled = false where key <> all(${all}::text[])`;

  if (topics.length > 0) {
    await sql`
      insert into topics (key, label, query, custom, pick_max, starred, enabled)
      select k, l, q, c, m, st, en
      from unnest(
        ${all}::text[], ${topics.map((t) => t.label)}::text[],
        ${topics.map((t) => t.query)}::text[], ${topics.map((t) => t.custom)}::boolean[],
        ${topics.map((t) => maxFor(t.key))}::int[], ${topics.map((t) => star.has(t.key))}::boolean[],
        ${topics.map((t) => t.enabled)}::boolean[]
      ) as x(k, l, q, c, m, st, en)
      on conflict (key) do update
        set label = excluded.label,
            query = excluded.query,
            pick_max = excluded.pick_max,
            starred = excluded.starred,
            enabled = excluded.enabled`;
  }

  // 끈 관심사의 안 읽은 카드는 큐에서 내린다.
  //
  // "이제 이건 안 볼래"인데 그 카드가 큐에 계속 서 있으면 끈 게 아니다.
  // 지우지는 않으므로 /c/<키>에 그대로 남아 있고, 나중에 다시 켜도 이 카드들이
  // 되살아나진 않는다 — 다시 켠다는 건 "앞으로 받겠다"는 뜻이지
  // "지난 걸 밀린 숙제로 받겠다"는 뜻이 아니다.
  const live = [...pickedModules, ...topics.filter((t) => t.enabled).map((t) => t.key)];
  await sql`
    update briefings set archived_at = now()
    where kind = 'live' and read_at is null and archived_at is null
      and module_key <> all(${live}::text[])`;
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
