import { NextResponse } from "next/server";
import { SESSION_COOKIE, gateEnabled, sessionToken, timingSafeEqual } from "@/lib/auth";

export const runtime = "nodejs";

const NINETY_DAYS = 60 * 60 * 24 * 90;

export async function POST(req: Request) {
  if (!gateEnabled()) {
    return NextResponse.json({ ok: true, gate: "disabled" });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const given = String(body.password ?? "");
  if (!timingSafeEqual(given, process.env.APP_PASSWORD ?? "")) {
    return NextResponse.json({ error: "비밀번호가 다릅니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
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
