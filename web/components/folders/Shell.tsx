"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Briefing } from "@/lib/supabase";
import { MODULE_ORDER } from "@/lib/modules";
import { timeOf } from "@/lib/briefing";
import { clearUser, getUser } from "@/lib/session";

interface ShellProps {
  briefings: Briefing[];
  demo: boolean;
  /** 현재 열려 있는 카테고리 key (메인 스택이면 null) */
  active: string | null;
  children: (user: string) => ReactNode;
}

/**
 * 서류 캐비닛 공통 셸 — 좌측 색인 사이드바(날짜·카테고리·생성시각·세션).
 * 이름이 없으면 온보딩으로 보낸다. children은 user 확정 후에만 렌더.
 */
export function Shell({ briefings, demo, active, children }: ShellProps) {
  const router = useRouter();
  const [user, setUserName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/onboarding");
      return;
    }
    setUserName(u);
  }, [router]);

  if (!user) return null;

  const byModule = new Map(briefings.map((b) => [b.module_key, b]));
  const failed = briefings.filter((b) => b.status === "failed");
  const latest = briefings
    .filter((b) => b.status === "ok")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const logout = () => {
    clearUser();
    router.replace("/onboarding");
  };

  return (
    <div className="ds">
      <aside className="ds-side">
        <h1 className="ds-wordmark">
          <Link href="/">
            Today&rsquo;s
            <br />
            Briefing
          </Link>
        </h1>
        <p className="ds-date">{today}</p>

        <nav className="ds-index" aria-label="카테고리 색인">
          <span className="ds-index-head">INDEX</span>
          {MODULE_ORDER.map((m, i) => {
            const b = byModule.get(m.key);
            return (
              <Link key={m.key} href={`/c/${m.key}`} className={active === m.key ? "on" : ""}>
                <span className="no">{String(i + 1).padStart(2, "0")}</span>
                <span className="nm">{m.name}</span>
                <span className="cnt">{b && b.status === "ok" ? `${b.item_count}` : "—"}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ds-side-foot">
          {latest && <span>GENERATED {timeOf(latest)} KST</span>}
          {demo && <span className="ds-flag-demo">PREVIEW DATA</span>}
          {failed.length > 0 && (
            <span className="ds-flag-fail">FAIL: {failed.map((f) => f.module_key).join(", ")}</span>
          )}
          <span className="ds-user">
            {user}
            <button className="ds-logout" onClick={logout} aria-label="나가기">
              OUT
            </button>
          </span>
        </div>
      </aside>

      <main className="ds-main">{children(user)}</main>
    </div>
  );
}
