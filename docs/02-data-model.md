# 02. 데이터 모델

## 설계 원칙

- **웹 버전(07-15 피벗):** 배송이 없어져 `subscribers`(chat_id) 테이블은 **삭제.** v1은 단일 사용자라 모듈 on/off·정렬은 웹 localStorage로 충분. 다중 사용자 공개 시 Supabase Auth + `preferences` 테이블로 승격(확장 예약).
- 모듈 목록·소스 설정은 v1에서 **코드 상수**로 관리(테이블 아님). 니치 모듈이 잦아지면 테이블 승격.
- 마이그레이션은 `supabase/migrations/*.sql`, `supabase db push`로 적용. 런타임 DDL 금지(goldsilver 교훈).

## 테이블 (2개)

### source_items — 수집 아이템 (중복제거의 SSOT)
```sql
create table source_items (
  id           bigint generated always as identity primary key,
  module_key   text not null,                      -- 'hotdeal' | 'market' | 'technews' | 'community'
  external_id  text not null,                      -- 원천 고유 ID (URL 해시 또는 게시글 ID)
  url          text,
  title        text,
  payload      jsonb not null default '{}',        -- 가격·추천수 등 모듈별 원시 데이터
  collected_at timestamptz not null default now(),
  unique (module_key, external_id)
);
create index on source_items (module_key, collected_at desc);
```
- upsert 시 conflict가 나면 "이미 본 아이템" → 브리핑에서 제외. 이것이 중복제거 전부다.
- 보존 14일. 정리는 pg_cron 별도 잡(`delete where collected_at < now() - interval '14 days'`).
- market 모듈처럼 "스냅샷"성 데이터는 external_id를 `KRW-BTC:2026-07-15`처럼 날짜 포함으로 만들어 하루 1회만 수집되게 한다.

### briefings — 브리핑 결과 (웹 표시 SSOT + 관측 + 비용 가드)
```sql
create table briefings (
  id          bigint generated always as identity primary key,
  module_key  text not null,                       -- 'hotdeal' | 'market' | 'technews' | 'community'
  item_count  int not null default 0,
  content     text,                                -- 웹에 렌더할 본문 (HTML 또는 마크다운)
  status      text not null default 'ok',          -- 'ok' | 'failed' | 'skipped_empty'
  error       text,
  created_at  timestamptz not null default now()
);
create index on briefings (module_key, created_at desc);
```
- **웹 표시:** 모듈별 `created_at desc` 최신 1행을 카드로 렌더. status='ok'만 카드로, 'failed'는 상단 배너로 노출.
- **비용 가드:** briefing-job 시작 시 "오늘 이 모듈 ok 행 수 ≥ N(기본 3)"이면 중단. 루프 버그로 인한 LLM 과금 폭주 방지.

## RLS

- 쓰기는 Edge Function(service role)만 — RLS 우회하므로 기능 영향 없음.
- **웹이 anon 키로 읽으므로** `briefings`에만 `for select to anon using (true)` 정책 1개(공개 정보라 안전). `insert/update/delete` 정책은 없음 → anon 쓰기 전면 차단.
- `source_items`는 정책 0개(= anon 전면 차단). 웹은 이 테이블을 읽지 않는다.
- 두 테이블 모두 `enable row level security`. Supabase advisor 경고 안 뜨게.

## 확장 예약 (지금 안 만듦)

- `preferences` + Supabase Auth — 다중 사용자 공개 시 모듈 on/off를 서버 상태로(현재 localStorage).
- `module_configs` — 니치 모듈 3개↑면 소스 URL·활성·프롬프트를 데이터로.
- `watchlists` — market 개인화(사용자별 관심 종목/코인).
