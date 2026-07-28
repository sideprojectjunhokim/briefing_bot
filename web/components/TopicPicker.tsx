"use client";

import { FormEvent, useState } from "react";
import { TOPICS, TOPIC_GROUPS, customKey, starredPickMax } from "@/lib/topics";
import type { CustomTopic } from "@/lib/onboarding";

interface Props {
  picked: string[];
  custom: CustomTopic[];
  /** 별표 — 더 많이 받기로 한 것 */
  starred: string[];
  /** 별표 안 한 것의 기본 상한. 별을 눌렀을 때 몇 개가 되는지 보여 주려고 받는다 */
  pickMax: number;
  onToggle: (key: string) => void;
  onToggleStar: (key: string) => void;
  onAddCustom: (t: CustomTopic) => void;
  onRemoveCustom: (key: string) => void;
}

/**
 * 관심사 카드 한 장.
 *
 * 카드 자체가 버튼이라 별을 그 안에 넣을 수 없다(버튼 안의 버튼). 그래서
 * 감싸는 칸을 두고 별을 그 위에 얹는다.
 */
function Card({
  label,
  hint,
  on,
  starred,
  starMax,
  onToggle,
  onToggleStar,
}: {
  label: string;
  hint: string;
  on: boolean;
  starred: boolean;
  starMax: number;
  onToggle: () => void;
  onToggleStar?: () => void;
}) {
  return (
    <div className="ob-card-wrap">
      <button
        type="button"
        className="ob-card"
        data-on={on ? "" : undefined}
        data-star={starred ? "" : undefined}
        aria-pressed={on}
        onClick={onToggle}
      >
        <span className="lb">{label}</span>
        <span className="ht">{hint}</span>
        <span className="mk" aria-hidden>
          {on ? "✓" : "+"}
        </span>
      </button>

      {on && onToggleStar && (
        <button
          type="button"
          className="ob-star"
          data-on={starred ? "" : undefined}
          aria-pressed={starred}
          aria-label={`${label} ${starred ? "별표 빼기" : `별표 — ${starMax}개까지 받기`}`}
          title={starred ? "별표 빼기" : `별표 — ${starMax}개까지 받기`}
          onClick={onToggleStar}
        >
          ★
        </button>
      )}
    </div>
  );
}

/**
 * 관심사 고르는 판. **온보딩과 설정이 같은 걸 쓴다.**
 *
 * 두 곳에 복사해 두면 한쪽만 고쳐진다 — 이 저장소에서 이미 한 번 당한 실수라
 * (펼친 폴더와 /c/[key]가 본문을 각자 그렸다) 처음부터 하나로 둔다.
 */
export function TopicPicker({
  picked,
  custom,
  starred,
  pickMax,
  onToggle,
  onToggleStar,
  onAddCustom,
  onRemoveCustom,
}: Props) {
  const starMax = starredPickMax(pickMax);
  const [draft, setDraft] = useState("");

  const add = (e: FormEvent) => {
    e.preventDefault();
    const label = draft.trim().slice(0, 40);
    if (!label) return;
    const key = customKey(label);
    // 이미 있는 것과 프리셋에 같은 이름이 있으면 조용히 무시한다
    if (!custom.some((c) => c.key === key) && !TOPICS.some((t) => t.label === label)) {
      onAddCustom({ key, label });
    }
    setDraft("");
  };

  return (
    <>
      {TOPIC_GROUPS.map((group) => (
        <section key={group} className="ob-group">
          <h2 className="ob-group-head">{group}</h2>
          <div className="ob-grid">
            {TOPICS.filter((t) => t.group === group).map((t) => (
              <Card
                key={t.key}
                label={t.label}
                hint={t.hint}
                on={picked.includes(t.key)}
                starred={starred.includes(t.key)}
                starMax={starMax}
                onToggle={() => onToggle(t.key)}
                onToggleStar={() => onToggleStar(t.key)}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="ob-group">
        <h2 className="ob-group-head">직접 추가</h2>
        <p className="ob-note">
          적으신 말이 그대로 검색어가 됩니다. 그 관심사도 다른 것들과 똑같이 한 장씩 쌓입니다.
        </p>
        <form className="ob-add" onSubmit={add}>
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
              <Card
                key={c.key}
                label={c.label}
                hint="직접 추가 · 누르면 뺍니다"
                on
                starred={starred.includes(c.key)}
                starMax={starMax}
                onToggle={() => onRemoveCustom(c.key)}
                onToggleStar={() => onToggleStar(c.key)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** 한 장에 담을 항목 상한 — 온보딩과 설정이 같은 선택지를 쓴다 */
export const AMOUNTS = [
  { value: 3, label: "적게", note: "쉬는 시간에 딱 하나씩" },
  { value: 8, label: "보통", note: "훑고 고를 만큼" },
  { value: 12, label: "많이", note: "웬만하면 다 보고 판단" },
];

export function AmountPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="ob-amounts">
      {AMOUNTS.map((a) => (
        <button
          key={a.value}
          type="button"
          className="ob-amount"
          data-on={value === a.value ? "" : undefined}
          aria-pressed={value === a.value}
          onClick={() => onChange(a.value)}
        >
          <span className="num">{a.value}</span>
          <span className="lb">{a.label}</span>
          <span className="nt">{a.note}</span>
        </button>
      ))}
    </div>
  );
}
