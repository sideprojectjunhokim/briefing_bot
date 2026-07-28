"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { Briefing } from "@/lib/supabase";
import type { ModuleMeta } from "@/lib/modules";
import { parseItems, timeOf, toMarketRows } from "@/lib/briefing";
import { Shell } from "./Shell";

/**
 * 펼쳐진 파일 — 한 카테고리의 오늘 브리핑 전체.
 * 시세는 숫자 블록 그리드, 나머지는 세리프 헤드라인 리스트. ESC/CLOSE로 스택 복귀.
 */
export function FilePage({
  briefings,
  meta,
  demo,
}: {
  briefings: Briefing[];
  meta: ModuleMeta;
  demo: boolean;
}) {
  const router = useRouter();
  const reduced = Boolean(useReducedMotion());
  const briefing = briefings.find((b) => b.module_key === meta.key) ?? null;
  const items = briefing?.status === "ok" ? parseItems(briefing.content) : [];
  const isMarket = meta.key === "market";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const dateLine = new Date(briefing?.created_at ?? Date.now()).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Shell briefings={briefings} demo={demo} active={meta.key}>
      {() => (
        <div className="fp-wrap">
          <motion.article
            className="fp-sheet"
            initial={reduced ? false : { y: "9vh", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="fs-tab fp-tab" style={{ "--tl": `${meta.tabLeft}%` } as React.CSSProperties}>
              <span className="fs-tab-en">{meta.en}</span>
              <span className="fs-tab-kr">{meta.name}</span>
            </div>

            <button className="fp-close" onClick={() => router.push("/")}>
              CLOSE — ESC
            </button>

            <h2 className="fp-title">{meta.en}</h2>
            <p className="fp-title-kr">{meta.name}</p>
            <div className="fp-meta">
              <span>{dateLine}</span>
              {briefing?.status === "ok" && <span>{briefing.item_count} ITEMS</span>}
              {briefing && <span>GENERATED {timeOf(briefing)} KST</span>}
              {briefing?.status === "failed" && <span className="fail">수집 실패 — {briefing.error ?? "원인 미상"}</span>}
            </div>

            {items.length === 0 ? (
              <p className="fp-empty">오늘은 새 소식이 없어요. 내일 아침 다시 채워둘게요.</p>
            ) : isMarket ? (
              <div className="fp-market">
                {toMarketRows(items).map((r) => (
                  <div key={r.label} className="fp-market-cell">
                    <div className="lb">{r.label}</div>
                    <div className={r.value.length > 8 ? "val sm" : "val"}>{r.value}</div>
                    {r.delta && (
                      <div className={`dt ${r.up === null ? "flat" : r.up ? "up" : "down"}`}>
                        {r.delta}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <ol className="fp-items">
                {items.map((it, i) => (
                  <li key={i} className="fp-item">
                    <span className="no">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="fp-item-title">
                        {it.url ? (
                          <a href={it.url} target="_blank" rel="noreferrer">
                            {it.title}
                          </a>
                        ) : (
                          it.title
                        )}
                      </h3>
                      {it.note && <p className="fp-item-note">{it.note}</p>}
                      <div className="fp-item-meta">
                        {it.source && <span className="fp-src">{it.source}</span>}
                        {it.url && (
                          <a className="fp-link" href={it.url} target="_blank" rel="noreferrer">
                            원문 보기 ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </motion.article>
        </div>
      )}
    </Shell>
  );
}
