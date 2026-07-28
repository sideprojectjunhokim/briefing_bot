import type { Briefing } from "./db";

/** 시간 역순 큐를 흉내 낸다 — 같은 모듈이 여러 장 쌓일 수 있는 게 요점이다 */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

let seq = 0;
function card(o: Partial<Briefing> & { module_key: string; content: string }): Briefing {
  seq += 1;
  return {
    id: seq,
    kind: "live",
    item_count: 3,
    status: "ok",
    error: null,
    est_read_seconds: 120,
    thread_of: null,
    thread_note: null,
    read_at: null,
    archived_at: null,
    resurfaced_at: null,
    created_at: ago(seq * 70),
    ...o,
  };
}

/** DATABASE_URL이 없을 때 레이아웃·애니메이션 확인용 미리보기 데이터. */
export const DEMO_QUEUE: Briefing[] = [
  card({
    module_key: "technews",
    item_count: 2,
    est_read_seconds: 150,
    thread_of: 999,
    thread_note: "사흘 전에 본 React 컴파일러 이야기, 오늘 후속이 나왔다.",
    content:
      "컴파일러가 정식 기본값이 되면서, 손으로 붙이던 useMemo와 useCallback은 이제 걷어내는 쪽이 일이 됐습니다. 새로 배울 건 없고 지울 게 생긴 겁니다. 다만 의존성 배열을 부작용 트리거로 쓰던 코드는 컴파일러가 다르게 판단하니, 그쪽만 먼저 훑어보는 게 좋겠습니다.\n\n" +
      "- **[GeekNews] React 20 정식, 컴파일러 기본 탑재** — 메모 훅 수동 사용은 사실상 권장에서 빠졌다\n" +
      "- **[GeekNews] 마이그레이션 코드모드 공개** — 기존 메모 훅을 자동으로 걷어낸다",
  }),
  card({
    module_key: "hotdeal",
    item_count: 1,
    est_read_seconds: 60,
    content:
      "오늘 볼 만한 건 하나뿐입니다. 2TB SSD가 하루 만에 18% 빠졌는데 신제품 발표를 앞둔 재고 정리로 보이고, 이런 모양은 대개 발표 직후 한 번 더 빠집니다. 급하지 않으면 다음 주까지 두고 보는 쪽이 낫습니다.\n\n" +
      "- **[다나와] SSD 2TB 특가** — 어제보다 18% 하락, 역대가보다는 아직 위",
  }),
  card({
    module_key: "market",
    item_count: 4,
    est_read_seconds: 60,
    content:
      "- **KOSPI** 2,812 (+0.4%)\n- **USD/KRW** 1,354 (-3원)\n- **BTC** $109,200 (+1.2%)\n- **금 시세** g당 168,400원 (+0.6%)",
  }),
  card({
    module_key: "community",
    item_count: 2,
    est_read_seconds: 90,
    resurfaced_at: new Date().toISOString(),
    created_at: ago(60 * 26),
    content:
      "홈서버 정리글에 댓글이 240개 넘게 붙었는데, 장비 자랑이 아니라 전기요금과 소음 이야기가 대부분입니다. 실제로 굴려 본 사람들이 모인 판이라 읽을 값어치가 있고, 다만 앞쪽 스무 개 댓글이면 충분합니다.\n\n" +
      "- **[클리앙] 홈서버 정리글** — 댓글 240개, 전기요금 실측치가 여럿 나온다\n" +
      "- **[클리앙] 소음 잡는 케이스 추천 모음**",
  }),
];
