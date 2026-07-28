"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FloatingBackdrop } from "@/components/fx/FloatingBackdrop";
import { MODULE_ORDER } from "@/lib/modules";
import { saveSetup } from "@/lib/onboarding";

const EASE = [0.16, 1, 0.3, 1] as const;

/** 한 장에 담을 항목 상한. 원래 사양의 "브리핑 시간 선택" 자리를 대신한다 */
const AMOUNTS = [
  { value: 3, label: "적게", note: "쉬는 시간에 딱 하나씩" },
  { value: 8, label: "보통", note: "훑고 고를 만큼" },
  { value: 12, label: "많이", note: "웬만하면 다 보고 판단" },
];

/**
 * 온보딩 — 3스텝 + 완료.
 *
 * 원래 사양(docs/07)은 웰컴 → 관심 분야 → **브리핑 시간** → 완료였는데,
 * 시간당 큐로 바뀌면서 "몇 시에 볼지"라는 개념이 사라졌다. 그 자리에 "한 번에
 * 몇 개까지"를 넣어 module_prefs.pick_max로 잇는다.
 *
 * 고른 값은 여기서 서버에 안 쓴다 — 아직 로그인 전이라 미인증 쓰기가 된다.
 * localStorage에 담아 두고 로그인 성공 직후에 반영한다(lib/onboarding.ts).
 *
 * 자동 이동은 넣지 않는다. 예전에 "이름이 이미 있으면 홈으로"가 있었는데,
 * 이름은 있고 쿠키는 없는 상태에서 홈 ↔ 온보딩으로 무한히 돈다.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(MODULE_ORDER.map((m) => m.key));
  const [pickMax, setPickMax] = useState(8);
  const [leaving, setLeaving] = useState(false);

  const toggle = (key: string) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const finish = () => {
    if (leaving) return;
    saveSetup({ modules: picked, pickMax });
    if (reduced) {
      router.push("/login?from=onboarding");
      return;
    }
    setLeaving(true);
  };

  const steps = [
    {
      key: "welcome",
      body: (
        <>
          <h1 className="hero-title">
            일하다 쉴 때,
            <br />
            <em>안 읽은 것만</em>.
          </h1>
          <p className="hero-sub">
            매시 한 번씩 살펴보고, 건질 게 있을 때만 한 장씩 놓아둡니다. 없는 시간엔
            아무것도 놓지 않습니다.
          </p>
        </>
      ),
      next: "무엇을 받을지 고르기",
      ready: true,
    },
    {
      key: "modules",
      body: (
        <>
          <h1 className="hero-title">
            무엇을 <em>받으시겠어요</em>?
          </h1>
          <p className="hero-sub">언제든 바꿀 수 있습니다. 안 읽고 넘기는 게 잦으면 먼저 물어봅니다.</p>
          <div className="ob-chips">
            {MODULE_ORDER.map((m) => {
              const on = picked.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  className="ob-chip"
                  data-on={on ? "" : undefined}
                  aria-pressed={on}
                  onClick={() => toggle(m.key)}
                >
                  <span className="en">{m.en}</span>
                  <span className="kr">{m.name}</span>
                </button>
              );
            })}
          </div>
          {picked.length === 0 && <p className="ob-warn">하나는 골라야 큐가 채워집니다.</p>}
        </>
      ),
      next: "다음",
      ready: picked.length > 0,
    },
    {
      key: "amount",
      body: (
        <>
          <h1 className="hero-title">
            한 번에 <em>몇 개까지</em>?
          </h1>
          <p className="hero-sub">
            한 장에 담을 항목 수입니다. 적게 고를수록 더 많이 버립니다 — 버리는 게 이 봇의 일입니다.
          </p>
          <div className="ob-amounts">
            {AMOUNTS.map((a) => (
              <button
                key={a.value}
                type="button"
                className="ob-amount"
                data-on={pickMax === a.value ? "" : undefined}
                aria-pressed={pickMax === a.value}
                onClick={() => setPickMax(a.value)}
              >
                <span className="num">{a.value}</span>
                <span className="lb">{a.label}</span>
                <span className="nt">{a.note}</span>
              </button>
            ))}
          </div>
        </>
      ),
      next: "다음",
      ready: true,
    },
    {
      key: "done",
      body: (
        <>
          <h1 className="hero-title">
            이렇게 <em>놓아둘게요</em>.
          </h1>
          <dl className="ob-summary">
            <div>
              <dt>받을 것</dt>
              <dd>
                {MODULE_ORDER.filter((m) => picked.includes(m.key))
                  .map((m) => m.name)
                  .join(" · ")}
              </dd>
            </div>
            <div>
              <dt>한 장에</dt>
              <dd>최대 {pickMax}개</dd>
            </div>
            <div>
              <dt>주기</dt>
              <dd>매시 — 건질 게 없으면 거릅니다</dd>
            </div>
          </dl>
        </>
      ),
      next: "서류철 열기",
      ready: true,
    },
  ];

  const cur = steps[step];
  const last = step === steps.length - 1;

  return (
    <main className="stage">
      <FloatingBackdrop />

      <motion.div
        className="hero ob-hero"
        animate={leaving ? { opacity: 0, y: -24, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <p className="hero-mark">
          UNREAD
          <br />
          FILES
        </p>

        {/* 스텝 본문만 갈린다 — 워드마크와 진행 표시는 제자리에 있는다 */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cur.key}
            initial={reduced ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: -28 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            {cur.body}
          </motion.div>
        </AnimatePresence>

        <div className="ob-nav">
          {step > 0 ? (
            <button type="button" className="ob-back" onClick={() => setStep((s) => s - 1)}>
              뒤로
            </button>
          ) : (
            <span />
          )}

          <div className="ob-dots" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.key} data-on={i === step ? "" : undefined} />
            ))}
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={!cur.ready}
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
          >
            {cur.next}
          </button>
        </div>
      </motion.div>

      {/* 종이 한 장이 올라와 덮으면 로그인으로 */}
      {leaving && (
        <motion.div
          className="sweep-circle"
          initial={{ scale: 0 }}
          animate={{ scale: 42 }}
          transition={{ duration: 0.6, ease: [0.83, 0, 0.17, 1] }}
          onAnimationComplete={() => router.push("/login?from=onboarding")}
        />
      )}
    </main>
  );
}
