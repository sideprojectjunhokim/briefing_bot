"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 읽던 자리에서 바로 누르는 별.
 *
 * 낙관적으로 먼저 바뀌고 서버는 뒤따라간다 — 별 하나 붙이자고 응답을 기다리게
 * 하면 그 순간의 "어 이거 재밌네"가 식는다. 실패하면 원래대로 되돌린다.
 */
export function StarToggle({
  topicKey,
  starred,
  label,
  className = "",
}: {
  topicKey: string;
  starred: boolean;
  /** 스크린리더용 이름 */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(starred);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    // 색인 줄처럼 링크 안에 얹힌 자리가 있어서, 별을 눌렀는데 페이지가 넘어가면 안 된다
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !on;
    setOn(next);
    setBusy(true);
    const res = await fetch("/api/prefs/star", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: topicKey, starred: next }),
    }).catch(() => null);
    setBusy(false);

    if (!res?.ok) {
      setOn(!next);
      return;
    }
    router.refresh();
  };

  return (
    <button
      type="button"
      className={`star-toggle ${className}`.trim()}
      data-on={on ? "" : undefined}
      aria-pressed={on}
      aria-label={`${label} ${on ? "별표 빼기" : "별표 — 더 많이 받기"}`}
      title={on ? "별표 빼기" : "더 많이 받기"}
      onClick={toggle}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
