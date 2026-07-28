// 웹 표시용 모듈 메타 — Edge Function 레지스트리와 key만 맞추면 됨.
export interface ModuleMeta {
  key: string;
  /** 한국어 이름 — 본문·사이드바 */
  name: string;
  /** 영문 표기 — 폴더 탭·큰 라벨 (컨덴스드 서체) */
  en: string;
  /** 폴더 탭 가로 위치(%) — 서류 캐비닛처럼 서로 어긋나게 */
  tabLeft: number;
}

// 스택 순서 = 표시 순서 (위에서 아래로)
export const MODULE_ORDER: ModuleMeta[] = [
  { key: "hotdeal", name: "핫딜", en: "HOT DEALS", tabLeft: 4 },
  { key: "market", name: "시세", en: "MARKET", tabLeft: 28 },
  { key: "technews", name: "테크 뉴스", en: "TECH NEWS", tabLeft: 52 },
  { key: "community", name: "커뮤니티", en: "COMMUNITY", tabLeft: 76 },
];

export function metaOf(key: string): ModuleMeta | undefined {
  return MODULE_ORDER.find((m) => m.key === key);
}
