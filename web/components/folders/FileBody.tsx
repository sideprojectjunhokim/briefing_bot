"use client";

import type { Briefing } from "@/lib/db";
import type { ModuleMeta } from "@/lib/modules";
import { parseItems, parseLead, toMarketRows } from "@/lib/briefing";

/**
 * 브리핑 본문 — 항목 리스트(또는 시세 그리드).
 *
 * 큐에서 펼쳤을 때와 /c/[key] 아카이브가 **같은 것을 보여줘야** 한다.
 * 두 곳에 복사해 두면 한쪽만 고쳐지고, 그때부터 "펼친 것"과 "연 것"이 서로
 * 다른 화면이 된다.
 */
export function FileBody({ briefing, meta }: { briefing: Briefing | null; meta: ModuleMeta }) {
  const items = briefing?.status === "ok" ? parseItems(briefing.content) : [];
  const lead = briefing?.status === "ok" ? parseLead(briefing.content) : null;

  if (briefing?.status === "failed") {
    return <p className="fp-empty">수집에 실패했어요 — {briefing.error ?? "원인 미상"}</p>;
  }
  // 하루 끝 한 장은 불릿이 없다 — 문단이 전부다
  if (items.length === 0 && lead) {
    return <p className="fp-lead">{lead}</p>;
  }
  if (items.length === 0) {
    return <p className="fp-empty">본문이 비어 있어요.</p>;
  }

  if (meta.key === "market") {
    return (
      <>
        {lead && <p className="fp-lead">{lead}</p>}
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
      </>
    );
  }

  return (
    <>
      {lead && <p className="fp-lead">{lead}</p>}
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
    </>
  );
}
