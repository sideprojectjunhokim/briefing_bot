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
  { key: "steamgame", name: "스팀 게임", en: "STEAM", tabLeft: 16 },
  { key: "scp", name: "SCP 재단", en: "SCP", tabLeft: 40 },
  { key: "backrooms", name: "백룸", en: "BACKROOMS", tabLeft: 64 },
];

/** 하루 끝 한 장. 수집 모듈이 아니라서 색인에는 안 넣는다. */
const WRAP: ModuleMeta = { key: "wrap", name: "하루 끝", en: "END OF DAY", tabLeft: 40 };

/** 탭이 서로 어긋나 보이게 키에서 자리를 뽑는다 — 안 그러면 관심사 탭이 전부 겹친다 */
const TAB_SLOTS = [4, 28, 52, 76];
function slotOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TAB_SLOTS[h % TAB_SLOTS.length];
}

/**
 * 큐에는 코드에 없는 것들이 섞인다 — 사용자가 직접 추가한 관심사, 하루 끝 한 장.
 * 그래서 항상 무언가를 돌려주고, 이름은 DB에서 온 label을 우선 쓴다.
 */
export function metaOf(key: string, label?: string): ModuleMeta {
  if (key === WRAP.key) return WRAP;
  const known = MODULE_ORDER.find((m) => m.key === key);
  if (known) return known;
  const name = label ?? key.replace(/^my-/, "");
  return { key, name, en: name, tabLeft: slotOf(key) };
}
