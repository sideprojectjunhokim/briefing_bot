# 05. 로드맵 — 단계별 작업 체크리스트 (웹 버전)

각 Phase는 "끝나면 실제로 뭔가 동작하는" 단위. Phase 2가 끝나면 아침에 웹을 열면 테크뉴스 브리핑 카드가 떠 있다.
**스캐폴딩(코드 골격)은 계정 없이 미리 작성** — Phase 0의 계정/키만 채우면 배포된다.

## Phase 0 — 계정·셋업 (반나절, 사용자 손 필요)

- [ ] Supabase **신규** 프로젝트 생성 (goldsilver와 분리, Free tier) → URL·anon key·service key 확보
- [ ] Anthropic API 키 발급(개인용 분리) + 월 지출 한도 설정
- [ ] GitHub private repo `briefing-bot` 생성 + push
- [ ] Vercel 프로젝트 생성, GitHub 연동, root=`web/`
- [ ] 로컬: `supabase link` → `supabase secrets set ANTHROPIC_API_KEY JOB_SECRET`
- [ ] Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**완료 기준:** `supabase functions list` 동작 + Vercel 빈 페이지 배포됨.

## Phase 1 — 스키마 + 웹 골격 (반나절)

- [ ] 마이그레이션 1: `source_items` + `briefings` + RLS(briefings anon select) (02 문서)
- [ ] `web/` Next.js 앱: 홈 페이지, supabase anon 클라이언트, 모듈 카드 컴포넌트(빈 상태)
- [ ] 시드 briefings 1~2행 넣고 카드가 렌더되는지 확인
- [ ] Vercel 배포 → 실제 URL에서 카드 보임

**완료 기준:** 배포된 웹에서 시드 브리핑 카드가 보인다.

## Phase 2 — 브리핑 MVP: technews 1개 모듈 (1일) ★핵심

- [ ] `_shared/` 공통 코드: types(Module/Source), supabase(service) 클라이언트, summarize(Haiku 호출), sanitize
- [ ] `technews` 모듈 + `geeknews` Source: RSS 파싱 → RawItem[]
- [ ] `briefing-job` 함수: 파이프라인(수집→중복제거→요약→briefings INSERT) + JOB_SECRET 검증 + 비용 가드
- [ ] 수동 호출(curl + x-job-secret)로 briefings 행 생성 확인 → 웹에 카드 뜨는지 확인
- [ ] **연속 2회 호출 시 2번째는 skipped_empty인지 확인 (중복제거 검증)**
- [ ] pg_cron + pg_net 활성화, 잡 등록: `0 23 * * *` (= 08:00 KST)
- [ ] 다음날 아침 자동 수집 → 웹에 최신 카드 반영 확인

**완료 기준:** 사람 개입 없이 아침에 웹을 열면 테크뉴스 브리핑이 최신으로 떠 있다.

## Phase 3 — 나머지 모듈 3종 + 소스 확장 (2~3일, 모듈·소스 독립 작업)

각 모듈은 "소스 1개로 모듈 완성 → 소스를 하나씩 추가"로 간다(C-9/C-10). Source→Module 2계층이라 소스 추가는 파일1+배열1줄.

- [ ] Source→Module 2계층 골격: `Source` 인터페이스, 소스별 try/catch, `origin` 접두 external_id
- [ ] `market`: Upbit ticker + 지수 소스(D-3) → template 렌더 (소스 여러 개지만 숫자라 통합 단순)
- [ ] `hotdeal`: 뽐뿌 RSS로 모듈 완성 → 퀘이사존·루리웹핫딜 소스 순차 추가
- [ ] `community`: 클리앙으로 모듈 완성 → 루리웹·보배드림 추가 → (후순위·방어강함) 에펨·더쿠 시도, 막히면 enabled=false
- [ ] cron을 모듈별 4개 잡으로 분리 (1~2분 간격)
- [ ] 2중 격리 확인: 소스 하나 죽여도 같은 모듈 다른 소스 정상 / 모듈 하나 죽여도 다른 모듈 정상 + 관리자 에러 알림

**완료 기준:** 아침에 최대 4개 메시지, 소스/모듈 하나가 죽어도 나머지 전부 도착.

## Phase 4 — 웹 대시보드 완성 (1일)

- [ ] 모듈 카드 스타일링(다크·밀도·모바일 반응형, 04 문서)
- [ ] 모듈 on/off 토글(localStorage) — 카드 표시/숨김
- [ ] failed 배너 + skipped_empty 숨김 처리
- [ ] "새로고침" 재조회 + content sanitize(XSS 방지)

## Phase 5 — 운영 안정화 (반나절)

- [ ] source_items 14일 정리 cron 잡
- [ ] 비용 가드 실동작 확인 (하루 N회째 호출 거부)
- [ ] cron 모듈별 4개 잡 분리 최종 확인
- [ ] README에 운영 런북: secrets 로테이션, cron 잡 목록 확인 SQL, 소스 on/off 방법

## Backlog (착수 안 함, 재론 트리거 있을 때만)

- **PWA Web Push** — "아침 알림"이 필요해지면. 서버 0개 유지 가능(웹푸시 구독+cron에서 발송)
- 니치 모듈: 위스키/레고 시세 (Source 1개 추가로 되는지가 설계 검증)
- 다중 사용자 공개: Supabase Auth + preferences 테이블(현 localStorage 승격)
- 온디맨드 수집: 웹에서 briefing-job 트리거(보호 토큰 필요)
- 주간 다이제스트 (일요일 저녁, 한 주 요약)
- Hacker News 소스 추가 (technews 2번째 소스)
