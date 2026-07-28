import { NextResponse } from "next/server";
import { runCollection } from "@/lib/collect/run";
import { timingSafeEqual } from "@/lib/auth";

// Anthropic SDK와 Postgres 드라이버가 도는 자리라 Node 런타임.
export const runtime = "nodejs";
// 소스 넷 × (fetch + LLM 1회). Vercel Hobby 상한이 60초라 그 안에 맞춘다.
export const maxDuration = 60;

/**
 * 매시 수집. 시계는 GitHub Actions이고 여기는 그 시계가 때리는 종이다.
 *
 * 브라우저 주소창으로도 부를 수 있게 GET을 열어 뒀다 — 수동 실행·디버그 경로다.
 * 인증은 CRON_SECRET 하나(미들웨어 게이트 밖에 있다).
 */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 });
  }

  const url = new URL(req.url);
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";
  if (!timingSafeEqual(given, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCollection({ only: url.searchParams.get("module") ?? undefined });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // 여기까지 올라온 건 DB 자체가 안 붙는 류다 — 500으로 Actions 로그에 남긴다
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
