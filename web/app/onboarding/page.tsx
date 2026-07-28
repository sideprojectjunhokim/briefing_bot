"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FloatingBackdrop } from "@/components/fx/FloatingBackdrop";
import { TOPICS, TOPIC_GROUPS, customKey } from "@/lib/topics";
import { saveSetup, type CustomTopic } from "@/lib/onboarding";

const EASE = [0.16, 1, 0.3, 1] as const;

/** 한 장에 담을 항목 상한. 원래 사양의 "브리핑 시간 선택" 자리를 대신한다 */
const AMOUNTS = [
  { value: 3, label: "적게", note: "쉬는 시간에 딱 하나씩" },
  { value: 8, label: "보통", note: "훑고 고를 만큼" },
  { value: 12, label: "많이", note: "웬만하면 다 보고 판단" },
];

/** 처음 열었을 때 켜져 있는 것 — 전부 켜 두면 첫 큐가 잡글로 넘친다 */
const DEFAULT_ON = ["technews", "hotdeal"];

export default function OnboardingPage() {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(DEFAULT_ON);
  const [custom, setCustom] = useState<CustomTopic[]>([]);
  const [draft, setDraft] = useState("");
  const [pickMax, setPickMax] = useState(8);
  const [leaving, setLeaving] = useState(false);

  const toggle = (key: string) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    const label = draft.trim().slice(0, 40);
    if (!label) return;
    const key = customKey(label);
    if (custom.some((c) => c.key === key) || TOPICS.some((t) => t.label === label)) {
      setDraft("");
      return;
    }
    setCustom((prev) => [...prev, { key, label }]);
    setDraft("");
  };

  const total = picked.length + custom.length;

  const finish = () => {
    if (leaving) return;
    saveSetup({ keys: picked, custom, pickMax });
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

          {TOPIC_GROUPS.map((group) => (
            <section key={group} className="ob-group">
              <h2 className="ob-group-head">{group}</h2>
              <div className="ob-grid">
                {TOPICS.filter((t) => t.group === group).map((t) => {
                  const on = picked.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      className="ob-card"
                      data-on={on ? "" : undefined}
                      aria-pressed={on}
                      onClick={() => toggle(t.key)}
                    >
                      <span className="lb">{t.label}</span>
                      <span className="ht">{t.hint}</span>
                      <span className="mk" aria-hidden>
                        {on ? "✓" : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="ob-group">
            <h2 className="ob-group-head">직접 추가</h2>
            <p className="ob-note">
              적으신 말이 그대로 검색어가 됩니다. 그 관심사도 다른 것들과 똑같이 한 장씩 쌓입니다.
            </p>
            <form className="ob-add" onSubmit={addCustom}>
              <input
                className="input"
                placeholder="예: 레고, 홈서버, F1, 등산화"
                value={draft}
                maxLength={40}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="ob-add-btn" disabled={!draft.trim()}>
                추가
              </button>
            </form>
            {custom.length > 0 && (
              <div className="ob-grid">
                {custom.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="ob-card"
                    data-on=""
                    onClick={() => setCustom((prev) => prev.filter((x) => x.key !== c.key))}
                  >
                    <span className="lb">{c.label}</span>
                    <span className="ht">직접 추가 · 누르면 뺍니다</span>
                    <span className="mk" aria-hidden>
                      ✓
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

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
