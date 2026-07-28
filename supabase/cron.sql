-- cron.sql — pg_cron + pg_net으로 briefing-job 주기 호출 (Phase 2)
-- ※ 마이그레이션 아님. 프로젝트별 URL/시크릿이 들어가므로 SQL 에디터에서 수동 실행.
-- <PROJECT_REF> 와 <JOB_SECRET> 를 실제 값으로 치환.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 모듈별 잡 분리(실행시간 제한 회피 + 격리). 08:00 KST = 23:00 UTC.
-- v1은 technews 1개. 모듈 추가 시 아래 블록 복제(분(minute)만 1~2씩 밀어 간격).

select cron.schedule(
  'briefing-technews',
  '0 23 * * *',                    -- 매일 08:00 KST
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/briefing-job',
    headers := jsonb_build_object(
                 'content-type', 'application/json',
                 'x-job-secret', '<JOB_SECRET>'),
    body    := jsonb_build_object('module', 'technews')
  );
  $$
);

-- Phase 3에서 소스 채우고 아래 주석 해제 (분(minute)을 1~2씩 밀어 격리).
-- select cron.schedule('briefing-market',    '1 23 * * *', $$ ... 'module','market'    ... $$);
-- select cron.schedule('briefing-hotdeal',   '2 23 * * *', $$ ... 'module','hotdeal'   ... $$);
-- select cron.schedule('briefing-community', '3 23 * * *', $$ ... 'module','community' ... $$);

-- source_items 14일 정리 (Phase 5)
select cron.schedule(
  'cleanup-source-items',
  '30 23 * * *',
  $$ delete from source_items where collected_at < now() - interval '14 days'; $$
);

-- 잡 목록 확인:  select * from cron.job;
-- 잡 삭제:      select cron.unschedule('briefing-technews');
