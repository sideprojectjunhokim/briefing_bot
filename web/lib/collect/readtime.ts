/**
 * 이 장을 읽는 데 걸리는 시간. **코드가 센다 — LLM 안 쓴다.**
 *
 * 쉬는 시간에 집는 물건이라 비용을 먼저 알려야 한다. 세는 대상은 이 장의
 * 본문(리드 + 항목)이지 링크 걸린 원문이 아니다. 원문까지 세면 숫자가 커져서
 * 오히려 안 열게 된다 — "이 장을 처리하는 데 얼마"가 알고 싶은 값이다.
 */

// 한국어 묵독 속도. 400~600자/분 사이가 흔히 쓰이는 범위라 가운데를 잡았다.
const CHARS_PER_MINUTE = 500;

/** 마크다운 장식과 URL을 걷어낸 실제 읽히는 글자 수 */
function readableLength(content: string): number {
  return content
    .replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]*)\)/g, "$1") // 링크는 라벨만 읽힌다
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^[-*#>\s]+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** 30초 단위로 올림, 최소 1분. 화면에는 분으로만 보여 준다. */
export function estimateReadSeconds(content: string | null): number {
  if (!content) return 0;
  const seconds = (readableLength(content) / CHARS_PER_MINUTE) * 60;
  return Math.max(60, Math.ceil(seconds / 30) * 30);
}

/** "2분" — 30초는 올려서 1분으로. 초 단위를 보여 줄 만큼 정밀한 값이 아니다. */
export function formatReadTime(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))}분`;
}
