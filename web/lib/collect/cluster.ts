/**
 * 같은 사건을 다룬 기사를 묶는다.
 *
 * **왜 필요한가.** 조회수나 추천수를 주는 피드가 없다. RSS는 그런 걸 안 실어
 * 준다. 그래서 "중요한가"를 판단할 신호가 하나도 없이 40건이 시간순으로 온다.
 *
 * 대신 쓸 수 있는 게 하나 있다 — **몇 개 매체가 같은 걸 다뤘나.** 여러 곳이
 * 동시에 쓴 건 그날 실제로 일어난 일이고, 한 곳만 쓴 건 대개 홍보성이거나
 * 키워드만 스친 기사다. 조회수의 대용으로 쓸 만하다.
 *
 * 묶는 김에 대표 하나만 남기므로 모델에 넘기는 양도 준다. 선별이 좋아지면서
 * 입력 토큰이 같이 줄어드는 몇 안 되는 경우다.
 */

/** 제목에 흔해서 겹쳐도 의미가 없는 말들 */
const STOP = new Set([
  "그리고", "하지만", "위한", "위해", "관련", "대한", "통해", "따른", "가장", "다시",
  "이번", "올해", "지난", "오늘", "내년", "기자", "속보", "단독", "종합", "인터뷰",
  "공개", "출시", "발표", "시작", "확대", "추진", "논란", "이유", "무엇", "어떻게",
]);

function tokens(title: string, drop: string[]): Set<string> {
  let t = title;
  // 매체명이 제목에 남아 있으면 같은 통신사 기사끼리만 묶인다
  for (const d of drop) if (d) t = t.split(d).join(" ");
  return new Set(
    t
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && !STOP.has(w)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

export interface Clustered<T> {
  item: T;
  /** 같은 사건을 다룬 기사 수(자기 자신 포함). 조회수 대용 신호 */
  coverage: number;
}

/**
 * 제목이 겹치는 것끼리 묶고 클러스터마다 대표 하나만 남긴다.
 * 많이 다뤄진 순으로 돌려준다.
 *
 * 임계값 2는 실측으로 골랐다 — 1이면 흔한 단어 하나로 무관한 기사가 붙고,
 * 3이면 같은 사건인데도 제목 표현이 달라 안 묶인다.
 */
export function clusterByTitle<T extends { title: string; publisher?: string }>(
  items: T[],
  /**
   * 제목에서 빼고 볼 말들. **검색어를 반드시 넣어야 한다** — 검색 결과라 모든
   * 제목에 들어 있고, 그러면 아무 기사 쌍이나 공통 토큰을 하나 깔고 시작한다.
   * 거기에 흔한 단어 하나만 더 겹치면 전이로 전부 한 덩어리가 된다
   * (실측: "위스키" 40건 중 23건이 한 묶음 → 검색어를 빼니 4건).
   */
  dropWords: string[] = [],
  minOverlap = 2,
): Clustered<T>[] {
  const publishers = items.map((i) => i.publisher ?? "").filter(Boolean);
  const drop = [...new Set([...publishers, ...dropWords])];
  const toks = items.map((i) => tokens(i.title, drop));

  // union-find. 한 번만 훑으며 붙이면 전이가 안 돼서 같은 사건이 두 묶음으로
  // 갈린다(실측: 같은 위스키 기사가 8건·6건으로 쪼개졌다). A~B, B~C면 셋 다 하나다.
  const parent = items.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlap(toks[i], toks[j]) >= minOverlap) parent[find(j)] = find(i);
    }
  }

  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const r = find(i);
    const g = byRoot.get(r);
    if (g) g.push(i);
    else byRoot.set(r, [i]);
  }

  return [...byRoot.values()]
    .map((g) => ({
      // 대표는 제목이 가장 긴 것 — 짧은 제목은 대개 통신사 헤드라인이라 정보가 적다
      item: g.map((i) => items[i]).sort((a, b) => b.title.length - a.title.length)[0],
      coverage: g.length,
    }))
    .sort((a, b) => b.coverage - a.coverage);
}
