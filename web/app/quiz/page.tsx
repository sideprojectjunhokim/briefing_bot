import { redirect } from "next/navigation";
import { hasDb, getIndex } from "@/lib/db";
import { getQuizStats, nextQuestion } from "@/lib/quiz";
import { currentUserId } from "@/lib/session-server";
import { QuizSlip } from "@/components/QuizSlip";

// 성적이 실시간으로 바뀐다 — 캐시하면 방금 맞힌 게 안 보인다
export const dynamic = "force-dynamic";

/** 넌센스 퀴즈 — 브리핑 읽다 지겨울 때 오는 곳 */
export default async function QuizPage() {
  if (!hasDb) redirect("/");

  const userId = await currentUserId();
  if (userId === null) redirect("/onboarding");

  const [index, question, stats] = await Promise.all([
    getIndex(userId),
    nextQuestion(userId),
    getQuizStats(userId),
  ]);

  return <QuizSlip index={index} initialQuestion={question} initialStats={stats} />;
}
