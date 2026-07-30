// 서버 컴포넌트·API 라우트에서 "지금 누구인가"를 읽는 한 곳.
// (lib/session.ts는 브라우저 localStorage용 — 이름이 비슷하지만 다른 층이다)
import { cookies } from "next/headers";
import { SESSION_COOKIE, gateEnabled, verifySession } from "./auth";

/**
 * 세션의 userId. 게이트가 꺼진 로컬(서명 키 없음)에서는 1번 유저로 본다 —
 * 데모·로컬 개발에서 로그인 없이 화면을 볼 수 있어야 한다.
 */
export async function currentUserId(): Promise<number | null> {
  if (!gateEnabled()) return 1;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return verifySession(value);
}

/** API 라우트용 — 없으면 throw 대신 null을 돌려주고 호출자가 401을 만든다 */
export async function requireUserId(): Promise<number | null> {
  return currentUserId();
}
