"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { FloatingBackdrop } from "@/components/fx/FloatingBackdrop";
import { markArrive, setUser } from "@/lib/session";

/** 온보딩에서 원이 화면을 삼킨 채 도착 — 블루 오버레이가 걷히며 로그인이 드러난다. */
function ArrivalSweep() {
  const params = useSearchParams();
  const reduced = Boolean(useReducedMotion());
  if (params.get("from") !== "onboarding" || reduced) return null;
  return (
    <motion.div
      className="arrival-sweep"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
      style={{ pointerEvents: "none" }}
    />
  );
}

/**
 * 로그인(이름 게이트) — 카드가 스태거로 떠오르고, 빈 제출은 흔들리고,
 * 성공하면 카드가 오른쪽으로 샥 빠지며 메인이 이어받는다.
 */
function LoginInner() {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const controls = useAnimationControls();
  const [name, setName] = useState("");
  const [leaving, setLeaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (leaving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      // 실패 피드백 — 좌우 셰이크
      void controls.start({
        x: [0, -10, 10, -7, 7, -3, 0],
        transition: { duration: 0.4 },
      });
      return;
    }
    setUser(trimmed);
    markArrive();
    if (reduced) {
      router.replace("/");
      return;
    }
    setLeaving(true);
  };

  return (
    <main className="stage">
      <FloatingBackdrop />
      <ArrivalSweep />

      <motion.div
        className="login-card"
        animate={leaving ? { x: "70vw", opacity: 0, rotate: 2 } : undefined}
        transition={{ duration: 0.45, ease: [0.83, 0, 0.17, 1] }}
        onAnimationComplete={() => {
          if (leaving) router.replace("/");
        }}
      >
        <motion.div animate={controls}>
          <motion.div
            className="hero-mark small"
            initial={reduced ? false : { scale: 0, rotate: 10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.15 }}
          >
            📰
          </motion.div>

          <form onSubmit={submit}>
            {[
              <h1 key="t" className="login-title">
                브리핑 열기
              </h1>,
              <p key="s" className="login-sub">
                누구의 아침인가요? 이름을 남겨두면 다음부터 바로 열립니다.
              </p>,
              <input
                key="i"
                className="input"
                placeholder="이름 또는 별명"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />,
              <button key="b" type="submit" className="btn-primary wide">
                브리핑 보러 가기
              </button>,
            ].map((el, i) => (
              <motion.div
                key={i}
                initial={reduced ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.09, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {el}
              </motion.div>
            ))}
          </form>
        </motion.div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
