import { NextResponse } from "next/server";
import { hasDb, markRead } from "@/lib/db";
import { requireUserId } from "@/lib/session-server";

export const runtime = "nodejs";

/** 읽음 / 안 읽음. 큐에서 빼는 유일한 수단이고, 되돌릴 수도 있다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: number; read?: boolean };
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id 필요" }, { status: 400 });
  }
  // 데모 데이터에는 남길 곳이 없다. 500을 던지면 콘솔만 시끄러워지고,
  // 화면은 어차피 이번 세션 동안만 읽음으로 보인다.
  if (!hasDb) return NextResponse.json({ ok: true, persisted: false });

  const userId = await requireUserId();
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await markRead(userId, id, body.read !== false);
  return NextResponse.json({ ok: true, persisted: true });
}
