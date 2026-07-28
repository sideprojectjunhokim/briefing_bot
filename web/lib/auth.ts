/**
 * 한 사람이 쓰는 도구의 최소 자물쇠.
 *
 * 예전엔 이름만 localStorage에 넣는 연출용 로그인이었다. 그때는 화면이 읽기
 * 전용이라 그걸로 충분했는데, 이제 "읽음" 표시가 서버 상태를 바꾼다 — URL만
 * 알면 남의 큐를 비울 수 있다는 뜻이다. 그래서 쿠키 게이트를 붙였다.
 *
 * 사용자 계정 체계가 아니다. 비밀번호 하나, 그걸로 만든 상수 토큰 하나.
 * 다중 사용자로 열 때 제대로 된 인증으로 갈아탄다.
 */

export const SESSION_COOKIE = "bb_session";

/** APP_PASSWORD가 없으면 게이트를 열어 둔다 — 로컬에서 화면 보는 걸 막지 않으려고 */
export function gateEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/**
 * 쿠키에 담을 값. 비밀번호 자체를 쿠키에 넣지 않으려고 한 번 돌린다.
 * 세션마다 다른 값이 아니라 비밀번호에서 결정되는 상수라, 비밀번호를 바꾸면
 * 기존 쿠키가 전부 무효가 된다(그게 로그아웃 수단이기도 하다).
 */
export async function sessionToken(): Promise<string> {
  const password = process.env.APP_PASSWORD;
  if (!password) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("briefing-bot"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 길이·내용이 같은지를 상수 시간에 — 문자열 == 는 앞에서부터 빠져나온다 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
