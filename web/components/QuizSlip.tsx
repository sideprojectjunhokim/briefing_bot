"use client";

import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { IndexEntry } from "@/lib/db";
import type { QuizQuestion, QuizStats } from "@/lib/quiz";
import { Shell } from "./folders/Shell";

interface Feedback {
  kind: "right" | "wrong" | "gaveup";
  quip: string;
  answer?: string;
}

/**
 * 넌센스 퀴즈 한 장. 문제 슬립 하나, 입력 하나, 성적표 하나 — 그게 전부다.
 *
 * 오답은 서버에 기록되지 않으므로 그 자리에서 계속 다시 낼 수 있다.
 * 맞히거나 포기해야 다음 문제로 넘어간다.
 */
export function QuizSlip({
  index,
  initialQuestion,
  initialStats,
}: {
  index: IndexEntry[];
  initialQuestion: QuizQuestion | null;
  initialStats: QuizStats;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [stats, setStats] = useState(initialStats);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  /** 맞히거나 포기한 뒤 = 다음 문제 버튼이 뜨는 상태 */
  const settled = feedback?.kind === "right" || feedback?.kind === "gaveup";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!question || busy || settled || !answer.trim()) return;
    setBusy(true);
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: question.id, answer }),
    }).catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => null);
    if (!data) return;

    if (data.correct) {
      setFeedback({ kind: "right", quip: data.quip, answer: data.answer });
      setStats((s) => ({ ...s, correct: s.correct + 1 }));
      // 티어·toNext는 다음 문제 요청 때 서버 값으로 맞춘다 — 여기서 계산을
      // 복제하면 사다리를 바꿀 때 한쪽만 고치게 된다
    } else {
      setFeedback({ kind: "wrong", quip: data.quip });
    }
  };

  const giveUp = async () => {
    if (!question || busy || settled) return;
    setBusy(true);
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: question.id, giveup: true }),
    }).catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => null);
    if (data?.answer) setFeedback({ kind: "gaveup", quip: data.quip, answer: data.answer });
  };

  const next = async () => {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/quiz").catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => null);
    if (!data) return;
    setQuestion(data.question);
    setStats(data.stats);
    setAnswer("");
    setFeedback(null);
  };

  return (
    <Shell index={index} failures={[]} demo={false} active="quiz">
      {() => (
        <div className="qz-wrap">
          <header className="ds-main-head">
            <p className="ds-kicker">NONSENSE QUIZ</p>
            <h2 className="ds-headline">
              오늘의 <em>넌센스</em>
            </h2>
          </header>

          <div className="qz-score">
            <span className="qz-tier">{stats.tier}</span>
            <span className="qz-count">{stats.correct}문제 맞힘</span>
            {stats.toNext !== null && (
              <span className="qz-next">다음 티어까지 {stats.toNext}개</span>
            )}
          </div>

          {question ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={question.id}
                className="qz-slip"
                initial={{ opacity: 0, y: 14, rotate: -0.6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, x: 60, rotate: 1.5 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="qz-no">Q.{question.id}</p>
                <p className="qz-question">{question.question}</p>

                <form onSubmit={submit} className="qz-form">
                  <input
                    className="input"
                    placeholder="답을 적어봐"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={settled || busy}
                    autoFocus
                  />
                  {!settled && (
                    <div className="qz-actions">
                      <button type="submit" className="btn-primary" disabled={busy || !answer.trim()}>
                        제출
                      </button>
                      <button type="button" className="qz-giveup" onClick={giveUp} disabled={busy}>
                        모르겠다…
                      </button>
                    </div>
                  )}
                </form>

                {feedback && (
                  <p className={`qz-feedback ${feedback.kind}`}>
                    {feedback.quip}
                    {feedback.kind === "gaveup" && feedback.answer && (
                      <strong> {feedback.answer}</strong>
                    )}
                    {feedback.kind === "right" && feedback.answer && (
                      <span className="qz-answer-echo"> ({feedback.answer})</span>
                    )}
                  </p>
                )}

                {settled && (
                  <button type="button" className="btn-primary wide" onClick={next} disabled={busy}>
                    다음 문제
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <p className="qz-done">
              문제은행을 다 털었다. 넌센스 그 자체가 됐군… 문제가 더 채워지면 다시 와.
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}
