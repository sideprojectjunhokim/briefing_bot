# 03. SourceModule 플러그인 구조 + v1 모듈 4종

> **스코프 방향 (07-15 확정):** "여러 브리핑을 다 받고 싶다"가 유저 요구. 그래서 **모듈(Module) ≠ 소스(Source)** 2계층으로 간다. 한 모듈(예: 커뮤니티 인기글) 안에 소스(클리앙·루리웹·에펨…)를 여러 개 꽂아 하나의 섹션으로 합친다. "다 받되 한 메시지에" — 알림 스팸 없이 커버리지만 늘리는 구조.

## 2계층: Source → Module

- **Source** = 피드 1개 어댑터(RSS/API/HTML 하나). "클리앙 모공", "루리웹 유머", "뽐뿌 핫딜" 각각이 Source.
- **Module** = 브리핑 섹션(=메시지) 1개. 여러 Source를 모아 origin 태그를 달고, 합쳐서 요약/렌더한다.
- 소스 추가 = Source 객체 1개 추가 + 모듈의 `sources` 배열에 1줄. **인터페이스 변경 없이 커버리지 확장.**

> **07-28 경로 이동:** 코드가 `supabase/functions/_shared/` → **`web/lib/collect/`**로 옮겨졌다(Deno Edge Function → Next.js). 2계층 구조 자체는 그대로다.

```ts
// web/lib/collect/types.ts
export interface RawItem {
  externalId: string;          // source_items.external_id 로 들어감 (중복제거 키)
  url?: string;
  title: string;
  origin: string;              // 어느 Source에서 왔나 ('clien' | 'ruliweb' ...) — 렌더 그룹핑·디버깅용
  payload?: Record<string, unknown>;  // 가격, 추천수, 등락률 등
}

export interface Source {
  key: string;                 // 'clien' 등. RawItem.origin 으로 들어감
  label: string;               // "클리앙 모공"
  enabled: boolean;            // false면 스킵 (사이트 죽었을 때 코드 한 줄로 차단)
  fetch(): Promise<RawItem[]>; // 이 소스만 수집. 실패해도 모듈은 다른 소스로 계속
}

export interface SourceModule {
  key: string;                 // 'community' 등. DB의 module_key와 일치
  label: string;               // 화면 표시용 한글 이름
  sources: Source[];           // 1개 이상. 모듈이 순회하며 fetch, source별 try/catch로 격리

  render:
    // prompt는 문자열이 아니라 함수다 — pick_max(module_prefs)와 최근 읽은 것
    // (이어 붙이기 재료)이 매 회차 달라지기 때문
    | { mode: "llm"; maxInput: number; prompt(ctx: PromptContext): string }
    | { mode: "template"; format(items: RawItem[]): string };
}

export interface PromptContext {
  pickMax: number;             // 이 장에 담을 항목 상한
  recentlyRead: ReadRef[];     // 최근 7일 안에 **읽은** 장과 그 안의 제목들
}
```

- 등록은 `web/lib/collect/modules/index.ts`의 배열 하나: `export const MODULES: SourceModule[] = [technews, market, hotdeal, community];`
- 수집기는 MODULES를 순회 → 각 모듈은 `sources`를 순회. **모듈별 try/catch(모듈 격리) + 소스별 try/catch(소스 격리)** 2중. 커뮤니티 소스 하나가 차단돼도 그 모듈의 다른 소스·다른 모듈 전부 정상.
- external_id 충돌 방지: `source_items.external_id`는 `origin` 접두사를 붙인다(`clien:12345`).

## 파이프라인 (`web/lib/collect/run.ts`, 모듈 공통)

```
묵은 미독 내리기(archived_at)
  → 소스별 fetch (격리)
  → source_items upsert (conflict = 이미 봄 → 제외)
  → 신규 0개면 **아무것도 안 만들고 끝**   ← 예전엔 skipped_empty 행을 남겼다
  → render.mode === 'llm'  → Haiku 1회 호출 (선별 + 리드 + THREAD 줄)
    render.mode === 'template' → format() 호출
  → 모델이 SKIP이라 하면 역시 **아무것도 안 만든다**
  → briefings INSERT (+ est_read_seconds 계산, thread_of 검증)
  → source_items.briefing_id 연결
```

마지막 줄이 중요하다. `briefing_id` 연결이 있어야 나중에 "읽은 장에 뭐가 들어 있었나"를 되짚어 **이어 붙이기** 재료를 만들 수 있다.

## v1 모듈 스펙

### M1. `hotdeal` — 핫딜/특가 🔥
| 항목 | 내용 |
|------|------|
| 소스 (v1) | 뽐뿌 핫딜 RSS → 이어서 퀘이사존 지름/특가, 루리웹 핫딜 순차 추가 |
| origin | `ppomppu` · `quasarzone` · `ruliweb_hotdeal` |
| render | `llm` — 소스 통합 후 "쓸만한 딜 5~8개만 골라 품목/가격/한줄평. 광고성·종료된 딜 제외" |
| 리스크 | RSS 폐지·차단 가능성 → 소스별 격리, 실패 소스는 enabled=false로 끄고 나머지 유지 |

### M2. `market` — 주식/코인 📈
| 항목 | 내용 |
|------|------|
| 코인 소스 | Upbit 공개 REST `GET /v1/ticker?markets=KRW-BTC,KRW-ETH` — 무인증, 안정적 |
| 지수 소스 | KOSPI/KOSDAQ + 나스닥/S&P500. **소스 미확정** (06 문서 D-3): Yahoo Finance 비공식 API vs 네이버 금융 파싱 |
| externalId | `KRW-BTC:2026-07-15` 형식 (날짜 포함 → 하루 1회 스냅샷) |
| render | `template` — 숫자는 LLM 없이 그대로 조립 (환각 위험 0, 비용 0). 한줄 코멘트가 필요해지면 나중에 llm 승격 |
| 비고 | 관심 종목 개인화는 v1 제외, 고정 리스트 |

### M3. `technews` — 개발/테크 뉴스 👨‍💻
| 항목 | 내용 |
|------|------|
| 소스 (v1) | GeekNews RSS (`news.hada.io/rss/news`) → Hacker News top(Algolia API, 영문→"한국어로" 요약) 추가 |
| origin | `geeknews` · `hackernews` |
| render | `llm` — 통합 후 "개발자 관심 기준 상위 5~8개, 각 1~2문장 한국어 요약 + 링크". **영어 원문이면 읽고 한국어로 번역·요약**(제목·리드·항목 전부 한국어, `buildPrompt` 공통 규칙) |
| 비고 | **가장 만만한 모듈 — Phase 2 MVP는 geeknews 소스 1개로 시작** (RSS 안정적, 파싱 단순) |

### M4. `community` — 커뮤니티 인기글 💬  (여러 소스 통합)
| 항목 | 내용 |
|------|------|
| 소스 | **"다 받기" 방향** — 접근 난이도 낮은 순으로 하나씩 추가. 클리앙 모공 → 루리웹 유머/인기 → 보배드림 → (방어 강함) 에펨코리아 포텐 · 더쿠 핫게 |
| origin | `clien` · `ruliweb` · `bobae` · `fmkorea` · `theqoo` … |
| externalId | `<origin>:<게시글 ID>` |
| render | `llm` — 소스 통합, "origin별로 묶어서, 제목만으로 모호한 것만 한줄 부연 + 링크" |
| 리스크 | 스크래핑 차단 위험 최고(RSS 없는 곳多). **소스별 격리 필수** — 에펨/더쿠는 Cloudflare 방어 강해 후순위, 붙였다 계속 막히면 enabled=false로 끄고 유지 |
| 구현 순서 | Phase 3에서 클리앙 1개로 모듈 완성 → 이후 소스를 한 번에 하나씩 추가하며 실측(붙는 것만 남김) |

### M5. `steamgame` — 스팀 게임 🎮

| 항목 | 내용 |
|------|------|
| 소스 | 스팀 스토어 featuredcategories API(특가·최고 판매·신작, 키 불요) + Google 뉴스 보조 |
| origin | `steam` · `gnews` |
| externalId | `steam:<appId>:<final_price>` — **가격이 바뀌면 새 아이템**. id만 쓰면 한 번 실린 게임이 다음 세일 때 영영 안 나온다 |
| render | `llm` — 가격·할인율 먼저(`12,000원 (-70%)`), 스토어와 뉴스 아이템 섞어 선별 |
| 비고 | API 가격은 KRW×100 — **코드에서 원으로 변환**해 payload에 넣는다(모델에게 나누기 시키지 않는다) |

### M6·M7. `scp` · `backrooms` — 탐험형(로어) 모듈 👁️

뉴스형과 근본이 다른 두 번째 모듈 유형. 유저 창작 세계관(위키)은 뉴스에 안 잡히므로
"오늘 무슨 일이"가 아니라 **"오늘은 이 문서"**를 아카이브에서 한 편 꺼내 온다.

| 항목 | scp | backrooms |
|------|-----|-----------|
| 풀 | Crom API 평점순 100편 (`scpko.wikidot.com`) | 위키 사이트맵 — KO 137편 소진 후 EN 9천 편 |
| 본문 | 렌더된 페이지 HTML → `wikidot.ts`가 텍스트·표지 이미지 추출 | 좌동. KO가 스텁이면 EN 폴백 |
| externalId | `scpko:<slug>` | `bkko:<slug>` — KO/EN 같은 슬러그 = 같은 문서 |
| 페이스 | `queueCap: 2` — 안 읽은 게 2장 있으면 그 회차는 쉰다. **읽는 속도만큼 나온다** (하루 상한은 MAX_OK_PER_DAY) |
| 렌더 | `llm` maxInput 1 — 문서 한 편을 리드+구성 불릿(등급·묘사·생존 수칙…)으로. 표지 이미지는 `postProcess`가 코드로 붙인다 |
| 툼스톤 | 삭제된 문서(404)는 `{dead:true}`로 upsert — 풀에서 영구 제외 |

공통 헬퍼는 `web/lib/collect/modules/lore.ts`(프롬프트 뼈대·queueCap 상수·postProcess)와
`web/lib/collect/wikidot.ts`(HTML→텍스트·표지 추출)에 있다.

## 요약(LLM) 공통 규칙

- 모델: `claude-haiku-4-5`, **장 하나당 1회 호출** (아이템별 호출 금지).
- 입력: 신규 아이템의 title+payload를 JSON으로. `maxInput`(기본 30)으로 잘라 토큰 상한 고정.
- 출력: 화면 렌더용 마크다운. 선택적으로 첫 줄에 `THREAD: <id> | <한 문장>`.
- 비용: 시계가 매시로 바뀌어 호출 수가 하루 1회 시절의 최대 24배가 됐다. 다만 **건질 게 없으면 호출 자체를 안 하므로**(신규 0개면 LLM 안 부름) 실제 호출 수는 소스가 실제로 갱신되는 빈도에 붙는다. 모듈당 24회/일 가드가 상한.

### 프롬프트 조립 — `web/lib/collect/prompt.ts`

모듈 파일은 **자기 모듈만의 것**(역할 한 줄, 리드가 답할 질문, 항목 형식, 제외 규칙)만 쓴다. 공통 뼈대(선별 지시·SKIP 규칙·출력 2부 구성·이어 붙이기 지시)는 `buildPrompt()`가 붙인다.

**`LEAD_ASK`는 넷을 한곳에 나란히 둔다(C-18).**

| 모듈 | 리드가 답해야 하는 질문 |
|---|---|
| hotdeal | 지금 사도 되는가 |
| market | 왜 움직였나 |
| technews | 내 코드가 어떻게 바뀌나 |
| community | 읽을 값어치가 있나 |
| steamgame | 위시리스트에 넣을 게 있나 |
| scp* | 왜 무서운가(또는 웃긴가) |
| backrooms* | 살아나갈 수 있나 |

\* 탐험형의 리드 질문은 `modules/lore.ts`의 `LoreBrief.ask`에 있다 — 형식이 달라 LEAD_ASK에 못 넣지만, 옆칸과 겹치는지는 같이 본다.

흩어 놓으면 하나씩 고칠 때마다 조금씩 닮아 가고, 다 닮은 뒤에도 아무도 눈치 못 챈다. 새 모듈을 추가할 땐 여기 한 줄을 쓰면서 "옆칸과 다른 질문인가"를 먼저 본다.

## 니치 모듈 확장 시나리오 (지금 안 만듦)

위스키/레고 시세 등은 `SourceModule` 구현 1개 추가로 끝나는지가 이 설계의 시금석이다.
예: `whiskey` 모듈 = 특정 판매처 목록 페이지 fetch → 가격을 payload에 → template 렌더로 전일 대비 표시(전일 데이터는 source_items에서 조회). 인터페이스 변경 없이 가능해야 하고, 안 되면 인터페이스를 그때 고친다.
