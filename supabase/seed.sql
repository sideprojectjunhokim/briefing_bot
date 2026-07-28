-- seed.sql — Phase 1 웹 카드 렌더 확인용 샘플 브리핑 1행.
-- 실제 수집 전에 웹이 카드를 그리는지 검증하고 지운다.
insert into briefings (module_key, item_count, content, status) values
('technews', 3,
'- [Deno 3.0 발표](https://example.com/a) — Node 호환 레이어가 기본 활성화되어 마이그레이션이 쉬워졌다.
- [Postgres 18 베타](https://example.com/b) — 비동기 I/O 도입으로 대용량 스캔 지연이 줄었다.
- [Bun 1.2](https://example.com/c) — 내장 테스트 러너와 번들러 성능이 개선됐다.',
'ok');
