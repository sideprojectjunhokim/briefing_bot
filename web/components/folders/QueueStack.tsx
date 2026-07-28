"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Briefing, IndexEntry, SkipNudge } from "@/lib/db";
import { metaOf, type ModuleMeta } from "@/lib/modules";
import { agoLabel, parseItems, timeOf } from "@/lib/briefing";
import { formatReadTime } from "@/lib/collect/readtime";
import { consumeArrive } from "@/lib/session";
import { StarToggle } from "@/components/StarToggle";
import { Chat } from "@/components/Chat";
import { FileBody } from "./FileBody";
import { Shell } from "./Shell";

/** 겹쳐 쌓인 폴더가 앞 폴더를 가리는 양 */
const OVERLAP = "-8.05rem";
const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  queue: Briefing[];
  index: IndexEntry[];
  failures: { module_key: string; error: string | null }[];
  nudge: SkipNudge | null;
  demo: boolean;
}

/**
 * 메인 — 안 읽은 큐.
 *
 * 스택이 곧 큐다. 폴더 하나가 안 읽은 장 하나이고, 읽으면 사라진다. 개수는
 * 정해져 있지 않다 — 한가한 시간엔 0장, 바쁜 시간엔 7장이다. 그래서 여기엔
 * "이번 시간의 브리핑" 같은 말이 없다. 시간 칸을 채우는 제품이 아니다.
 *
 * 예전에는 모듈 넷이 고정 칸이었고 각 칸이 항상 최신 수집분만 보여 줬다.
 * 그러면 잠깐 자리를 비운 사이 지나간 건 그냥 사라졌다.
 */
export function QueueStack({ queue, index, failures, nudge, demo }: Props) {
  // 관심사 이름은 DB에서 온다 — 코드엔 직접 추가한 것들의 이름이 없다
  const labels = new Map(index.map((e) => [e.key, e.label]));
  const starOf = new Set(index.filter((e) => e.starred).map((e) => e.key));
  const reduced = Boolean(useReducedMotion());
  const [openId, setOpenId] = useState<number | null>(null);
  // 읽음 처리한 장은 이번 화면에서는 남겨 둔다 — 열자마자 발밑에서 사라지면
  // 어디를 보고 있었는지 놓친다. 다음 방문에 큐에서 빠진다.
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  // 로그인 직후 1회성 연출 플래그 — 최초 렌더에서만 소비
  const arrivedRef = useRef<boolean | null>(null);
  if (arrivedRef.current === null && typeof window !== "undefined") {
    arrivedRef.current = consumeArrive();
  }

  const setRead = useCallback((id: number, read: boolean) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (read) next.add(id);
      else next.delete(id);
      return next;
    });
    void fetch("/api/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, read }),
    }).catch(() => {});
  }, []);

  const open = (b: Briefing) => {
    setOpenId(b.id);
    if (!readIds.has(b.id)) setRead(b.id, true);
  };

  useEffect(() => {
    if (openId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const remaining = queue.filter((b) => !readIds.has(b.id)).length;
  const openBriefing = queue.find((b) => b.id === openId) ?? null;

  return (
    <Shell
      index={index}
      failures={failures}
      demo={demo}
      active={null}
      nudge={nudge}
    >
      {(user) => (
        <>
          <motion.header
            className="ds-main-head"
            initial={arrivedRef.current && !reduced ? { x: "-4%", opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <p className="ds-kicker">UNREAD</p>
            <h2 className="ds-headline">
              {remaining > 0 ? (
                <>
                  {user} 님, 안 읽은 것 <em>{remaining}개</em>.
                </>
              ) : (
                <>다 읽었어요. 새로 쌓이면 여기 놓아둘게요.</>
              )}
            </h2>
          </motion.header>

          {openBriefing ? (
            <OpenSheet
              briefing={openBriefing}
              label={labels.get(openBriefing.module_key)}
              starred={starOf.has(openBriefing.module_key)}
              reduced={reduced}
              onClose={() => setOpenId(null)}
              onUnread={() => {
                setRead(openBriefing.id, false);
                setOpenId(null);
              }}
            />
          ) : queue.length === 0 ? (
            <p className="fs-quiet">
              지금은 쌓인 게 없습니다. 매시 한 번씩 살펴보고, 건질 게 있을 때만 놓아둡니다.
            </p>
          ) : (
            <div className="fs-stack">
              {queue.map((b, i) => (
                <QueueFolder
                  key={b.id}
                  briefing={b}
                  label={labels.get(b.module_key)}
                  pos={i}
                  read={readIds.has(b.id)}
                  reduced={reduced}
                  onOpen={() => open(b)}
                />
              ))}
            </div>
          )}

          {/* 홈에서는 카드 없이 관심사 관리나 짧은 질문용 */}
          <Chat compact placeholder="관심사를 바꾸거나 물어보기 — 예: 인디게임도 추가해줘" />
        </>
      )}
    </Shell>
  );
}

/** 탭 하나 — 스택 위에 있든 펼친 시트 위에 있든 같은 요소다(layoutId) */
function Tab({ meta, id, reduced }: { meta: ModuleMeta; id: number; reduced: boolean }) {
  return (
    <motion.span
      layoutId={reduced ? undefined : `tab-${id}`}
      className="fs-tab"
      style={{ "--tl": `${meta.tabLeft}%` } as React.CSSProperties}
      transition={reduced ? { duration: 0 } : { duration: 0.42, ease: EASE }}
    >
      <span className="fs-tab-en">{meta.en}</span>
      <span className="fs-tab-kr">{meta.name}</span>
    </motion.span>
  );
}

function QueueFolder({
  briefing,
  label,
  pos,
  read,
  reduced,
  onOpen,
}: {
  briefing: Briefing;
  /** DB에서 온 표시 이름. 코드엔 직접 추가한 관심사의 이름이 없다 */
  label?: string;
  /** 스택에서 몇 번째인가 — 겹침과 z축 순서를 정한다 */
  pos: number;
  read: boolean;
  reduced: boolean;
  onOpen: () => void;
}) {
  const meta = metaOf(briefing.module_key, label);
  const first = parseItems(briefing.content)[0];

  return (
    <motion.div
      className="fs-folder"
      data-read={read ? "" : undefined}
      style={{ zIndex: pos + 1, marginTop: pos === 0 ? 0 : OVERLAP }}
      initial={reduced ? false : { opacity: 0, y: 46 }}
      animate={{ opacity: read ? 0.45 : 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { delay: 0.1 + pos * 0.09, type: "spring", stiffness: 320, damping: 26 }
      }
      whileHover={reduced ? undefined : { y: -12 }}
    >
      <Tab meta={meta} id={briefing.id} reduced={reduced} />
      <button type="button" className="fs-face fs-face-btn" onClick={onOpen}>
        <div className="fs-cover-row">
          {/* 읽는 시간이 먼저다 — 쉬는 시간에 집는 물건은 비용을 먼저 알려야 한다 */}
          <span>
            {formatReadTime(briefing.est_read_seconds)}
            {briefing.resurfaced_at
              ? ` · ${agoLabel(briefing.created_at)}`
              : ` · ${timeOf(briefing)} 수집`}
          </span>
          <span className="fs-open-hint">{read ? "읽음" : "OPEN ↓"}</span>
        </div>

        {briefing.thread_note && <p className="fs-thread">↩ {briefing.thread_note}</p>}

        {first ? (
          <>
            <p className="fs-preview">
              {first.source && <span className="src">[{first.source}]</span>}
              {first.title}
            </p>
            {briefing.item_count > 1 && <p className="fs-more">+{briefing.item_count - 1} MORE</p>}
          </>
        ) : (
          <p className="fs-preview">{(briefing.content ?? "").slice(0, 90)}…</p>
        )}
      </button>
    </motion.div>
  );
}

function OpenSheet({
  briefing,
  label,
  starred,
  reduced,
  onClose,
  onUnread,
}: {
  briefing: Briefing;
  label?: string;
  starred: boolean;
  reduced: boolean;
  onClose: () => void;
  onUnread: () => void;
}) {
  const meta = metaOf(briefing.module_key, label);
  return (
    <div className="fs-open">
      <div className="fs-tabrow">
        <Tab meta={meta} id={briefing.id} reduced={reduced} />
      </div>

      <motion.article
        layout={!reduced}
        className="fs-sheet"
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        <div className="fs-sheet-head">
          <div className="fp-meta">
            <span>{formatReadTime(briefing.est_read_seconds)}</span>
            {briefing.item_count > 0 && <span>{briefing.item_count} ITEMS</span>}
            <span>
              {briefing.resurfaced_at ? agoLabel(briefing.created_at) : `${timeOf(briefing)} KST`}
            </span>
          </div>
          <div className="fs-sheet-acts">
            {/* 읽다가 "이거 재밌네" 하는 순간이 별을 붙일 타이밍이다.
                그때 설정으로 나가야 하면 아무도 안 붙인다 */}
            {meta.key !== "wrap" && (
              <StarToggle
                topicKey={briefing.module_key}
                starred={starred}
                label={meta.name}
                className="fs-sheet-star"
              />
            )}
            <button type="button" className="fp-close" onClick={onUnread}>
              안 읽음으로
            </button>
            <button type="button" className="fp-close" onClick={onClose}>
              CLOSE — ESC
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={briefing.id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <h2 className="fp-title">{meta.en}</h2>
            <p className="fp-title-kr">{meta.name}</p>
            {briefing.thread_note && <p className="fs-thread lead">↩ {briefing.thread_note}</p>}
            <FileBody briefing={briefing} meta={meta} />
            {meta.key !== "wrap" && (
              <a className="fs-permalink" href={`/c/${encodeURIComponent(meta.key)}`}>
                {meta.name} 지난 것 보기 ↗
              </a>
            )}
          </motion.div>
        </AnimatePresence>

        {/* 이 카드가 그대로 컨텍스트다 — 복붙 없이 "이거 진짜야?"가 된다 */}
        <Chat cardId={briefing.id} placeholder="이 문서에 대해 물어보기 — 예: 두 번째 거 진짜야?" />
      </motion.article>
    </div>
  );
}
