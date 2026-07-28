// 개인용 앱의 가벼운 로컬 세션 — 인증이 아니라 "누구의 브리핑인지" + 연출 트리거.
const USER_KEY = "bb-user";
const ARRIVE_KEY = "bb-arrive";

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
