import { NextResponse } from "next/server";
import { runChat, type ChatTurn } from "@/lib/chat/agent";
import { hasDb } from "@/lib/db";

export const runtime = "nodejs";
// 도구를 부르면 왕복이 늘고, deep 모델은 한 번에 10초쯤 걸린다
export const maxDuration = 60;

/** 대화 기록이 길어지면 토큰만 먹는다. 최근 것만 보낸다 */
const MAX_TURNS = 12;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { messages?: unknown; cardId?: unknown };

  const turns = Array.isArray(body.messages)
    ? (body.messages.filter(
        (m): m is ChatTurn =>
          !!m &&
          typeof m === "object" &&
          (m as ChatTurn).role !== undefined &&
          typeof (m as ChatTurn).content === "string",
      ) as ChatTurn[])
    : [];

  if (turns.length === 0) return NextResponse.json({ error: "messages 필요" }, { status: 400 });
  if (!hasDb) return NextResponse.json({ error: "DB 없음" }, { status: 503 });

  const cardId = Number(body.cardId);
  try {
    const result = await runChat(
      turns.slice(-MAX_TURNS),
      Number.isInteger(cardId) && cardId > 0 ? cardId : undefined,
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
