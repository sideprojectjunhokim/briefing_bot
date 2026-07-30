// 개인용 앱의 가벼운 로컬 세션 — 인증이 아니라 "누구의 브리핑인지" + 연출 트리거.
const USER_KEY = "bb-user";
const ARRIVE_KEY = "bb-arrive";
const REMEMBER_KEY = "bb-remember";

export function getUser(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_KEY);
}

export function setUser(name: string) {
  localStorage.setItem(USER_KEY, name);
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

/**
 * 이 브라우저에서 마지막으로 로그인한 아이디 — 로그인 화면의 빠른 재로그인용.
 *
 * `bb-user`(세션 표시용)와 분리한 이유: 로그아웃하면 `bb-user`는 지워지지만
 * 이건 남아야 다음에 왔을 때 "OO님 어서오세요"가 뜬다. "다른 계정으로" 눌렀을
 * 때만 지운다.
 */
export function getRemembered(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REMEMBER_KEY);
}

export function setRemembered(name: string) {
  localStorage.setItem(REMEMBER_KEY, name);
}

export function clearRemembered() {
  localStorage.removeItem(REMEMBER_KEY);
}

/** 로그인 성공 직후 1회성 — 메인이 왼쪽에서 슬라이드 인 + 파일 팝 연출 */
export function markArrive() {
  sessionStorage.setItem(ARRIVE_KEY, "1");
}

export function consumeArrive(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(ARRIVE_KEY);
  if (v) sessionStorage.removeItem(ARRIVE_KEY);
  return Boolean(v);
}
