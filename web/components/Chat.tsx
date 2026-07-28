"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatTurn } from "@/lib/chat/agent";

/**
 * 카드 안과 홈에서 같이 쓰는 대화창.
 *
 * 카드 안에서 열면 그 카드가 컨텍스트로 들어간다 — 복붙 없이 "이거 진짜야?"가
 * 된다. 홈에서는 카드 없이 관심사 관리나 일반 질문용이다.
 *
 * 이 엔드포인트는 첫 글자까지 최대 10초가 걸린다(실측). 스트리밍을 붙여도
 * 프록시가 다 모아 뒀다 뱉어서 체감이 안 좋아진다. 그래서 스트리밍 대신
 * **기다리는 중이라는 걸 분명히 보여 주는** 쪽으로 갔다.
 */
/**
 * 굵게와 목록만 그리는 최소 렌더러.
 *
 * 그대로 두면 `**굵게**`가 별표째 보인다. 그렇다고 마크다운 라이브러리를
 * 들이자니, 이 저장소는 07-24에 react-markdown을 걷어낸 적이 있다 —
 * 모델에게 서식을 둘로 제한해 뒀으니 여기도 둘만 그린다.
 */
function Rendered({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const item = /^\s*[-*]\s+(.*)$/.exec(line);
        const body = item ? item[1] : line;
        const parts = body.split(/\*\*(.+?)\*\*/g);
        const nodes = parts.map((p, j) => (j % 2 ? <strong key={j}>{p}</strong> : p));
        if (item) return <p key={i} className="chat-li">{nodes}</p>;
        if (!line.trim()) return <p key={i} className="chat-gap" />;
        return <p key={i}>{nodes}</p>;
      })}
    </>
  );
}

export function Chat({
  cardId,
  placeholder,
  compact = false,
}: {
  cardId?: number;
  placeholder: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<(ChatTurn & { actions?: string[] })[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns, busy]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    const next = [...turns, { role: "user" as const, content: text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(null);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), cardId }),
    }).catch(() => null);

    setBusy(false);
    if (!res?.ok) {
      setError("답을 받지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    const data = (await res.json()) as { reply: string; actions: string[] };
    setTurns((t) => [...t, { role: "assistant", content: data.reply, actions: data.actions }]);
    // 관심사를 바꿨을 수 있다 — 사이드바 숫자와 색인을 다시 읽는다
    if (data.actions?.length) router.refresh();
  };

  return (
    <section className={`chat${compact ? " chat-compact" : ""}`} aria-label="대화">
      {turns.length > 0 && (
        <div className="chat-log">
          {turns.map((t, i) => (
            <div key={i} className="chat-msg" data-role={t.role}>
              <Rendered text={t.content} />
              {t.actions && t.actions.length > 0 && (
                <ul className="chat-actions">
                  {t.actions.map((a, j) => (
                    <li key={j}>✓ {a}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {busy && (
            <div className="chat-msg" data-role="assistant">
              <p className="chat-waiting">생각 중… 원문을 찾아보는 중이면 10초쯤 걸립니다.</p>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <form className="chat-form" onSubmit={send}>
        <input
          className="input"
          placeholder={placeholder}
          value={draft}
          maxLength={500}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="chat-send" disabled={busy || !draft.trim()}>
          {busy ? "…" : "묻기"}
        </button>
      </form>
      {error && <p className="chat-error">{error}</p>}
    </section>
  );
}
