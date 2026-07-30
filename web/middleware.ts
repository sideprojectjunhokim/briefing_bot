import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, gateEnabled, verifySession } from "@/lib/auth";

// /api/collect은 게이트 밖이다 — GitHub Actions가 CRON_SECRET으로 스스로 인증한다.
// /onboarding은 로그인 전에 보는 소개 화면이라 열어 둔다.
const PUBLIC_PATHS = ["/login", "/onboarding", "/api/login", "/api/collect"];

export async function middleware(req: NextRequest) {
  if (!gateEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && (await verifySession(cookie)) !== null) return NextResponse.next();

  // API는 리다이렉트가 아니라 401로 — fetch가 로그인 HTML을 받아 파싱하면 더 헷갈린다
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 로그인이 아니라 온보딩으로 보낸다 — 그래야 처음 온 사람이 소개를 보고,
  // 소개에서 로그인으로 이어진다. 로그인이 유일한 입구면 온보딩은 도달 불가다.
  const url = req.nextUrl.clone();
  url.pathname = "/onboarding";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
