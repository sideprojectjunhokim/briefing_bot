"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CurrentSetup, IndexEntry } from "@/lib/db";
import type { CustomTopic } from "@/lib/onboarding";
import { TopicPicker, AmountPicker } from "@/components/TopicPicker";
import { starredPickMax } from "@/lib/topics";
import { Shell } from "./Shell";

/**
 * 관심사 설정 — 온보딩에서 고른 걸 나중에 바꾸는 곳.
 *
 * 판은 온보딩과 같은 컴포넌트를 쓴다. 다른 건 "지금 상태로 미리 채워져 있고
 * 저장을 눌러야 반영된다"는 것뿐이다.
 *
 * 끈 관심사는 지우지 않고 enabled=false로 둔다(applySetup). 지웠다가 다시 켜면
 * 예전에 본 것들이 전부 새 소식으로 되살아나기 때문이다.
 */
export function Settings({ current, index, demo }: { current: CurrentSetup; index: IndexEntry[]; demo: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(current.keys);
  const [custom, setCustom] = useState<CustomTopic[]>(current.custom);
  const [starred, setStarred] = useState<string[]>(current.starred);
  const [pickMax, setPickMax] = useState(current.pickMax);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  /** 지금 값이 저장된 값과 같은지 볼 기준선. 저장에 성공하면 여기로 옮겨 온다 */
  const snapshot = (
    k: string[],
    c: { key: string }[],
    s: string[],
    m: number,
  ) => JSON.stringify([[...k].sort(), c.map((x) => x.key).sort(), [...s].sort(), m]);

  // current(서버에서 온 값)와 직접 비교하면, 저장 뒤 router.refresh()가 끝날
  // 때까지 "저장하지 않음"이 떠 있는다 — 저장됐는데 안 된 줄 알게 된다.
  const [baseline, setBaseline] = useState(() =>
    snapshot(current.keys, current.custom, current.starred, current.pickMax),
  );
  const dirty = snapshot(picked, custom, starred, pickMax) !== baseline;

  const total = picked.length + custom.length;

  const save = async () => {
    if (state === "saving" || total === 0) return;
    setState("saving");
    const res = await fetch("/api/prefs/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: picked, custom, starred, pickMax }),
    }).catch(() => null);

    if (!res?.ok) {
      setState("error");
      return;
    }
    setBaseline(snapshot(picked, custom, starred, pickMax));
    setState("saved");
    router.refresh();
  };

  return (
    <Shell index={index} failures={[]} demo={demo} active="settings">
      {() => (
        <div className="st-wrap">
          <header className="ds-main-head">
            <p className="ds-kicker">SETTINGS</p>
            <h2 className="ds-headline">
              무엇을 <em>받으시겠어요</em>?
            </h2>
            <p className="st-sub">
              바꾼 건 <strong>다음 수집부터</strong> 적용됩니다. 이미 쌓인 장은 그대로 남습니다.
              뺀 관심사도 지우지 않으니, 다시 켜도 예전 것이 새 소식으로 되살아나지 않습니다.
            </p>
          </header>

          <TopicPicker
            picked={picked}
            custom={custom}
            starred={starred}
            pickMax={pickMax}
            onToggleStar={(k) =>
              setStarred((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
            }
            onToggle={(k) =>
              setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
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

          <section className="ob-group">
            <h2 className="ob-group-head">한 번에 몇 개까지</h2>
            <p className="ob-note">
              한 장에 담을 항목 수입니다. 적게 고를수록 더 많이 버립니다.
              <br />
              <strong>별표(★)를 붙인 관심사는 {starredPickMax(pickMax)}개까지</strong> 받습니다.
            </p>
            <AmountPicker value={pickMax} onChange={setPickMax} />
          </section>

          {total === 0 && <p className="ob-warn">하나는 남겨야 큐가 채워집니다.</p>}

          <div className="st-bar">
            <span className="st-state">
              {state === "saved" && !dirty
                ? "저장됐습니다"
                : state === "error"
                  ? "저장하지 못했습니다"
                  : dirty
                    ? `${total}개 선택 · 저장하지 않음`
                    : `${total}개 선택`}
            </span>
            <button
              type="button"
              className="btn-primary"
              disabled={!dirty || total === 0 || state === "saving"}
              onClick={save}
            >
              {state === "saving" ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
