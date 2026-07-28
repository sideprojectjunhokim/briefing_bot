"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { Briefing } from "@/lib/db";
import type { ModuleMeta } from "@/lib/modules";
import { dateOf, timeOf } from "@/lib/briefing";
import { formatReadTime } from "@/lib/collect/readtime";
import { FileBody } from "./FileBody";
import { Shell } from "./Shell";

/**
 * 모듈 하나의 지난 장들.
 *
 * 큐(홈)는 "아직 안 읽은 것"만 보여 준다. 읽고 나면 사라지는데, 그렇다고
 * 없어진 건 아니라서 되찾을 곳이 필요하다. 여기가 그곳이다 — 읽은 것도 같이
 * 있고, 한 장씩 접었다 편다.
 */
export function ModuleArchive({
  briefings,
  meta,
  unreadByModule,
  demo,
}: {
  briefings: Briefing[];
  meta: ModuleMeta;
  unreadByModule: Record<string, number>;
  demo: boolean;
}) {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const [openId, setOpenId] = useState<number | null>(briefings[0]?.id ?? null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Shell unreadByModule={unreadByModule} failures={[]} demo={demo} active={meta.key}>
      {() => (
        <div className="fp-wrap">
          <motion.article
            className="fp-sheet"
            initial={reduced ? false : { y: "6vh", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="fs-tab fp-tab"
              style={{ "--tl": `${meta.tabLeft}%` } as React.CSSProperties}
            >
              <span className="fs-tab-en">{meta.en}</span>
              <span className="fs-tab-kr">{meta.name}</span>
            </div>

            <button className="fp-close" onClick={() => router.push("/")}>
              CLOSE — ESC
            </button>

            <h2 className="fp-title">{meta.en}</h2>
            <p className="fp-title-kr">{meta.name} · 지난 것</p>
            <div className="fp-meta">
              <span>{briefings.length}장</span>
              <span>안 읽음 {unreadByModule[meta.key] ?? 0}</span>
            </div>

            {briefings.length === 0 ? (
              <p className="fp-empty">아직 이 모듈로 쌓인 게 없습니다.</p>
            ) : (
              <ol className="ar-list">
                {briefings.map((b) => {
                  const open = b.id === openId;
                  return (
                    <li key={b.id} className="ar-row" data-open={open ? "" : undefined}>
                      <button
                        type="button"
                        className="ar-head"
                        onClick={() => setOpenId(open ? null : b.id)}
                        aria-expanded={open}
                      >
                        <span className="ar-when">
                          {dateOf(b)} {timeOf(b)}
                        </span>
                        <span className="ar-cost">{formatReadTime(b.est_read_seconds)}</span>
                        {!b.read_at && <span className="ar-badge">안 읽음</span>}
                      </button>
                      {open && (
                        <div className="ar-body">
                          {b.thread_note && <p className="fs-thread lead">↩ {b.thread_note}</p>}
                          <FileBody briefing={b} meta={meta} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </motion.article>
        </div>
      )}
    </Shell>
  );
}
