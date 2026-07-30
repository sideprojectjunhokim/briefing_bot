/**
 * 유저별 세션 (07-30 완전 개인화).
 *
 * 예전엔 비밀번호 하나로 만든 상수 토큰이었다 — 한 사람 도구였으니까.
 * 이제 쿠키가 "누구인가"를 담아야 한다: `<userId>.<만료epoch>.<서명>`.
 * 서명은 HMAC-SHA256, 키는 SESSION_SECRET(없으면 CRON_SECRET을 겸용 —
 * 이미 Vercel에 있는 값이라 env가 안 는다).
 *
 * 전부 crypto.subtle로만 쓴 이유: 이 파일은 미들웨어(edge)에서도 돈다.
 * node:crypto가 필요한 비밀번호 해시는 lib/password.ts에 따로 있다.
 */

export const SESSION_COOKIE = "bb_session";

const NINETY_DAYS_S = 60 * 60 * 24 * 90;

function secret(): string {
  return process.env.SESSION_SECRET ?? process.env.CRON_SECRET ?? "";
}

/** 서명 키가 없으면 게이트를 열어 둔다 — 로컬에서 화면 보는 걸 막지 않으려고 */
export function gateEnabled(): boolean {
  return Boolean(secret());
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 로그인 성공 시 쿠키에 넣을 값 */
export async function createSession(userId: number): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + NINETY_DAYS_S;
  const payload = `${userId}.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

/** 쿠키 값 → userId. 서명·만료가 어긋나면 null */
export async function verifySession(cookieValue: string): Promise<number | null> {
  const [id, expires, sig] = cookieValue.split(".");
  if (!id || !expires || !sig) return null;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return null;
  if (!timingSafeEqual(sig, await hmac(`${id}.${expires}`))) return null;
  return userId;
}

/** 길이·내용이 같은지를 상수 시간에 — 문자열 == 는 앞에서부터 빠져나온다 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
