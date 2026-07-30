# 01. 아키텍처

> **07-28 개정:** 용도가 "매일 아침 1회 브리핑"에서 **"일하는 중에 한 시간마다 읽을거리 하나"**로 바뀌었다.
> 그에 따라 (1) 시계가 pg_cron → GitHub Actions, (2) DB가 Supabase → Neon, (3) 수집 코드가 Deno Edge Function → Next.js route handler로 옮겨졌다.
> `supabase/` 아래 코드는 배포된 적도 실행된 적도 없이 폐기됐다.

## 한 장 요약

```
   GitHub Actions (cron: KST 9~17시 2시간 간격 5회)  ← 시계. 저장소가 이미 여기 있다
        │  POST /api/collect
        │  authorization: Bearer CRON_SECRET
        ▼
   Vercel — Next.js
   ┌──────────────────────────────────────────────┐
   │  /api/collect   수집 → 중복제거 → 선별 → 저장  │
   │  /api/read      읽음 표시 (큐에서 빼기)        │
   │  /api/prefs     건너뛰기 알림에 대한 답        │
   │  /api/login     비밀번호 게이트                │
   │  /  ·  /c/[key] 화면 (전부 force-dynamic)      │
   └───────────┬──────────────────┬───────────────┘
      외부 소스 fetch        Claude Haiku
     (RSS·공개 API·HTML)     (리드 문단 + 선별)
               │
               ▼
   ┌──────────────────────────────────────────────┐
   │  Neon Postgres (무료, 개인 계정)               │
   │   briefings     — 종이 한 장. read_at가 축     │
   │   source_items  — 중복제거 SSOT                │
   │   module_prefs  — 행동에서 배운 것             │
   └──────────────────────────────────────────────┘
                       ▼
               내 브라우저 (읽으러 온다)
```

서버는 여전히 0개. cron 발화 때만 깨는 Actions 러너 하나 + Vercel의 서버리스 렌더뿐이다.

## 왜 이 조합인가 (다른 걸 못 쓴 이유)

| 후보 | 왜 안 되나 |
|---|---|
| Supabase | 무료 활성 프로젝트가 계정당 2개인데 CAS·금은마켓이 이미 다 씀. 신규 생성 불가 |
| Vercel Cron | Hobby는 **하루 1회가 상한**(프로젝트당 100개, 최소 주기 1일, 정확도 ±59분). 시간당은 Pro($20/월)부터 |
| Cloudflare | 계정이 회사 것(금은마켓 앱이 R2를 씀). 사이드 프로젝트를 회사 계정에 얹지 않는다 |
| **GitHub Actions** | **채택.** 비공개 저장소 월 2,000분, 하루 5회면 월 ~150분. 저장소가 이미 여기 있어 새 계정이 안 는다 |

CAS 프로젝트에 스키마만 얹는 방법은 쓰지 않는다 — CAS는 곧 결제와 출생 개인정보가 들어가고, 사이드 프로젝트 cron이 커넥션을 물면 그쪽이 멈춘다.

## 컴포넌트

### 시계 — `.github/workflows/collect.yml`
- `cron: "0 0,2,4,6,8 * * *"`(KST 9·11·13·15·17시) + `workflow_dispatch`(모듈 지정 가능). 하는 일은 curl 한 번이 전부다.
- **정시에 안 돈다.** GitHub 부하에 따라 5~20분 밀린다. "정각"을 전제로 설계하지 않는다.
- **저장소가 60일 무활동이면 스케줄이 자동 비활성화된다.** 혼자 쓰는 저장소라 실제로 걸릴 수 있고, Actions 탭에서 다시 켜면 된다.
- 07-30: 매시(24회/일)에서 9~17시 2시간 간격(5회/일)으로 줄임(C-25) — 퇴근(18시) 전까지만 돈다.

### 수집 — `web/lib/collect/*` + `/api/collect`
- 파이프라인: **묵은 미독 내리기 → 소스 fetch → 중복제거 → 선별·리드 생성 → 저장**.
- **그 시간에 건질 게 없으면 아무것도 안 쌓는다.** 예전 설계는 빈 회차마다 `skipped_empty` 행을 남겼는데, 예전 매시 기준으로도 하루 96행이라 넣지 않기로 한 결정이 지금(하루 5회)도 그대로 유효하다.
- 실패는 행으로 남기되 **같은 실패는 하나만** 세워 둔다(같은 실패 행을 매 회차 쌓지 않는다).
- 격리 2중: 모듈별 try/catch + 소스별 try/catch.
- 비용 가드: 모듈당 24시간 내 `ok` 행 5개가 상한(하루 5회 = 정상 상한, C-25).

### 화면 — Next.js
- `/` = **안 읽은 큐**. `/c/[key]` = 모듈 하나의 지난 장들.
- 둘 다 `force-dynamic`. 읽음 상태가 매번 달라져서 ISR 캐시를 쓰면 방금 읽은 게 다시 올라온다.
- 접근은 `APP_PASSWORD` 쿠키 게이트(`web/middleware.ts`). 읽음 표시가 서버 상태를 바꾸므로 필요해졌다.

### 외부 의존
| 대상 | 용도 | 인증 |
|---|---|---|
| Claude Haiku (`claude-haiku-4-5`) | 선별 + 리드 문단 | `ANTHROPIC_API_KEY` |
| 각 소스 사이트 (03 문서) | RSS/API/HTML | 없음 (공개) |
| Neon | Postgres | `DATABASE_URL` |
| Vercel | 웹 + 수집 실행 | — |
| GitHub Actions | 시계 | `CRON_SECRET`, `BASE_URL` (repo secrets) |

### Secrets
- **Vercel env:** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `APP_PASSWORD`
- **GitHub repo secrets:** `BASE_URL`, `CRON_SECRET`
- `NEXT_PUBLIC_*`는 하나도 없다. 전부 서버 전용 값이다.

## 데이터 흐름

**수집(9~17시 2시간 간격 5회, 자동)**
1. Actions가 `/api/collect`를 POST.
2. 하루 넘게 안 읽힌 장을 `archived_at`으로 큐에서 내린다(C-25, 예전엔 3일).
3. 모듈별로 소스 fetch → `source_items` upsert(충돌 = 이미 봄) → 신규만 남긴다.
4. 신규 0개면 **아무것도 안 만들고 넘어간다.**
5. 신규가 있으면 Haiku 1회 호출 → 리드 + 항목. 모델이 `SKIP`이라고 하면 그것도 안 만든다.
6. 17시대(KST, 그날 마지막 회차)에 오늘 **읽은** 장이 있으면 하루 끝 한 장(`kind='wrap'`)을 만든다.
7. 이번에 만든 것도 없고 큐도 비었으면 아카이브에서 한 장을 되꺼낸다(`resurfaced_at`).

**표시(아무 때나)**
8. 홈 접속 → 안 읽은 것 전부를 시간 역순으로 → 열면 `/api/read`가 `read_at`을 찍는다.

## 제약·리스크

| 리스크 | 내용 | 대응 |
|---|---|---|
| 스케줄 지연 | Actions가 5~20분 밀림 | 정각 전제 없음. wrap도 "17시대"로 판정 |
| 60일 무활동 비활성화 | 혼자 쓰는 저장소 | Actions 탭에서 재활성. 걱정되면 주 1회 빈 커밋 |
| Vercel 함수 60초 | 소스 넷 × (fetch + LLM) | `maxDuration=60`, RSS fetch 12초 타임아웃 |
| 스크래핑 차단 | HTML 소스 | 소스별 격리, 막히면 `enabled=false` |
| LLM 비용 | 호출이 하루 최대 5회(모듈당) | 모듈당 5회/일 가드(C-25) + `maxInput`으로 입력 상한 고정 |
| 큐 무한 증식 | 안 읽으면 계속 쌓임 | 하루 뒤 자동 아카이브(C-25, 예전엔 3일) — 읽을거리가 밀린 숙제가 되면 안 연다 |
| 접근 통제 | 읽음 표시가 서버 상태 변경 | `APP_PASSWORD` 쿠키 게이트 |

## 저장소·배포
- GitHub private repo `sideprojectjunhokim/briefing_bot`: `/web`(Next.js) + `/db`(schema.sql) + `/docs`.
- Vercel: Root Directory = `web`, GitHub 연동 자동배포.
- 스키마: `cd web && npm run db:push` (`db/schema.sql`은 전부 idempotent).
