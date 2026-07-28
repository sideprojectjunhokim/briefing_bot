"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FloatingBackdrop } from "@/components/fx/FloatingBackdrop";
import { TOPICS, starredPickMax } from "@/lib/topics";
import { saveSetup, type CustomTopic } from "@/lib/onboarding";
import { TopicPicker, AmountPicker } from "@/components/TopicPicker";

const EASE = [0.16, 1, 0.3, 1] as const;

/** 처음 열었을 때 켜져 있는 것 — 전부 켜 두면 첫 큐가 잡글로 넘친다 */
const DEFAULT_ON = ["technews", "hotdeal"];

export default function OnboardingPage() {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(DEFAULT_ON);
  const [custom, setCustom] = useState<CustomTopic[]>([]);
  const [starred, setStarred] = useState<string[]>([]);
  const [pickMax, setPickMax] = useState(8);
  const [leaving, setLeaving] = useState(false);

  const toggle = (key: string) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const total = picked.length + custom.length;

  const finish = () => {
    if (leaving) return;
    saveSetup({ keys: picked, custom, starred, pickMax });
    if (reduced) {
      router.push("/login?from=onboarding");
      return;
    }
    setLeaving(true);
  };

  const steps = [
    {
      key: "welcome",
      wide: false,
      body: (
        <>
          <h1 className="hero-title">
            일하다 쉴 때,
            <br />
            <em>안 읽은 것만</em>.
          </h1>
          <p className="hero-sub">
            매시 한 번씩 살펴보고, 건질 게 있을 때만 한 장씩 놓아둡니다. 없는 시간엔 아무것도
            놓지 않습니다.
          </p>
        </>
      ),
      next: "관심사 고르기",
      ready: true,
    },
    {
      key: "topics",
      wide: true,
      body: (
        <>
          <h1 className="hero-title ob-tight">
            무엇을 <em>받으시겠어요</em>?
          </h1>
          <p className="hero-sub">
            언제든 바꿀 수 있습니다. 없는 게 있으면 맨 아래에 직접 적어 주세요.
          </p>

          <TopicPicker
            picked={picked}
            custom={custom}
            starred={starred}
            pickMax={pickMax}
            onToggle={toggle}
            onToggleStar={(k) =>
              setStarred((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
            }
            onAddCustom={(t) => {
              setCustom((c) => [...c, t]);
              setPicked((p) => [...p, t.key]); // 방금 추가한 건 켜진 채로 시작한다
            }}
            onRemoveCustom={(k) => {
              setCustom((c) => c.filter((x) => x.key !== k));
              setPicked((p) => p.filter((x) => x !== k));
              setStarred((s) => s.filter((x) => x !== k));
            }}
          />

          {total === 0 && <p className="ob-warn">하나는 골라야 큐가 채워집니다.</p>}
        </>
      ),
      next: `${total}개 고름 · 다음`,
      ready: total > 0,
    },
    {
      key: "amount",
      wide: false,
      body: (
        <>
          <h1 className="hero-title">
            한 번에 <em>몇 개까지</em>?
          </h1>
          <p className="hero-sub">
            한 장에 담을 항목 수입니다. 적게 고를수록 더 많이 버립니다 — 버리는 게 이 봇의 일입니다.
            <br />
            앞에서 별표(★)를 붙인 관심사는 {starredPickMax(pickMax)}개까지 받습니다.
          </p>
          <AmountPicker value={pickMax} onChange={setPickMax} />
        </>
      ),
      next: "다음",
      ready: true,
    },
    {
      key: "done",
      wide: false,
      body: (
        <>
          <h1 className="hero-title">
            이렇게 <em>놓아둘게요</em>.
          </h1>
          <dl className="ob-summary">
            <div>
              <dt>받을 것</dt>
              <dd>
                {[
                  ...TOPICS.filter((t) => picked.includes(t.key)).map((t) => t.label),
                  ...custom.map((c) => c.label),
                ].join(" · ")}
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
    <main className="stage ob-stage">
      <FloatingBackdrop />

      <motion.div
        className="hero ob-hero"
        data-wide={cur.wide ? "" : undefined}
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
