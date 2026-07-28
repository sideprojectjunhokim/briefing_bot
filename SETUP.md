# SETUP — 계정 채우고 배포하기

> 코드는 다 짜여 있다. 아래는 **계정/키를 채워 실제로 돌리는** 순서다. 각 단계 끝에 검증 방법이 있다.
> DB는 아직 한 번도 붙은 적이 없다. 3번까지 가면 처음으로 실데이터를 보게 된다.

## 0. 계정 — 사용자 손이 필요한 유일한 구간

| 서비스 | 왜 | 주의 |
|---|---|---|
| **Neon** (neon.tech) | Postgres 0.5GB 무료 | **개인 계정**으로. 카드 불필요 |
| **Anthropic** | 요약(Haiku) | 개인용 키 분리 + **월 지출 한도 설정** |
| **Vercel** | 웹 + 수집 실행 | GitHub 연동 |

GitHub 저장소는 이미 있다(`sideprojectjunhokim/briefing_bot`).

## 1. Neon — DB 만들고 스키마 넣기

1. Neon 대시보드 → 새 프로젝트 → **Connection string** 복사 (`postgresql://…?sslmode=require`).
2. 로컬에 넣는다:

```bash
cd C:/briefing-bot/web
cp .env.example .env.local     # DATABASE_URL, ANTHROPIC_API_KEY, CRON_SECRET, APP_PASSWORD 채우기
npm install
npm run db:push                # db/schema.sql 적용 — 여러 번 돌려도 안전
```

**검증:** `스키마 적용 완료 — N개 구문.` 이 뜬다. Neon SQL 에디터에서
`select table_name from information_schema.tables where table_schema='public';`
→ `briefings` · `source_items` · `module_prefs` 세 개.

## 2. 로컬에서 첫 수집

```bash
npm run dev
```

브라우저로 직접 호출한다(수동 실행 겸 디버그 경로):

```
http://localhost:3000/api/collect?secret=<CRON_SECRET>
```

**검증:** 응답 JSON에 `"technews": { "status": "ok", "itemCount": N }`.
`http://localhost:3000` 을 열면 그 장이 큐에 있고, 누르면 펼쳐지고, 닫으면 흐려진다. 새로고침하면 큐에서 빠진다.

**한 번 더 호출한다.** 두 번째는 `"status": "no_new"` 여야 한다 — 중복제거가 도는지 보는 검사다.

> 이 단계에서 **리드 문단을 실제로 읽어 보는 게 진짜 작업이다.** 제목을 다시 나열하고 있으면 프롬프트를 고친다(`web/lib/collect/prompt.ts`). 지금 붙어 있는 소스는 GeekNews 하나뿐이라 technews만 채워진다.

## 3. Vercel 배포

- New Project → 저장소 선택 → **Root Directory = `web`**
- Environment Variables 4개:

| 키 | 값 |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `ANTHROPIC_API_KEY` | Anthropic 키 |
| `CRON_SECRET` | 아무 랜덤 문자열 (아래 GitHub secret과 같은 값) |
| `APP_PASSWORD` | 화면 접근 비밀번호. **비워 두면 게이트가 꺼진다** |

- Deploy → 배포 URL 확인.

**검증:** 배포 URL을 열면 `/onboarding`으로 튕기고, 이름 + 비밀번호로 들어가진다. 비밀번호를 틀리면 안 들어가진다.

## 4. 시계 붙이기 (GitHub Actions)

저장소 Settings → Secrets and variables → Actions → **New repository secret** 2개:

| 키 | 값 |
|---|---|
| `BASE_URL` | `https://<프로젝트>.vercel.app` (끝에 슬래시 없이) |
| `CRON_SECRET` | Vercel에 넣은 것과 **같은 값** |

**검증:** Actions 탭 → `collect` → **Run workflow**로 수동 실행. 로그에 수집 결과 JSON이 찍히고 초록이면 통과.
그다음 정시(±20분)에 자동으로 한 번 더 도는지 확인한다.

## 운영 메모

- **스케줄은 정시에 안 돈다.** GitHub 부하에 따라 5~20분 밀린다. 정각을 전제로 만들지 마라.
- **저장소가 60일 무활동이면 스케줄이 자동 비활성화된다.** 혼자 쓰는 저장소라 실제로 걸릴 수 있고, Actions 탭에서 다시 켜면 된다.
- 특정 모듈만 돌리기: `/api/collect?secret=…&module=technews` 또는 워크플로 수동 실행의 `module` 입력.
- 소스 하나가 계속 막히면 해당 `Source`의 `enabled: false` 한 줄로 끈다.
- 스키마를 바꾸면 `db/schema.sql`에 idempotent하게 추가하고 `npm run db:push`를 다시 돌린다.

## 다음 (05 문서 4단계)

지금 실제로 붙어 있는 소스는 `technews/geeknews` 하나뿐이다. 나머지 세 모듈은 틀만 있고 `enabled:false`다.
쉬운 것부터 하나씩 붙이고 실측한다 — 붙는 것만 남기고, 막히면 끈다.
