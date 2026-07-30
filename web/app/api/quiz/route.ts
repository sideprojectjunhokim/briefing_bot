import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { getQuizStats, giveUp, nextQuestion, quip, submitAnswer } from "@/lib/quiz";
import { requireUserId } from "@/lib/session-server";

export const runtime = "nodejs";

/** 다음 문제 + 지금 성적 */
export async function GET() {
  if (!hasDb) return NextResponse.json({ error: "DB 없음" }, { status: 503 });
  const userId = await requireUserId();
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [question, stats] = await Promise.all([nextQuestion(userId), getQuizStats(userId)]);
  return NextResponse.json({ question, stats });
}

/** 답 제출 또는 포기 */
export async function POST(req: Request) {
  if (!hasDb) return NextResponse.json({ error: "DB 없음" }, { status: 503 });
  const userId = await requireUserId();
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: unknown;
    answer?: unknown;
    giveup?: unknown;
  };
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id 필요" }, { status: 400 });
  }

  if (body.giveup === true) {
    const answer = await giveUp(userId, id);
    if (answer === null) return NextResponse.json({ error: "없는 문제" }, { status: 404 });
    return NextResponse.json({ gaveup: true, answer, quip: quip("gaveup") });
  }

  const given = String(body.answer ?? "").trim();
  if (!given) return NextResponse.json({ error: "answer 필요" }, { status: 400 });

  const result = await submitAnswer(userId, id, given);
  if (result === null) return NextResponse.json({ error: "없는 문제" }, { status: 404 });

  return NextResponse.json({
    correct: result.correct,
    ...(result.correct ? { answer: result.answer } : {}),
    quip: quip(result.correct ? "right" : "wrong"),
  });
}
