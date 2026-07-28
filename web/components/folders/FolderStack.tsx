"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Briefing } from "@/lib/supabase";
import { MODULE_ORDER, type ModuleMeta } from "@/lib/modules";
import { parseItems, timeOf } from "@/lib/briefing";
import { consumeArrive } from "@/lib/session";
import { FileBody } from "./FileBody";
import { Shell } from "./Shell";

/** 겹쳐 쌓인 폴더가 앞 폴더를 가리는 양 */
const OVERLAP = "-8.05rem";
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * 메인 — 종이 서류철.
 *
 * 두 가지 상태만 있다.
 *   닫힘: 폴더 넷이 겹쳐 쌓인 스택. 탭과 첫 줄만 보인다.
 *   열림: **탭 넷이 문서 위에 줄로 서고**, 그 아래 문서 한 장이 펼쳐진다.
 *
 * 상태를 오갈 때 탭은 layoutId로 **같은 요소가 이동**한다 — 사라졌다 나타나는 게
 * 아니라 스택 위 제자리에서 탭 줄로 날아간다. 그래서 어디서 왔는지가 눈에 남는다.
 *
 * 예전에는 폴더를 위로 날린 뒤 /c/[key]로 하드 전환했는데, 날아간 폴더와 새로
 * 그려지는 페이지 사이에 아무 연결이 없어 매번 뚝 끊겼다. 매일 아침 30초 보는
 * 도구라 클릭마다 페이지가 갈리면 피곤하다. /c/[key]는 공유용으로 그대로 살아 있다.
 */
export function FolderStack({ briefings, demo }: { briefings: Briefing[]; demo: boolean }) {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const [openKey, setOpenKey] = useState<string | null>(null);
  // 로그인 직후 1회성 연출 플래그 — 최초 렌더에서만 소비
  const arrivedRef = useRef<boolean | null>(null);
  if (arrivedRef.current === null && typeof window !== "undefined") {
    arrivedRef.current = consumeArrive();
  }

  const byModule = new Map(briefings.map((b) => [b.module_key, b]));
  const totalNew = briefings
    .filter((b) => b.status === "ok")
    .reduce((n, b) => n + b.item_count, 0);
  const openMeta = MODULE_ORDER.find((m) => m.key === openKey) ?? null;
  const openBriefing = openKey ? (byModule.get(openKey) ?? null) : null;

  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openKey]);

  /** 탭 하나 — 스택 위에 있든 탭 줄에 있든 같은 요소다(layoutId) */
  const Tab = ({ m, active }: { m: ModuleMeta; active: boolean }) => (
    <motion.button
      type="button"
      layoutId={reduced ? undefined : `tab-${m.key}`}
      className="fs-tab fs-tab-btn"
      data-active={active ? "" : undefined}
      // 탭은 펼치든 접든 **제자리에 있는다.** 실제 서류철이 그렇듯 좌우로 어긋나
      // 꽂혀 있어서 넷이 한눈에 보이고, 누른 것만 앞으로 나온다.
      style={{ "--tl": `${m.tabLeft}%` } as React.CSSProperties}
      aria-label={`${m.name} ${active ? "닫기" : "열기"}`}
      aria-expanded={active}
      onClick={() => setOpenKey(active ? null : m.key)}
      onMouseEnter={() => router.prefetch(`/c/${m.key}`)}
      transition={reduced ? { duration: 0 } : { duration: 0.42, ease: EASE }}
    >
      <span className="fs-tab-en">{m.en}</span>
      <span className="fs-tab-kr">{m.name}</span>
    </motion.button>
  );

  return (
    <Shell briefings={briefings} demo={demo} active={openKey}>
      {(user) => (
        <>
          <motion.header
            className="ds-main-head"
            initial={arrivedRef.current && !reduced ? { x: "-4%", opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <p className="ds-kicker">DAILY FILES</p>
            <h2 className="ds-headline">
              {user} 님, 밤사이 서류 <em>{totalNew}건</em>이 도착했어요.
            </h2>
          </motion.header>

          {openMeta ? (
            <div className="fs-open">
              {/* 탭 줄 — 열려 있는 동안 넷 다 보인다. 다른 탭을 누르면 문서만 갈린다 */}
              <div className="fs-tabrow" role="tablist">
                {MODULE_ORDER.map((m) => (
                  <Tab key={m.key} m={m} active={m.key === openMeta.key} />
                ))}
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
                    {openBriefing?.status === "ok" && <span>{openBriefing.item_count} ITEMS</span>}
                    {openBriefing && <span>GENERATED {timeOf(openBriefing)} KST</span>}
                  </div>
                  <button type="button" className="fp-close" onClick={() => setOpenKey(null)}>
                    CLOSE — ESC
                  </button>
                </div>

                {/* 탭을 갈아탈 때 본문만 교체된다 — 탭도 종이도 그대로 있다 */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={openMeta.key}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    <h2 className="fp-title">{openMeta.en}</h2>
                    <p className="fp-title-kr">{openMeta.name}</p>
                    <FileBody briefing={openBriefing} meta={openMeta} />
                    <a className="fs-permalink" href={`/c/${openMeta.key}`}>
                      이 파일만 따로 보기 ↗
                    </a>
                  </motion.div>
                </AnimatePresence>
              </motion.article>
            </div>
          ) : (
            <div className="fs-stack">
              {MODULE_ORDER.map((m, i) => {
                const b = byModule.get(m.key) ?? null;
                const ok = b?.status === "ok";
                const first = ok ? parseItems(b.content)[0] : undefined;

                return (
                  <motion.div
                    key={m.key}
                    className="fs-folder"
                    style={{ zIndex: i + 1, marginTop: i === 0 ? 0 : OVERLAP }}
                    initial={reduced ? false : { opacity: 0, y: 46 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { delay: 0.1 + i * 0.09, type: "spring", stiffness: 320, damping: 26 }
                    }
                    whileHover={reduced ? undefined : { y: -12 }}
                  >
                    <Tab m={m} active={false} />
                    <div className="fs-face" onClick={() => setOpenKey(m.key)}>
                      <div className="fs-cover-row">
                        {ok ? (
                          <span>
                            {b.item_count}건 · {timeOf(b)} 수집
                          </span>
                        ) : b?.status === "failed" ? (
                          <span className="ds-flag-fail">수집 실패</span>
                        ) : (
                          <span>NO NEWS</span>
                        )}
                        <span className="fs-open-hint">OPEN ↓</span>
                      </div>
                      {first ? (
                        <>
                          <p className="fs-preview">
                            {first.source && <span className="src">[{first.source}]</span>}
                            {first.title}
                          </p>
                          {ok && b.item_count > 1 && (
                            <p className="fs-more">+{b.item_count - 1} MORE</p>
                          )}
                        </>
                      ) : (
                        <p className="fs-empty-note">오늘 새 소식 없음</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
