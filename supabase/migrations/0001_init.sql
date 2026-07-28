-- 0001_init.sql — briefing-bot 초기 스키마
-- source_items(중복제거 SSOT) + briefings(웹 표시 SSOT)

-- 수집 아이템: (module_key, external_id) 유니크로 "이미 본 것" 판별
create table if not exists source_items (
  id           bigint generated always as identity primary key,
  module_key   text not null,
  external_id  text not null,          -- '<origin>:<id>' 형식 (사이트 간 충돌 방지)
  url          text,
  title        text,
  payload      jsonb not null default '{}',
  collected_at timestamptz not null default now(),
  unique (module_key, external_id)
);
create index if not exists source_items_module_collected_idx
  on source_items (module_key, collected_at desc);

-- 브리핑 결과: 모듈별 최신 1행을 웹이 카드로 렌더
create table if not exists briefings (
  id          bigint generated always as identity primary key,
  module_key  text not null,
  item_count  int  not null default 0,
  content     text,                    -- 웹 렌더용 본문(마크다운/HTML)
  status      text not null default 'ok',   -- 'ok' | 'failed' | 'skipped_empty'
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists briefings_module_created_idx
  on briefings (module_key, created_at desc);

-- 모듈별 최신 브리핑 뷰 (웹은 이걸 1쿼리로 읽음)
-- security_invoker=on: 뷰가 호출자 권한으로 실행 → RLS 우회/definer 경고 방지
create or replace view latest_briefings
with (security_invoker = true) as
select distinct on (module_key) *
from briefings
order by module_key, created_at desc;

-- RLS: 쓰기는 service role(우회)만. 웹 anon은 briefings 읽기만.
alter table source_items enable row level security;
alter table briefings   enable row level security;

-- source_items: 정책 0개 = anon/authenticated 전면 차단
-- briefings: anon SELECT 허용(공개 정보). 쓰기 정책 없음 → 쓰기 차단
drop policy if exists briefings_anon_read on briefings;
create policy briefings_anon_read on briefings
  for select to anon, authenticated using (true);
