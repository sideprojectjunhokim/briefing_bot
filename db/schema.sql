-- 브리핑봇 스키마 (Neon Postgres)
--
-- 전부 idempotent — 여러 번 돌려도 안전하다. `npm run db:push`가 이 파일을
-- 세미콜론 기준으로 잘라 순서대로 실행하므로, 함수 정의($$ 블록)는 넣지 마라.
--
-- 축은 briefings.read_at 하나다(C-13). 읽기 단위는 "안 읽은 것" 전부이고,
-- 큐에 있다/없다를 정하는 건 이 컬럼과 archived_at 둘뿐이다.

-- ─────────────────────────────────────────────────────────────
-- briefings — 종이 한 장. 한 회차 수집에서 한 모듈이 건진 것 묶음.
-- ─────────────────────────────────────────────────────────────
create table if not exists briefings (
  id           bigint generated always as identity primary key,
  module_key   text not null,                 -- 'hotdeal' | 'market' | 'technews' | 'community' | 'wrap'
  kind         text not null default 'live',  -- 'live' = 수집분 | 'wrap' = 하루 끝 한 장
  item_count   int  not null default 0,
  content      text,                          -- 리드 문단 + 마크다운 불릿 (LLM 또는 template)
  status       text not null default 'ok',    -- 'ok' | 'failed' | 'skipped_empty'
  error        text,

  -- 읽는 비용을 먼저 알려준다. 코드가 글자 수로 계산 — LLM 안 씀.
  est_read_seconds int not null default 0,

  -- 이어 붙이기: 이 장이 예전에 읽은 어느 장의 후속인지.
  thread_of    bigint references briefings(id) on delete set null,
  thread_note  text,                          -- "사흘 전에 본 React 컴파일러 이야기, 오늘 후속이 나왔다"

  -- 큐 상태 3종.
  --   read_at       읽었다 → 큐에서 빠짐
  --   archived_at   너무 오래 안 읽음 → 큐에서 내림(지우지는 않음). 큐가 무한히 자라면
  --                 읽을거리가 아니라 밀린 숙제가 된다
  --   resurfaced_at 아카이브에서 다시 꺼낸 시각. non-null이면 화면에 "N일 전 것"이라고 밝힌다
  read_at       timestamptz,
  archived_at   timestamptz,
  resurfaced_at timestamptz,

  created_at   timestamptz not null default now()
);

-- 큐 조회 전용 부분 인덱스 — 홈이 매번 때리는 유일한 쿼리다
create index if not exists briefings_queue_idx
  on briefings (created_at desc)
  where status = 'ok' and read_at is null and archived_at is null;

create index if not exists briefings_module_created_idx
  on briefings (module_key, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- source_items — 수집 아이템 (중복제거의 SSOT)
-- ─────────────────────────────────────────────────────────────
create table if not exists source_items (
  id           bigint generated always as identity primary key,
  module_key   text not null,
  external_id  text not null,                 -- '<origin>:<id>' — 사이트 간 게시글 번호 겹침 방지
  url          text,
  title        text,
  payload      jsonb not null default '{}',
  -- 이 아이템이 실린 장. null이면 수집만 되고 선별에서 떨어진 것.
  -- 이어 붙이기가 "읽은 장에 뭐가 들어 있었나"를 되짚는 경로다.
  briefing_id  bigint references briefings(id) on delete set null,
  collected_at timestamptz not null default now(),
  unique (module_key, external_id)
);

create index if not exists source_items_module_collected_idx
  on source_items (module_key, collected_at desc);

create index if not exists source_items_briefing_idx
  on source_items (briefing_id);

-- ─────────────────────────────────────────────────────────────
-- module_prefs — 실제 행동에서 배운 것. 설정 화면이 아니다.
-- 연속으로 건너뛴 모듈을 발견하면 nudged_at을 찍고 화면에서 한 번 물어본다.
-- 답을 안 하면 아무것도 안 바뀐다 — 조용히 줄이지 않는다.
-- ─────────────────────────────────────────────────────────────
create table if not exists module_prefs (
  module_key text primary key,
  pick_max   int     not null default 8,      -- LLM이 한 장에 담을 수 있는 항목 상한
  muted      boolean not null default false,  -- true면 수집 자체를 건너뜀
  nudged_at  timestamptz,                     -- 마지막으로 "줄일까요?" 물어본 시각
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- topics — 검색으로 채우는 관심사.
--
-- 손으로 소스를 붙인 모듈(핫딜·시세·테크뉴스·커뮤니티)은 코드에 있고
-- module_prefs가 관리한다. 그 밖의 관심사는 전부 여기 들어온다 — 프리셋에서
-- 고른 것이든 사용자가 직접 친 것이든 같은 경로다. "직접 추가"를 특별
-- 케이스로 만들면 그것만 계속 깨진다.
--
-- 채우는 방법은 검색 한 가지다(Google 뉴스 RSS). 임의 키워드에 붙고,
-- 키가 필요 없고, 돈이 안 든다.
-- ─────────────────────────────────────────────────────────────
create table if not exists topics (
  key        text primary key,               -- briefings.module_key로 그대로 쓴다
  label      text not null,                  -- 화면에 보이는 이름
  query      text not null,                  -- 검색어
  custom     boolean not null default false, -- 사용자가 직접 친 것인가
  pick_max   int     not null default 5,     -- 한 장에 담을 항목 상한
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists topics_enabled_idx on topics (enabled);

-- ─────────────────────────────────────────────────────────────
-- 기존 DB에 컬럼만 얹을 때를 위한 보정 (이미 있으면 무시됨)
-- ─────────────────────────────────────────────────────────────
alter table briefings add column if not exists kind text not null default 'live';
alter table briefings add column if not exists est_read_seconds int not null default 0;
alter table briefings add column if not exists thread_of bigint references briefings(id) on delete set null;
alter table briefings add column if not exists thread_note text;
alter table briefings add column if not exists read_at timestamptz;
alter table briefings add column if not exists archived_at timestamptz;
alter table briefings add column if not exists resurfaced_at timestamptz;
alter table source_items add column if not exists briefing_id bigint references briefings(id) on delete set null;

-- 별표 = "이건 더 많이 보고 싶다". pick_max는 별표를 반영한 **실효값**이고,
-- starred는 화면이 별을 다시 그리려고 따로 들고 있는 상태다. pick_max가 기본값보다
-- 크다는 걸로 역산하면 기본값을 바꾸는 순간 별이 제멋대로 켜지고 꺼진다.
alter table topics add column if not exists starred boolean not null default false;
alter table module_prefs add column if not exists starred boolean not null default false;
