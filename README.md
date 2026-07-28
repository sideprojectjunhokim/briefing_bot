# 브리핑 봇 (briefing-bot)

매일 아침 "내가 볼 것들"을 요약해 **웹 대시보드**로 보여주는 개인용 브리핑 도구.
핫딜 · 주식/코인 · 테크 뉴스 · 커뮤니티 인기글 4개 모듈로 시작하고, 니치 시세(위스키/레고 등)는 플러그인 모듈로 나중에 추가한다.

> **07-15 피벗:** 배송 채널을 텔레그램 봇 → 웹으로 변경. 봇 토큰·웹훅이 사라져 "briefing-job이 DB에 쌓고 → 웹이 읽어 카드로 표시" 구조로 단순화. 푸시 알림은 백로그(PWA Web Push).

## 하드 제약

- **서버 0개.** 관리할 인스턴스/VM/컨테이너 없음. Supabase(pg_cron + Edge Function) + Vercel(정적/ISR)로만 동작.
- 재미 우선, 수익은 보너스. 운영비 월 몇천 원 이하 목표(사실상 Anthropic API 비용뿐).

## 스택

- **데이터/수집:** Supabase Postgres + pg_cron + pg_net + Edge Function `briefing-job`(Deno TS)
- **요약:** Claude Haiku (`claude-haiku-4-5`)
- **웹:** Next.js (App Router) on Vercel, supabase-js anon 읽기

## 저장소 레이아웃

```
briefing-bot/
├─ web/            Next.js 대시보드 (Vercel 배포)
├─ supabase/
│  ├─ migrations/  SQL 스키마
│  └─ functions/
│     ├─ briefing-job/     수집→요약→저장 Edge Function
│     └─ _shared/          modules(types·sources), summarize, db
└─ docs/           설계 문서 (아래)
```

## 문서 인덱스

| 문서 | 내용 |
|------|------|
| [docs/01-architecture.md](docs/01-architecture.md) | 웹 아키텍처 — 컴포넌트, 데이터 흐름, 제약/리스크 |
| [docs/02-data-model.md](docs/02-data-model.md) | DB 스키마(source_items·briefings) + RLS |
| [docs/03-source-modules.md](docs/03-source-modules.md) | Module≠Source 2계층 플러그인 + v1 모듈 4종 |
| [docs/04-web-ux.md](docs/04-web-ux.md) | 웹 대시보드 레이아웃·상호작용 |
| [docs/05-roadmap.md](docs/05-roadmap.md) | **단계별 작업 체크리스트 (Phase 0~5)** |
| [docs/06-decisions.md](docs/06-decisions.md) | 결정된 것 / 미결 사항 |

## 현재 상태

- 2026-07-03: 아이디어 확정 (사이드프로젝트 1순위)
- 2026-07-15: 설계 v1 → 웹 피벗 → **코드 스캐폴딩 시작** ← 지금 여기
- 다음: Phase 0 계정 셋업(Supabase·Vercel·Anthropic 키) 후 배포
