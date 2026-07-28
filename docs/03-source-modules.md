# 03. SourceModule 플러그인 구조 + v1 모듈 4종

> **스코프 방향 (07-15 확정):** "여러 브리핑을 다 받고 싶다"가 유저 요구. 그래서 **모듈(Module) ≠ 소스(Source)** 2계층으로 간다. 한 모듈(예: 커뮤니티 인기글) 안에 소스(클리앙·루리웹·에펨…)를 여러 개 꽂아 하나의 섹션으로 합친다. "다 받되 한 메시지에" — 알림 스팸 없이 커버리지만 늘리는 구조.

## 2계층: Source → Module

- **Source** = 피드 1개 어댑터(RSS/API/HTML 하나). "클리앙 모공", "루리웹 유머", "뽐뿌 핫딜" 각각이 Source.
- **Module** = 브리핑 섹션(=메시지) 1개. 여러 Source를 모아 origin 태그를 달고, 합쳐서 요약/렌더한다.
- 소스 추가 = Source 객체 1개 추가 + 모듈의 `sources` 배열에 1줄. **인터페이스 변경 없이 커버리지 확장.**

```ts
// supabase/functions/_shared/modules/types.ts
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
  label: string;               // 메시지 헤더용 한글 이름 ("💬 커뮤니티 인기글")
  sources: Source[];           // 1개 이상. 모듈이 순회하며 fetch, source별 try/catch로 격리

  // 요약 방식: 'llm'이면 Haiku 호출, 'template'이면 코드로 문자열 조립
  render:
    | { mode: "llm"; systemPrompt: string; maxItems: number }
    | { mode: "template"; format(items: RawItem[]): string };
}
```

- 등록은 `_shared/modules/index.ts`의 배열 하나: `export const MODULES: SourceModule[] = [hotdeal, market, technews, community];`
- briefing-job은 MODULES를 순회 → 각 모듈은 `sources`를 순회. **모듈별 try/catch(모듈 격리) + 소스별 try/catch(소스 격리)** 2중. 커뮤니티 소스 하나가 차단돼도 그 모듈의 다른 소스·다른 모듈 전부 정상.
- external_id 충돌 방지: `source_items.external_id`는 `origin` 접두사를 붙인다(`clien:12345`) — 사이트 간 게시글 번호 겹침 방지.

## 파이프라인 (briefing-job 내부, 모듈 공통)

```
fetchItems()
  → source_items upsert (conflict = 이미 봄 → 제외)
  → 신규 0개면 skipped_empty 기록하고 끝
  → render.mode === 'llm'  → Haiku 1회 호출로 섹션 본문 생성
    render.mode === 'template' → format() 호출
  → 구독자별 sendMessage → briefings 기록
```

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
| render | `llm` — 통합 후 "개발자 관심 기준 상위 5~8개, 각 1~2문장 한국어 요약 + 링크" |
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

## 요약(LLM) 공통 규칙

- 모델: `claude-haiku-4-5`, 모듈당 **1일 1회 호출** (아이템별 호출 금지).
- 입력: 신규 아이템의 title+payload를 JSON으로 넘김. `maxItems`(기본 30)로 잘라 토큰 상한 고정.
- 출력: 텔레그램 HTML(04 문서 포맷)로 바로 쓸 수 있는 본문. 프롬프트에 포맷 예시 포함.
- 예상 비용: 모듈 3개(llm) × 일 1회 호출. 소스가 늘어도 **호출 수는 모듈당 1회 고정**(통합 후 1번), `maxItems`가 입력 토큰 상한을 잡아 소스 증가와 비용이 무관 ≈ **월 $1 미만 유지.**

## 니치 모듈 확장 시나리오 (지금 안 만듦)

위스키/레고 시세 등은 `SourceModule` 구현 1개 추가로 끝나는지가 이 설계의 시금석이다.
예: `whiskey` 모듈 = 특정 판매처 목록 페이지 fetch → 가격을 payload에 → template 렌더로 전일 대비 표시(전일 데이터는 source_items에서 조회). 인터페이스 변경 없이 가능해야 하고, 안 되면 인터페이스를 그때 고친다.
