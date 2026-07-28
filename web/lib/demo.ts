import type { Briefing } from "./supabase";

/** Supabase env가 없을 때(Phase 0 전) 레이아웃·애니메이션 확인용 미리보기 데이터. */
export const DEMO_BRIEFINGS: Briefing[] = [
  {
    id: 1,
    module_key: "hotdeal",
    item_count: 3,
    content:
      "오늘 핫딜의 주인공은 저장장치입니다. SSD 2TB가 하루 만에 18% 빠졌는데, 신제품 발표를 앞둔 재고 정리로 보입니다. 지금이 바닥일 가능성이 높지만 다음 주까지 더 빠질 여지도 있습니다. 나머지 둘은 생활용품이고, 건조기는 역대가에 근접해 실제로 살 만합니다.\n\n" +
      "- **[다나와] SSD 2TB 특가** — 어제보다 18% 하락\n- **[쿠팡] 미니 건조기** — 역대가 근접\n- **[11번가] 커피 원두 1kg** — 쿠폰 중복 가능",
    status: "ok",
    error: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    module_key: "market",
    item_count: 4,
    content:
      "환율이 3원 내리고 코스피가 소폭 올랐습니다. 방향이 같이 움직인 건 오랜만이고, 대개 외국인 수급이 들어올 때 나오는 모양입니다. 금은 0.6% 올라 조용히 신고가 부근을 유지하는 중입니다.\n\n" +
      "- **KOSPI** 2,812 (+0.4%)\n- **USD/KRW** 1,354 (-3원)\n- **BTC** $109,200 (+1.2%)\n- **금 시세** g당 168,400원 (+0.6%)",
    status: "ok",
    error: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    module_key: "technews",
    item_count: 3,
    content:
      "React 20 RC에 컴파일러가 기본으로 들어갔습니다. useMemo와 useCallback을 손으로 붙이던 시대가 사실상 끝난다는 뜻이라, 기존 코드베이스에서는 오히려 걷어내는 작업이 생길 겁니다. Supabase 큐 GA는 cron과 묶여서, 지금까지 외부 워커로 돌리던 잡을 DB 안으로 들일 수 있게 됐습니다.\n\n" +
      "- **React 20 RC 공개** — 컴파일러 기본 탑재\n- **Supabase, 큐 기능 GA** — cron+queue 통합\n- **Windows 12 프리뷰** — AI 셸 내장",
    status: "ok",
    error: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    module_key: "community",
    item_count: 2,
    content:
      "홈서버 정리글에 댓글이 240개 넘게 붙었습니다. 장비 자랑이 아니라 전기요금과 소음 이야기가 대부분이라, 실제로 굴려본 사람들이 모인 판입니다. 이직 타이밍 논쟁은 결론 없이 길어지는 중이고, 읽을 값어치는 앞쪽 스무 개 댓글까지입니다.\n\n" +
      "- **[클리앙] 홈서버 정리글** 댓글 240+\n- **[디시] 개발자 이직 타이밍 논쟁** 화제",
    status: "ok",
    error: null,
    created_at: new Date().toISOString(),
  },
];
