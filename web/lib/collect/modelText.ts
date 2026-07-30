/**
 * 호환 프록시·thinking 모델이 응답에 섞어 넣는 잡음을 걷어낸다.
 *
 * 실측(07-28 23:05): Haiku라도 프록시가 사고 과정("Thinking Process: …")을
 * text 블록에 그대로 실어 보냈다. SKIP 검사는 맨 앞만 봤고, 사고 과정 안의
 * 예시 불릿이 parseItems에 걸려 **프롬프트 해설이 카드로 저장**됐다.
 */

const THINK_TAG =
  "think|thinking|redacted[_-]?reasoning|reasoning";

/** `<think>…</think>` 등과 태그 없는 Thinking Process 덤프를 제거 */
export function stripModelNoise(text: string): string {
  let t = text;

  // 닫힌 사고 블록. 태그명을 캡처해야 \1로 닫는 태그와 짝이 맞는다
  // (?:…) 비캡처로 쓰면 \1이 비어 닫힌 블록을 못 지우고, 아래 open-to-end가
  // 답(SKIP·요약)까지 삼켜 버린다.
  t = t.replace(
    new RegExp(`<\\s*(${THINK_TAG})\\b[^>]*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, "gi"),
    "",
  );
  // 열린 채로 끝까지(토큰 한도에 잘린 경우) — 이 안에 답이 있어도 믿을 수 없다
  t = t.replace(new RegExp(`<\\s*(?:${THINK_TAG})\\b[^>]*>[\\s\\S]*$`, "gi"), "");

  t = t.trim();

  // 태그 없이 사고 과정만 뱉은 경우 → 비운다(호출 쪽에서 SKIP)
  if (isThinkingLeak(t)) return "";

  return t;
}

/**
 * 걷어낸 뒤에도 사고 과정·프롬프트 해설처럼 보이면 true.
 * 이런 텍스트는 카드로 쌓지 않는다.
 */
export function isThinkingLeak(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (new RegExp(`<\\s*(?:${THINK_TAG})\\b`, "i").test(t)) return true;
  if (/^(?:Thinking|Thought)\s+Process\s*:/i.test(t)) return true;
  if (/\bAnalyze the Request\b/i.test(t) && /\bConstraint\s*\d/i.test(t)) return true;
  // 영문 메타가 길고 한글 본문이 거의 없으면 요약이 아니다
  const hangul = (t.match(/[가-힣]/g) ?? []).length;
  const latinWords = (t.match(/[A-Za-z]{4,}/g) ?? []).length;
  if (latinWords >= 40 && hangul < 40) return true;
  return false;
}

/** SKIP 판정 — 맨 앞뿐 아니라 사고 제거 후 남은 전체가 SKIP인 경우도 */
export function isSkipResponse(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^SKIP\b/i.test(t)) return true;
  const lines = t
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every((l) => /^SKIP\b/i.test(l));
}
