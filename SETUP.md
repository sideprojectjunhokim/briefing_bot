# SETUP — 스캐폴딩 → 배포 (Phase 0~2)

> 코드 골격은 다 짜여 있음. 아래는 **계정/키를 채워 배포**하는 순서. 각 단계 끝에 검증 방법 포함.

## 0. 계정·키 (사용자 손 필요)

1. **Supabase** 신규 프로젝트 생성 → Settings > API에서 확보:
   - Project URL, `anon` key, `service_role` key
2. **Anthropic** 콘솔에서 개인용 API 키 발급 + 월 지출 한도 설정
3. **GitHub** private repo `briefing-bot` 생성
4. **Vercel** 가입/로그인 (GitHub 연동)

## 1. 로컬 준비

```bash
cd C:/briefing-bot
git init && git add -A && git commit -m "scaffold: briefing-bot web v1"
# GitHub repo 연결 후
git remote add origin git@github.com:<you>/briefing-bot.git
git push -u origin main

# Supabase CLI
supabase login
supabase link --project-ref <PROJECT_REF>
```

## 2. 스키마 + 시드 (Phase 1)

```bash
supabase db push                      # 0001_init.sql 적용
# 시드로 카드 렌더 확인 (Supabase SQL 에디터에 supabase/seed.sql 붙여넣기 실행)
```

## 3. 웹 배포 (Phase 1)

```bash
cd web
npm install
cp .env.example .env.local            # 값 채우기 (URL + anon key)
npm run dev                           # http://localhost:3000 — 시드 카드 보이면 OK
```
- Vercel: New Project → repo 선택 → **Root Directory = `web`** → env 2개(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) 입력 → Deploy.
- 배포 URL에서 시드 카드 보이면 Phase 1 완료. 시드 행은 지워도 됨.

## 4. briefing-job 배포 (Phase 2)

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=<key> \
  JOB_SECRET=<아무 랜덤 문자열>
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 Edge 런타임에 자동 주입됨

supabase functions deploy briefing-job   # config.toml에 verify_jwt=false 설정됨

# 수동 호출 → briefings 행 생성 + 웹에 카드 확인
curl -X POST https://<PROJECT_REF>.functions.supabase.co/briefing-job \
  -H "content-type: application/json" \
  -H "x-job-secret: <JOB_SECRET>" \
  -d '{"module":"technews"}'
```
- 검증: 위 curl을 **2번** 실행 → 1번째 `status:ok`, 2번째 `skipped_empty`(중복제거 동작).

## 5. 자동화 (Phase 2)

- `supabase/cron.sql`의 `<PROJECT_REF>`·`<JOB_SECRET>` 치환 후 SQL 에디터에서 실행.
- 다음날 08:00 KST에 웹이 자동 갱신되는지 확인.

## 이후 (Phase 3+)

- 모듈 추가: `supabase/functions/_shared/modules/`에 파일 1개 + `index.ts` 배열 1줄 + `cron.sql`에 잡 1블록.
- 소스 추가: 해당 모듈의 `sources` 배열에 `Source` 1개.
