import { NextResponse } from "next/server";
import { answerNudge, hasDb } from "@/lib/db";
import { requireUserId } from "@/lib/session-server";

export const runtime = "nodejs";

const ANSWERS = ["reduce", "mute", "keep"] as const;
type Answer = (typeof ANSWERS)[number];

/** "이 모듈 줄일까요?"에 대한 답. 'keep'도 답이다 — 2주 동안 다시 안 묻는다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { module?: string; answer?: string };
  const moduleKey = String(body.module ?? "");
  const answer = String(body.answer ?? "");
  if (!moduleKey || !ANSWERS.includes(answer as Answer)) {
    return NextResponse.json({ error: "module, answer 필요" }, { status: 400 });
  }
  if (!hasDb) return NextResponse.json({ ok: true, persisted: false });

  const userId = await requireUserId();
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await answerNudge(userId, moduleKey, answer as Answer);
  return NextResponse.json({ ok: true, persisted: true });
}
