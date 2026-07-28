"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { FloatingBackdrop } from "@/components/fx/FloatingBackdrop";
import { getUser } from "@/lib/session";

/**
 * 온보딩 — 떠다니는 배경 위 히어로. "시작하기"를 누르면 콘텐츠가 가라앉으며
 * 브랜드 블루 원이 화면을 삼키고(슈루룩) 로그인으로 넘어간다.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const [leaving, setLeaving] = useState(false);

  // 이미 이름이 있으면 온보딩 생략
  useEffect(() => {
    if (getUser()) router.replace("/");
  }, [router]);

  const start = () => {
    if (leaving) return;
    if (reduced) {
      router.push("/login?from=onboarding");
      return;
    }
    setLeaving(true);
  };

  return (
    <main className="stage">
      <FloatingBackdrop />

      <motion.div
        className="hero"
        animate={leaving ? { opacity: 0, y: -24, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* 이모지 앱 아이콘 대신 워드마크 — 본편 사이드바와 같은 글자라
            로그인하기 전부터 같은 제품 안에 있다는 게 읽힌다 */}
        <motion.p
          className="hero-mark"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          TODAY&apos;S
          <br />
          BRIEFING
        </motion.p>

        {[
          <h1 key="t" className="hero-title">
            밤사이 쌓인 것들을,
            <br />
            <em>아침에 한 번</em>.
          </h1>,
          <p key="s" className="hero-sub">
            핫딜 · 시세 · 테크 뉴스 · 커뮤니티를 새벽에 모아 두고, 무엇이 달라졌는지
            한 문단으로 먼저 알려드립니다. 목록은 그 다음입니다.
          </p>,
          <button key="b" className="btn-primary" onClick={start}>
            서류철 열기
          </button>,
        ].map((el, i) => (
          <motion.div
            key={i}
            initial={reduced ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {el}
          </motion.div>
        ))}
      </motion.div>

      {/* 화면을 삼키는 원 — 확장이 끝나면 로그인으로 */}
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
