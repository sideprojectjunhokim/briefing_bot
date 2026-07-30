import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSession, gateEnabled, timingSafeEqual } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createUser, getUserByUsername, hasDb } from "@/lib/db";

export const runtime = "nodejs";

const NINETY_DAYS = 60 * 60 * 24 * 90;

/**
 * 로그인과 가입이 한 라우트다 — 화면이 하나라서.
 * 가입은 초대코드(env INVITE_CODE)가 맞아야만 열린다. 지인 소수 초대제라
 * 이메일도 인증 메일도 없다 — 코드 하나 돌리고, 새면 env를 바꾼다.
 */
export async function POST(req: Request) {
  if (!gateEnabled() || !hasDb) {
    return NextResponse.json({ ok: true, gate: "disabled" });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    username?: string;
    password?: string;
    invite?: string;
  };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || username.length > 20) {
    return NextResponse.json({ error: "아이디는 1~20자입니다" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상입니다" }, { status: 400 });
  }

  let userId: number;

  if (body.mode === "signup") {
    const invite = process.env.INVITE_CODE ?? "";
    if (!invite || !timingSafeEqual(String(body.invite ?? ""), invite)) {
      return NextResponse.json({ error: "초대코드가 다릅니다" }, { status: 401 });
    }
    try {
      userId = await createUser(username, await hashPassword(password));
    } catch {
      return NextResponse.json({ error: "이미 있는 아이디입니다" }, { status: 409 });
    }
  } else {
    const user = await getUserByUsername(username);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      // 아이디 없음/비번 틀림을 구분해 주지 않는다 — 초대제라도 습관은 지킨다
      return NextResponse.json({ error: "아이디 또는 비밀번호가 다릅니다" }, { status: 401 });
    }
    userId = user.id;
  }

  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(SESSION_COOKIE, await createSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: NINETY_DAYS,
  });
  return res;
}

/** 나가기 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
