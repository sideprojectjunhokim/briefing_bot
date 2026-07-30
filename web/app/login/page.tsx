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
 * 로그인/가입 — 아이디와 비밀번호 (07-30 완전 개인화).
 *
 * 이제 아이디가 서버의 계정이다(예전엔 인사말용으로 브라우저에만 남았다).
 * 가입은 초대코드가 있어야 열린다 — 지인 소수 초대제라 이메일이 없다.
 */
function LoginInner() {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const controls = useAnimationControls();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [signup, setSignup] = useState(false);
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
      setError("아이디를 적어주세요.");
      shake();
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        signup
          ? { mode: "signup", username: trimmed, password, invite }
          : { username: trimmed, password },
      ),
    }).catch(() => null);
    setBusy(false);

    if (!res?.ok) {
      const msg = (await res?.json().catch(() => null))?.error;
      setError(msg ?? "지금은 열 수 없습니다.");
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
        body: JSON.stringify({
          keys: setup.keys,
          custom: setup.custom,
          starred: setup.starred,
          pickMax: setup.pickMax,
        }),
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
                {signup ? "새 서류철 만들기" : "서류철 열기"}
              </h1>,
              <p key="s" className="login-sub">
                {signup
                  ? "초대코드가 있어야 합니다. 관심사는 만든 뒤에 고릅니다."
                  : "각자의 서류철은 각자의 아이디로 열립니다."}
              </p>,
              <input
                key="i"
                className="input"
                placeholder="아이디"
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />,
              <input
                key="p"
                className="input"
                type="password"
                placeholder="비밀번호"
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />,
              ...(signup
                ? [
                    <input
                      key="v"
                      className="input"
                      placeholder="초대코드"
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                    />,
                  ]
                : []),
              <button key="b" type="submit" className="btn-primary wide" disabled={busy}>
                {busy ? "여는 중…" : signup ? "만들기" : "열기"}
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
          <button
            type="button"
            className="login-toggle"
            onClick={() => {
              setSignup((s) => !s);
              setError(null);
            }}
          >
            {signup ? "이미 서류철이 있어요 → 열기" : "처음이에요 → 초대코드로 만들기"}
          </button>
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
