import { NextResponse } from "next/server";
import { hasDb, setStar } from "@/lib/db";
import { requireUserId } from "@/lib/session-server";

export const runtime = "nodejs";

/** 별표 하나만 뒤집는다 — 읽던 자리에서 바로 누르는 경로 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; starred?: unknown };
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return NextResponse.json({ error: "key 필요" }, { status: 400 });

  const starred = body.starred !== false;
  if (!hasDb) return NextResponse.json({ ok: true, persisted: false });

  const userId = await requireUserId();
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pickMax = await setStar(userId, key, starred);
  return NextResponse.json({ ok: true, persisted: true, starred, pickMax });
}
