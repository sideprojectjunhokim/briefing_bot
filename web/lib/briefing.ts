// briefings.content(LLM 마크다운 리스트)를 화면용 구조로 파싱.
// 실데이터 형식: "- [제목](링크) — 요약" / 데모·템플릿 형식: "- **[출처] 제목** — 부가설명"
import type { Briefing } from "./supabase";

export interface BriefingItem {
  title: string;
  url?: string;
  /** 제목 앞 [출처] 태그 */
  source?: string;
  /** — 뒤의 부가 설명 */
  note?: string;
}

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/;
const BOLD_RE = /\*\*(.+?)\*\*/;
const SOURCE_RE = /^\[([^\]]+)\]\s*/;

/** 마크다운 불릿 한 줄 → 아이템. 링크/볼드 어느 형식이든 수용, 못 읽으면 통짜 제목. */
function parseLine(line: string): BriefingItem | null {
  const body = line.replace(/^[-*]\s+/, "").trim();
  if (!body) return null;

  let title = body;
  let url: string | undefined;
  let rest = "";

  const link = body.match(LINK_RE);
  const bold = body.match(BOLD_RE);
  if (link) {
    title = link[1];
    url = link[2];
    rest = body.slice((link.index ?? 0) + link[0].length);
  } else if (bold) {
    title = bold[1];
    rest = body.slice((bold.index ?? 0) + bold[0].length);
  }

  let source: string | undefined;
  const src = title.match(SOURCE_RE);
  if (src) {
    source = src[1];
    title = title.slice(src[0].length).trim();
  }

  const note = rest.replace(/^[\s—–:-]+/, "").replace(/\*\*/g, "").trim() || undefined;
  return { title: title.replace(/\*\*/g, "").trim(), url, source, note };
}

/**
 * 불릿 앞에 오는 산문 — 오늘 이 모듈이 무슨 이야기인지 요약한 리드 문단.
 *
 * 목록만 있으면 읽을거리가 아니라 링크 모음이다. 항목은 데이터고, 이 문단이 글이다.
 * parseItems가 불릿 줄만 걸러 읽으므로 이 문단을 넣어도 기존 파싱은 그대로 돈다.
 */
export function parseLead(content: string | null): string | null {
  if (!content) return null;
  const lead: string[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (/^[-*]\s/.test(line)) break; // 첫 불릿에서 멈춘다
    if (line) lead.push(line.replace(/^#+\s*/, "").replace(/\*\*/g, ""));
  }
  const text = lead.join(" ").trim();
  return text.length > 20 ? text : null;
}

export function parseItems(content: string | null): BriefingItem[] {
  if (!content) return [];
  return content
    .split("\n")
    .filter((l) => /^[-*]\s/.test(l.trim()))
    .map((l) => parseLine(l.trim()))
    .filter((it): it is BriefingItem => !!it && it.title.length > 0);
}

export interface MarketRow {
  label: string;
  value: string;
  /** 괄호 속 등락 표기 — "+0.4%" "-3원" */
  delta?: string;
  /** true=상승(적), false=하락(청), null=판별 불가 */
  up: boolean | null;
}

/** 시세 아이템 → 숫자 블록. note가 "2,812 (+0.4%)" 꼴일 때 값/등락 분리. */
export function toMarketRows(items: BriefingItem[]): MarketRow[] {
  return items.map((it) => {
    const raw = it.note ?? "";
    const m = raw.match(/\(([+\-−][^)]*)\)\s*$/);
    const value = (m ? raw.slice(0, m.index) : raw).trim() || "—";
    const delta = m?.[1];
    const up = delta ? delta.startsWith("+") : null;
    return { label: it.title, value, delta, up };
  });
}

/** KST HH:MM (24h — 모노 라벨용) */
export function timeOf(b: Briefing): string {
  return new Date(b.created_at).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}
