"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * 온보딩·로그인 배경 — 서류철에서 굴러다닐 법한 물건들이 아주 느리게 떠다닌다.
 *
 * 예전에는 다크 배경 위 보라·파랑·초록 블러 구체였는데, 그건 이 프로젝트의
 * 팔레트(종이+잉크 근단색, 블루 하나만 팝)와 정반대였고 어느 AI 서비스 랜딩에나
 * 붙어 있는 기본값이었다. 폴더 화면과 아예 다른 제품처럼 보였다.
 *
 * 그래서 모티프를 제품에서 가져왔다 — 서류철, 색인 카드, 결재 도장, 클립, 압정.
 * 색은 --ds-line 하나로, 종이에 연하게 눌린 자국처럼만 보이게 둔다.
 */
type Motif = {
  x: string;
  y: string;
  /** 렌더 크기(px) */
  size: number;
  /** 왕복 이동량 [x, y] px */
  drift: [number, number];
  /** 한 바퀴 초 — 전부 다르게 둬야 주기가 겹쳐 보이지 않는다 */
  dur: number;
  rotate: number;
  draw: React.ReactNode;
};

/** 서류철 — 탭 달린 폴더 */
const folder = (
  <>
    <path d="M1 8h14l3 4h29v26H1z" />
    <path d="M1 8V4h12v4" />
  </>
);

/** 색인 카드 — 괘선 몇 줄 */
const card = (
  <>
    <rect x="1" y="5" width="46" height="30" rx="1.5" />
    <path d="M1 13h46M7 20h30M7 25h22" />
  </>
);

/** 결재 도장 — 두 겹 원 */
const stamp = (
  <>
    <circle cx="24" cy="20" r="17" />
    <circle cx="24" cy="20" r="11" />
    <path d="M18 20h12" />
  </>
);

/** 종이 클립 */
const clip = <path d="M30 6v22a7 7 0 0 1-14 0V10a4 4 0 0 1 8 0v17a1.6 1.6 0 0 1-3.2 0V11" />;

/** 압정 */
const pin = (
  <>
    <path d="M18 3v13l5 6H9l5-6V3z" />
    <path d="M16 22v13" />
  </>
);

const MOTIFS: Motif[] = [
  { x: "9%", y: "16%", size: 132, drift: [26, -18], dur: 23, rotate: -8, draw: folder },
  { x: "78%", y: "12%", size: 96, drift: [-20, 22], dur: 27, rotate: 6, draw: card },
  { x: "84%", y: "64%", size: 88, drift: [-24, -16], dur: 31, rotate: -4, draw: stamp },
  { x: "13%", y: "70%", size: 64, drift: [18, 20], dur: 25, rotate: 12, draw: clip },
  { x: "64%", y: "84%", size: 52, drift: [-14, -22], dur: 29, rotate: -14, draw: pin },
  { x: "42%", y: "5%", size: 58, drift: [12, 16], dur: 33, rotate: 9, draw: clip },
];

export function FloatingBackdrop() {
  const reduced = Boolean(useReducedMotion());

  return (
    <div className="fx-backdrop" aria-hidden>
      {MOTIFS.map((m, i) => (
        <motion.svg
          key={i}
          className="fx-motif"
          viewBox="0 0 48 40"
          style={{ left: m.x, top: m.y, width: m.size, rotate: m.rotate }}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={reduced ? undefined : { x: [0, m.drift[0], 0], y: [0, m.drift[1], 0] }}
          transition={{ duration: m.dur, repeat: Infinity, ease: "easeInOut" }}
        >
          {m.draw}
        </motion.svg>
      ))}
    </div>
  );
}
