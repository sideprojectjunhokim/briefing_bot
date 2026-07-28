"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { FloatingBackdrop } from "@/components/fx/FloatingBackdrop";
import { markArrive, setUser } from "@/lib/session";
import { consumeSetup } from "@/lib/onboarding";

/** 온보딩에서 종이가 화면을 덮은 채 도착 — 오버레이가 걷히며 로그인이 드러난다. */
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
 * 로그인 — 이름과 비밀번호.
 *
 * 이름은 인사말용이라 브라우저에만 남고, 비밀번호는 서버가 확인해 쿠키를 준다.
 * 예전엔 이름만 받는 연출용 게이트였는데, 읽음 표시가 서버 상태를 바꾸게 되면서
 * 실제 자물쇠가 필요해졌다. APP_PASSWORD를 안 걸어 두면 비밀번호는 그냥 통과한다.
 */
function LoginInner() {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const controls = useAnimationControls();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const shake = () =>
    void controls.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.4 } });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (leaving || busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("이름을 적어주세요.");
      shake();
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);

    if (!res?.ok) {
      setError(res?.status === 401 ? "비밀번호가 다릅니다." : "지금은 열 수 없습니다.");
      shake();
      return;
    }

    // 온보딩에서 고른 값은 여기서 반영한다 — 그 화면은 로그인 전이라
    // 서버에 못 썼다. 실패해도 진행은 막지 않는다(기본값으로 돌면 된다).
    const setup = consumeSetup();
    if (setup) {
      await fetch("/api/prefs/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(setup),
      }).catch(() => {});
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
          <form onSubmit={submit}>
            {[
              <h1 key="t" className="login-title">
                서류철 열기
              </h1>,
              <p key="s" className="login-sub">
                이름은 인사말에만 쓰이고 이 브라우저에 남습니다.
              </p>,
              <input
                key="i"
                className="input"
                placeholder="이름 또는 별명"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />,
              <input
                key="p"
                className="input"
                type="password"
                placeholder="비밀번호"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />,
              <button key="b" type="submit" className="btn-primary wide" disabled={busy}>
                {busy ? "여는 중…" : "열기"}
              </button>,
            ].map((el, i) => (
              <motion.div
                key={i}
                initial={reduced ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {el}
              </motion.div>
            ))}
          </form>
          {error && <p className="login-error">{error}</p>}
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
