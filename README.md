# briefing-bot

**일하는 중에 한 시간마다 읽을거리를 하나 던져 주는 개인용 도구.**
사용자는 한 명(만든 사람 본인)이고, 발송은 없다. 웹으로 보러 온다.

핫딜 · 시세 · 테크 뉴스 · 커뮤니티 4개 모듈로 시작하고, 니치 시세(위스키/레고 등)는 플러그인 모듈로 나중에 추가한다.

## 제품의 단위 — 여기가 핵심이다

**시간당 정량을 두지 않는다.** 한 시간에는 대개 새 게 없어서, "시간당 N장"으로 정하면 한가한 시간엔 잡글로 채우게 되고 그 순간 신뢰가 먼저 죽는다.

그래서 수집 주기와 읽기 단위를 분리했다.

- **수집은 매시** 돈다. 건질 게 없으면 아무것도 안 쌓인다. 그게 정상이다.
- **읽기 단위는 "안 읽은 것" 전부**다. 2개일 수도 7개일 수도 있다.
- 봇의 일은 시간 칸을 채우는 게 아니라 **큐를 좋게 유지하는 것**이다. 12건 중 11건을 버리는 게 일이다.

화면 문구도 "이번 시간의 브리핑"이 아니라 **"안 읽은 것 N개"**다. `briefings.read_at` 한 컬럼이 이 모델 전체의 축이다.

## 하드 제약

- **서버 0개.** 관리할 인스턴스/VM/컨테이너 없음.
- 재미 우선, 수익은 보너스. 운영비 월 몇천 원 이하(사실상 Anthropic API 비용뿐).

## 스택

```
GitHub Actions (매시)  →  Vercel / Next.js  →  Neon Postgres
     시계                  수집 · 선별 · 화면        저장
                              ↕
                       Claude Haiku (선별 + 리드 문단)
```

Supabase·Vercel Cron·Cloudflare를 못 쓰는 이유는 `docs/01-architecture.md`에 표로 있다.

## 품질 원칙

> **목록은 데이터고, 글이 상품이다.**
> 제목을 다시 나열하는 문장은 아무것도 안 한 것이다.

- 모듈마다 리드의 **성격이 달라야 한다.** 핫딜은 "지금 사도 되나", 시세는 "왜 움직였나", 테크는 "내 코드가 어떻게 바뀌나", 커뮤니티는 "읽을 값어치가 있나". 넷이 같은 톤으로 끝나면 사흘 만에 안 읽는다. 그래서 네 질문을 `web/lib/collect/prompt.ts`의 `LEAD_ASK` 한곳에 나란히 둔다.
- **없으면 없다고 쓴다.** 억지로 채우면 신뢰가 먼저 죽는다.
- **숫자는 코드가 만든다.** 시세는 LLM 없이 조립한다(`modules/market.ts`) — 환각 0, 비용 0. 이 경계를 넘기지 마라.

## 저장소 레이아웃

```
briefing-bot/
├─ .github/workflows/collect.yml   시계 (매시 → /api/collect)
├─ db/schema.sql                   스키마 (idempotent, npm run db:push)
├─ web/                            Next.js — 화면 + 수집 + API (Vercel 배포)
│  ├─ app/                         화면과 route handler
│  ├─ lib/collect/                 수집기 (types·rss·db·summarize·prompt·run·modules)
│  ├─ lib/db.ts                    Neon 클라이언트 + 화면용 조회
│  └─ middleware.ts                APP_PASSWORD 쿠키 게이트
└─ docs/                           설계 문서
```

## 문서 인덱스

| 문서 | 내용 |
|------|------|
| [SETUP.md](SETUP.md) | **계정·키를 채워 배포하는 절차** |
| [docs/01-architecture.md](docs/01-architecture.md) | 컴포넌트, 데이터 흐름, 왜 이 인프라인지 |
| [docs/02-data-model.md](docs/02-data-model.md) | 테이블 3개와 각 컬럼이 왜 있는지 |
| [docs/03-source-modules.md](docs/03-source-modules.md) | Module≠Source 2계층 + 프롬프트 조립 |
| [docs/04-web-ux.md](docs/04-web-ux.md) | 큐 화면·아카이브·진입 흐름 |
| [docs/05-roadmap.md](docs/05-roadmap.md) | **단계별 체크리스트 (지금 0단계)** |
| [docs/06-decisions.md](docs/06-decisions.md) | 확정 / 미결 / Deviations |

## 현재 상태

- 2026-07-03: 아이디어 확정
- 2026-07-15: 설계 v1 → 웹 피벗 → 코드 스캐폴딩
- 2026-07-28: **시간당 읽을거리로 재설계.** 인프라 교체(Actions + Vercel + Neon), 수집기 이식, 큐 UI 전환, 이어 붙이기 · 읽는 시간 · 아카이브 재출고 · 건너뛰기 알림 · 하루 끝 한 장 구현 ← 지금 여기
- 다음: **Neon·Anthropic·Vercel 계정 셋업 후 첫 수집 실행**(SETUP.md). DB는 아직 한 번도 안 붙었다.
