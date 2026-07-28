# 01. 아키텍처 (웹 버전)

> **07-15 피벗:** 배송 채널을 텔레그램 봇 → **웹 대시보드**로 변경(C-2 개정, 06 문서 Deviation). 봇 토큰·웹훅·메시지 길이제한·채널별 포맷이 전부 사라져 오히려 단순해짐. "briefing-job이 DB에 쌓고 → 웹이 읽어 카드로 표시" 두 조각이 전부.

## 한 장 요약

```
   pg_cron ──(pg_net http_post)──▶  Edge Function  briefing-job
   (매일 아침)                        - 모듈별 수집 → 중복제거 → 요약 → briefings 저장
                                     - 발송(sendMessage) 없음. DB에 쓰고 끝.
                          ┌──────────┴───────────┐
                    외부 소스 fetch          Claude Haiku API
                 (RSS·공개 API·HTML)          (요약 생성)

   ┌─────────────────────────────────────────────────────────┐
   │  Supabase Postgres                                        │
   │   - source_items(중복제거) / briefings(표시 SSOT)          │
   │   - pg_cron + pg_net                                       │
   │   - RLS: briefings 는 anon SELECT 허용(공개 정보), 쓰기 차단 │
   └───────────────────────────┬─────────────────────────────┘
                               │ supabase-js (anon key, 읽기 전용)
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Next.js on Vercel  (정적/ISR — 상시 프로세스 0개)          │
   │   - 모듈별 최신 브리핑 카드 렌더                             │
   │   - 모듈 on/off 토글(localStorage, 단일 사용자)             │
   │   - "새로고침" = DB 재조회                                  │
   └─────────────────────────────────────────────────────────┘
                               ▼
                        내 브라우저/폰 (페이지 열어 봄)
```

서버는 여전히 0개. cron 발화 시에만 깨어나는 Edge Function 1개 + Vercel의 정적/서버리스 렌더뿐.

## 컴포넌트

### Edge Function `briefing-job` (유일한 함수)
- pg_cron → pg_net `http_post`로 호출되는 배치 잡. **텔레그램 웹훅 함수는 없음.**
- 파이프라인: **모듈 선택 → 수집(fetch) → 중복제거(source_items) → 요약(Haiku) → briefings INSERT**. 발송 단계가 없다.
- body `{ "module": "technews" }`로 특정 모듈만 실행(모듈별 cron 분리 + 수동 테스트).
- 보안: 헤더 `x-job-secret`(Supabase secret) 검증. `--no-verify-jwt`로 배포.

### 웹 프런트 (Next.js / Vercel)
- **읽기 전용.** supabase-js anon 클라이언트로 `briefings`에서 모듈별 최신 행을 조회해 카드로 렌더.
- 모듈 on/off·정렬은 **localStorage**(단일 사용자라 서버 상태 불필요). 다중 사용자 공개 시 Supabase Auth + preferences 테이블로 승격.
- "새로고침" 버튼 = DB 재조회(수집 재실행 아님). 수집은 cron이 담당. 온디맨드 수집은 백로그(보호된 트리거 필요).
- ISR/revalidate로 캐시 — 매 방문마다 최신 briefings 반영.

### Postgres (스키마는 02 문서)
- `pg_cron`: 스케줄. **UTC 기준** → 08:00 KST = `0 23 * * *`.
- `pg_net`: cron → Edge Function 비동기 HTTP 호출.
- 데이터: `source_items`(중복제거), `briefings`(웹 표시 SSOT).

### 외부 의존
| 대상 | 용도 | 인증 |
|------|------|------|
| Claude Haiku (`claude-haiku-4-5`) | 수집 아이템 요약 | ANTHROPIC_API_KEY |
| 각 소스 사이트 (03 문서) | RSS/API/HTML 수집 | 없음 (공개) |
| Vercel | 웹 호스팅(정적/ISR) | — |

Telegram·Kakao 등 채널 의존이 **전부 사라짐.**

### Secrets
- Edge Function(Supabase): `ANTHROPIC_API_KEY`, `JOB_SECRET`
- 웹(Vercel env): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon은 공개돼도 RLS로 안전)
- 에러 알림: v1은 briefings.status=failed 행으로 남기고 웹 상단 배너로 표시(별도 채널 없음). 이메일 알림 붙이려면 백로그.

## 데이터 흐름

**수집(아침, 자동):**
1. pg_cron 발화(모듈별 잡) → pg_net이 briefing-job POST.
2. `fetchItems()` → source_items upsert(conflict=이미 봄 → 제외) → 신규만.
3. 신규 0개면 briefings에 `skipped_empty` 기록하고 끝.
4. 신규를 Haiku에 1회 요약 → briefings INSERT(module_key, content, item_count).

**표시(아무 때나, 수동):**
5. 웹 접속 → supabase-js가 모듈별 최신 briefings 조회 → 카드 렌더.

## 왜 웹이 (봇 대비) 이득인가
- 봇 토큰·웹훅·secret_token·4096자 분할·HTML 이스케이프·채널 OAuth **전부 제거** → 코드·운영 표면 축소.
- 포맷 자유도 ↑(카드·이미지·차트 나중에 쉽게). 히스토리 열람도 페이지네이션으로 자연스러움.
- 트레이드오프: 푸시가 없어 페이지를 열어야 함 → 필요해지면 **PWA Web Push**로 보완(백로그, 서버 0개 유지 가능).

## 제약·리스크

| 리스크 | 내용 | 대응 |
|--------|------|------|
| 푸시 없음 | 열어야 봄 | v1 수용, PWA push 백로그 |
| Edge Function 실행시간 | 소스 다 돌리면 타임아웃 | cron 모듈별 분리, 소스별 격리 |
| 스크래핑 차단 | HTML 소스 차단 | 소스별 try/catch, enabled=false로 차단 |
| 소스 포맷 변경 | 파서 깨짐 | 모듈·소스 2중 격리 + briefings.failed 표시 |
| anon 키 노출 | 웹에 anon 키 포함 | RLS로 briefings 읽기만 허용, 쓰기·타 테이블 차단 |
| LLM 비용 폭주 | 루프 버그 | 모듈당 1일 호출 수 가드(briefings 로그) |

## 저장소·배포
- GitHub private repo `briefing-bot`: `/web`(Next.js) + `/supabase`(migrations, functions) 모노레포 한 개.
- Supabase **신규** 프로젝트(goldsilver와 분리). Vercel 프로젝트도 신규.
- 배포: `supabase db push` + `supabase functions deploy briefing-job` + Vercel는 GitHub 연동 자동배포.
