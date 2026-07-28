"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SkipNudge } from "@/lib/db";
import { MODULE_ORDER, metaOf } from "@/lib/modules";
import { clearUser, getUser } from "@/lib/session";

interface ShellProps {
  /** 모듈별 안 읽은 장 수 */
  unreadByModule: Record<string, number>;
  failures: { module_key: string; error: string | null }[];
  demo: boolean;
  /** 지금 열려 있는 모듈 아카이브 (홈이면 null) */
  active: string | null;
  nudge?: SkipNudge | null;
  children: (user: string) => ReactNode;
}

/**
 * 서류 캐비닛 공통 셸 — 좌측 색인 사이드바.
 *
 * 색인의 숫자는 "그 모듈이 오늘 몇 건이었나"가 아니라 **안 읽은 장 수**다.
 * 이 화면에서 숫자는 언제나 "아직 남은 것"을 뜻해야 한다.
 */
export function Shell({ unreadByModule, failures, demo, active, nudge, children }: ShellProps) {
  const router = useRouter();
  const [user, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/onboarding");
      return;
    }
    setUserName(u);
  }, [router]);

  if (!user) return null;

  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const logout = async () => {
    await fetch("/api/login", { method: "DELETE" }).catch(() => {});
    clearUser();
    router.replace("/onboarding");
  };

  return (
    <div className="ds">
      <aside className="ds-side">
        <h1 className="ds-wordmark">
          <Link href="/">
            Unread
            <br />
            Files
          </Link>
        </h1>
        <p className="ds-date">{today}</p>

        <nav className="ds-index" aria-label="모듈 색인">
          <span className="ds-index-head">INDEX</span>
          {MODULE_ORDER.map((m, i) => {
            const n = unreadByModule[m.key] ?? 0;
            return (
              <Link key={m.key} href={`/c/${m.key}`} className={active === m.key ? "on" : ""}>
                <span className="no">{String(i + 1).padStart(2, "0")}</span>
                <span className="nm">{m.name}</span>
                <span className="cnt">{n > 0 ? n : "—"}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ds-side-foot">
          {demo && <span className="ds-flag-demo">PREVIEW DATA</span>}
          {failures.length > 0 && (
            <span className="ds-flag-fail">
              FAIL: {failures.map((f) => metaOf(f.module_key).name).join(", ")}
            </span>
          )}
          <span className="ds-user">
            {user}
            <button className="ds-logout" onClick={logout} aria-label="나가기">
              OUT
            </button>
          </span>
        </div>
      </aside>

      <main className="ds-main">
        {nudge && <SkipNudgeBanner nudge={nudge} />}
        {children(user)}
      </main>
    </div>
  );
}

/**
 * 건너뛰기 알림 — 설정 화면이 아니라 실제 행동에서 배운다.
 * 조용히 줄이지 않고 한 번 물어본다. 답하면(그대로 두기 포함) 2주 동안 안 묻는다.
 */
function SkipNudgeBanner({ nudge }: { nudge: SkipNudge }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  if (gone) return null;

  const answer = async (a: "reduce" | "mute" | "keep") => {
    if (busy) return;
    setBusy(true);
    await fetch("/api/prefs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ module: nudge.module_key, answer: a }),
    }).catch(() => {});
    setGone(true);
    router.refresh();
  };

  const name = metaOf(nudge.module_key).name;
  return (
    <div className="ds-nudge" role="status">
      <p>
        최근 {name} {nudge.total}장 중 {nudge.skipped}장을 안 읽고 넘겼어요. 줄일까요?
      </p>
      <div className="ds-nudge-acts">
        <button onClick={() => answer("reduce")} disabled={busy}>
          줄이기
        </button>
        <button onClick={() => answer("mute")} disabled={busy}>
          그만 받기
        </button>
        <button onClick={() => answer("keep")} disabled={busy}>
          그대로
        </button>
      </div>
    </div>
  );
}
