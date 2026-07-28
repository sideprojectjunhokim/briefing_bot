/**
 * 온보딩에서 고른 값.
 *
 * 온보딩은 로그인 **전** 화면이라 서버에 바로 못 쓴다(미인증 쓰기가 된다).
 * 그래서 여기 담아 뒀다가 로그인 성공 직후에 한 번에 반영한다.
 * 원래 사양(docs/07)도 "선택값은 localStorage에 저장"이었다.
 */
const KEY = "bb-setup";

export interface SetupChoice {
  /** 받기로 한 모듈 키. 여기 없는 모듈은 muted가 된다 */
  modules: string[];
  /** 한 장에 담을 항목 상한 (module_prefs.pick_max) */
  pickMax: number;
}

export function saveSetup(choice: SetupChoice) {
  localStorage.setItem(KEY, JSON.stringify(choice));
}

/** 한 번 반영하면 지운다 — 매 로그인마다 덮어쓰면 나중에 조정한 값이 되돌아간다 */
export function consumeSetup(): SetupChoice | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  localStorage.removeItem(KEY);
  try {
    const v = JSON.parse(raw) as SetupChoice;
    return Array.isArray(v.modules) && typeof v.pickMax === "number" ? v : null;
  } catch {
    return null;
  }
}
