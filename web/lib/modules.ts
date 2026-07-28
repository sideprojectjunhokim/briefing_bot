// 화면 표시용 모듈 메타 — 수집기 레지스트리와 key만 맞추면 된다.
export interface ModuleMeta {
  key: string;
  /** 한국어 이름 — 본문·사이드바 */
  name: string;
  /** 영문 표기 — 폴더 탭·큰 라벨 (컨덴스드 서체) */
  en: string;
  /** 폴더 탭 가로 위치(%) — 서류 캐비닛처럼 서로 어긋나게 */
  tabLeft: number;
}

/** 사이드바 색인 순서. 큐의 순서는 아니다 — 큐는 시간 역순이다. */
export const MODULE_ORDER: ModuleMeta[] = [
  { key: "hotdeal", name: "핫딜", en: "HOT DEALS", tabLeft: 4 },
  { key: "market", name: "시세", en: "MARKET", tabLeft: 28 },
  { key: "technews", name: "테크 뉴스", en: "TECH NEWS", tabLeft: 52 },
  { key: "community", name: "커뮤니티", en: "COMMUNITY", tabLeft: 76 },
];

/** 하루 끝 한 장. 수집 모듈이 아니라서 색인에는 안 넣는다. */
const WRAP: ModuleMeta = { key: "wrap", name: "하루 끝", en: "END OF DAY", tabLeft: 40 };

const unknown = (key: string): ModuleMeta => ({
  key,
  name: key,
  en: key.toUpperCase(),
  tabLeft: 4,
});

/** 큐에는 색인에 없는 종류(wrap)도 섞이므로 항상 무언가를 돌려준다 */
export function metaOf(key: string): ModuleMeta {
  if (key === WRAP.key) return WRAP;
  return MODULE_ORDER.find((m) => m.key === key) ?? unknown(key);
}

/** 색인에 있는 모듈인가 — /c/[key] 아카이브가 열릴 수 있는 키인지 판별 */
export function isIndexedModule(key: string): boolean {
  return MODULE_ORDER.some((m) => m.key === key);
}
