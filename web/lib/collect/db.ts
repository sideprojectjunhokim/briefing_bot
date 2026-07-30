// 수집이 쓰는 질의. 화면이 읽는 쪽은 lib/db.ts에 있다.
//
// 07-30 완전 개인화: 모든 질의가 userId 스코프다. 여기 함수에 user_id 조건이
// 하나라도 빠지면 그 데이터는 조용히 남의 것과 섞인다 — 새 질의를 추가할 때
// 제일 먼저 볼 것.
import { requireSql, type Briefing } from "../db";
import type { RawItem, ReadRef } from "./types";
import type { TopicRow } from "./modules/topic";

/**
 * 안 읽은 장을 며칠까지 큐에 두나.
 *
 * 07-30 수집이 9~17시 5회로 줄면서 하루치만 남기기로 함(C-25). 큐에서
 * 내릴 뿐 briefings 행도 source_items도 지우지 않는다 — 지난 목록·중복제거는
 * 그대로 유지된다.
 */
const QUEUE_TTL_DAYS = 1;

/** 이어 붙이기가 되짚는 범위 */
const THREAD_LOOKBACK_DAYS = 7;
const THREAD_MAX_ROWS = 40;

/** 모듈당 하루 ok 상한 — 루프 버그로 인한 LLM 과금 폭주 방지. 9~17시 2시간 간격 5회 = 정상 상한(C-25) */
export const MAX_OK_PER_DAY = 5;

export interface ModulePref {
  pick_max: number;
  muted: boolean;
}

/** 켜져 있는 검색 관심사. 수집기는 이걸 코드 모듈 뒤에 이어 붙여 돈다. */
export async function getEnabledTopics(userId: number): Promise<TopicRow[]> {
  const sql = requireSql();
  const rows = (await sql`
    select key, label, query, pick_max
    from topics
    where user_id = ${userId} and enabled = true
    order by created_at asc`) as TopicRow[];
  return rows;
}

export async function getPrefs(userId: number): Promise<Record<string, ModulePref>> {
  const sql = requireSql();
  const rows = (await sql`
    select module_key, pick_max, muted from module_prefs where user_id = ${userId}`) as {
    module_key: string;
    pick_max: number;
    muted: boolean;
  }[];
  return Object.fromEntries(rows.map((r) => [r.module_key, { pick_max: r.pick_max, muted: r.muted }]));
}

/**
 * 수집 아이템을 넣고 **이번에 처음 본 것만** 돌려준다.
 * (user_id, module_key, external_id) 충돌 = 이미 봤음 → 제외. 중복제거는 이게 전부다.
 */
export async function upsertAndGetNew(
  userId: number,
  moduleKey: string,
  items: RawItem[],
): Promise<RawItem[]> {
  if (items.length === 0) return [];
  const sql = requireSql();

  const externalIds = items.map((it) => it.externalId);
  const urls = items.map((it) => it.url ?? null);
  const titles = items.map((it) => it.title);
  const payloads = items.map((it) => JSON.stringify(it.payload ?? {}));

  const rows = (await sql`
    insert into source_items (user_id, module_key, external_id, url, title, payload)
    select ${userId}, ${moduleKey}, x.eid, x.url, x.title, x.payload::jsonb
    from unnest(
      ${externalIds}::text[], ${urls}::text[], ${titles}::text[], ${payloads}::text[]
    ) as x(eid, url, title, payload)
    on conflict (user_id, module_key, external_id) do nothing
    returning external_id`) as { external_id: string }[];

  const fresh = new Set(rows.map((r) => r.external_id));
  return items.filter((it) => fresh.has(it.externalId));
}

export async function insertBriefing(row: {
  userId: number;
  moduleKey: string;
  kind?: "live" | "wrap";
  itemCount: number;
  content: string | null;
  status: "ok" | "failed";
  error?: string | null;
  estReadSeconds?: number;
  threadOf?: number | null;
  threadNote?: string | null;
}): Promise<number> {
  const sql = requireSql();
  const inserted = (await sql`
    insert into briefings
      (user_id, module_key, kind, item_count, content, status, error,
       est_read_seconds, thread_of, thread_note)
    values
      (${row.userId}, ${row.moduleKey}, ${row.kind ?? "live"}, ${row.itemCount}, ${row.content},
       ${row.status}, ${row.error ?? null},
       ${row.estReadSeconds ?? 0}, ${row.threadOf ?? null}, ${row.threadNote ?? null})
    returning id`) as { id: number }[];
  return inserted[0].id;
}

/** 이 장에 실린 아이템을 장에 묶는다 — 나중에 "읽은 장에 뭐가 있었나"를 되짚는 경로 */
export async function linkItems(
  userId: number,
  briefingId: number,
  moduleKey: string,
  externalIds: string[],
): Promise<void> {
  if (externalIds.length === 0) return;
  const sql = requireSql();
  await sql`
    update source_items set briefing_id = ${briefingId}
    where user_id = ${userId} and module_key = ${moduleKey}
      and external_id = any(${externalIds}::text[])`;
}

/** 최근에 **읽은** 장과 그 안의 제목들 — 이어 붙이기 재료 */
export async function getRecentlyRead(userId: number, moduleKey: string): Promise<ReadRef[]> {
  const sql = requireSql();
  const rows = (await sql`
    select b.id, b.created_at, si.title
    from briefings b
    join source_items si on si.briefing_id = b.id
    where b.user_id = ${userId}
      and b.module_key = ${moduleKey}
      and b.read_at is not null
      and b.created_at > now() - (${THREAD_LOOKBACK_DAYS} || ' days')::interval
    order by b.created_at desc
    limit ${THREAD_MAX_ROWS}`) as { id: number; created_at: string; title: string | null }[];

  const byBriefing = new Map<number, ReadRef>();
  const now = Date.now();
  for (const r of rows) {
    if (!r.title) continue;
    let ref = byBriefing.get(r.id);
    if (!ref) {
      const daysAgo = Math.max(0, Math.round((now - new Date(r.created_at).getTime()) / 86_400_000));
      ref = { briefingId: r.id, daysAgo, titles: [] };
      byBriefing.set(r.id, ref);
    }
    ref.titles.push(r.title);
  }
  return [...byBriefing.values()];
}

/** thread_of가 실재하는 장을 가리키는지 — LLM이 지어낸 번호를 그대로 넣지 않기 위해 */
export async function briefingExists(
  userId: number,
  id: number,
  moduleKey: string,
): Promise<boolean> {
  const sql = requireSql();
  const rows = (await sql`
    select 1 from briefings
    where user_id = ${userId} and id = ${id} and module_key = ${moduleKey} limit 1`) as unknown[];
  return rows.length > 0;
}

/**
 * 아이템을 "본 적 없음"으로 되돌린다 — 탐험형 전용.
 *
 * 모델이 변덕으로 SKIP하면 그 회차에 뽑힌 문서가 카드 없이 "봤음"으로 남아
 * 풀에서 영영 빠진다(실측: level-965, 5천 자짜리 정상 문서). 뉴스는 그 시간이
 * 지나면 어차피 소용없지만 탐험형 풀은 유한하다 — 되돌려서 다음 기회를 준다.
 */
export async function forgetItems(
  userId: number,
  moduleKey: string,
  externalIds: string[],
): Promise<void> {
  if (externalIds.length === 0) return;
  const sql = requireSql();
  await sql`
    delete from source_items
    where user_id = ${userId} and module_key = ${moduleKey}
      and external_id = any(${externalIds}::text[])
      and briefing_id is null`;
}

/**
 * 아직 카드에 실은 적 없는 external_id만 남긴다.
 *
 * 탐험형 모듈이 쓴다. 뉴스형은 "수집한 것 전부"를 upsert하고 충돌로 거르면
 * 되지만, 탐험형은 후보 풀에서 **한 줌만 골라** 본문까지 가져와야 해서,
 * 고르기 전에 이미 보여준 것을 빼야 한다. 풀 전체를 upsert해 버리면
 * 안 실린 후보까지 "봤음"이 되어 두 번 다시 안 나온다.
 */
export async function filterUnseen(
  userId: number,
  moduleKey: string,
  externalIds: string[],
): Promise<string[]> {
  if (externalIds.length === 0) return [];
  const sql = requireSql();
  const rows = (await sql`
    select external_id from source_items
    where user_id = ${userId} and module_key = ${moduleKey}
      and external_id = any(${externalIds}::text[])`) as {
    external_id: string;
  }[];
  const seen = new Set(rows.map((r) => r.external_id));
  return externalIds.filter((id) => !seen.has(id));
}

/** 이 모듈의 안 읽은 장 수 — 탐험형 모듈의 리필 판단(queueCap)에 쓴다 */
export async function countUnreadFor(userId: number, moduleKey: string): Promise<number> {
  const sql = requireSql();
  const rows = (await sql`
    select count(*)::int as n from briefings
    where user_id = ${userId} and module_key = ${moduleKey} and status = 'ok'
      and read_at is null and archived_at is null`) as { n: number }[];
  return rows[0]?.n ?? 0;
}

/** 오늘 이 모듈의 ok 장 수 — 비용 가드 */
export async function countTodayOk(userId: number, moduleKey: string): Promise<number> {
  const sql = requireSql();
  const rows = (await sql`
    select count(*)::int as n from briefings
    where user_id = ${userId} and module_key = ${moduleKey} and status = 'ok'
      and created_at > now() - interval '24 hours'`) as { n: number }[];
  return rows[0]?.n ?? 0;
}

/** 모듈의 가장 최근 장 상태 — 같은 실패를 회차마다 새 행으로 쌓지 않으려고 본다 */
export async function lastBriefingState(
  userId: number,
  moduleKey: string,
): Promise<{ status: string; error: string | null } | null> {
  const sql = requireSql();
  const rows = (await sql`
    select status, error from briefings
    where user_id = ${userId} and module_key = ${moduleKey}
    order by created_at desc limit 1`) as { status: string; error: string | null }[];
  return rows[0] ?? null;
}

/** 오래 묵은 미독을 큐에서 내린다(지우지는 않는다). 되꺼낸 장은 하루 유예. */
export async function archiveStale(userId: number): Promise<number> {
  const sql = requireSql();
  const rows = (await sql`
    update briefings set archived_at = now()
    where user_id = ${userId}
      and read_at is null and archived_at is null
      and created_at < now() - (${QUEUE_TTL_DAYS} || ' days')::interval
      and (resurfaced_at is null or resurfaced_at < now() - interval '1 day')
    returning id`) as unknown[];
  return rows.length;
}

export async function countUnread(userId: number): Promise<number> {
  const sql = requireSql();
  const rows = (await sql`
    select count(*)::int as n from briefings
    where user_id = ${userId} and status = 'ok'
      and read_at is null and archived_at is null`) as { n: number }[];
  return rows[0]?.n ?? 0;
}

/**
 * 큐가 비었고 새로 쌓인 것도 없을 때 다시 꺼낼 후보 — 안 읽고 내려간 것 중 최신.
 * 새것으로 위장하지 않는다. resurfaced_at이 찍히면 화면이 "N일 전 것"이라고 밝힌다.
 */
export async function resurfaceOne(userId: number): Promise<Briefing | null> {
  const sql = requireSql();
  const rows = (await sql`
    update briefings set archived_at = null, resurfaced_at = now()
    where id = (
      select id from briefings
      where user_id = ${userId} and status = 'ok' and read_at is null
        and archived_at is not null and resurfaced_at is null
        and kind = 'live'
      order by created_at desc
      limit 1
    )
    returning id, module_key, kind, item_count, content, status, error,
              est_read_seconds, thread_of, thread_note,
              read_at, archived_at, resurfaced_at, created_at`) as Briefing[];
  return rows[0] ?? null;
}

/** 오늘 하루 끝 장을 이미 만들었나 (18시 1회 — 20시간 창이면 겹칠 일이 없다) */
export async function hasRecentWrap(userId: number): Promise<boolean> {
  const sql = requireSql();
  const rows = (await sql`
    select 1 from briefings
    where user_id = ${userId} and kind = 'wrap'
      and created_at > now() - interval '20 hours'
    limit 1`) as unknown[];
  return rows.length > 0;
}

/** 오늘 읽은 장들의 본문 — 하루 끝 한 장의 재료 */
export async function getTodayRead(
  userId: number,
): Promise<{ module_key: string; content: string | null }[]> {
  const sql = requireSql();
  const rows = (await sql`
    select module_key, content from briefings
    where user_id = ${userId} and kind = 'live'
      and read_at > now() - interval '14 hours'
    order by read_at asc`) as { module_key: string; content: string | null }[];
  return rows;
}
