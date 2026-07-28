// Claude Haiku 요약 (모듈당 1회 호출, 03 문서)
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import type { RawItem } from "./types.ts";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

const MODEL = "claude-haiku-4-5";

/**
 * 신규 아이템 목록을 systemPrompt에 따라 1회 호출로 요약한다.
 * maxItems로 입력을 잘라 토큰 상한 고정 → 소스가 늘어도 비용 무관.
 * 출력은 웹 렌더용 마크다운(04 문서).
 */
export async function summarize(
  items: RawItem[],
  systemPrompt: string,
  maxItems: number,
): Promise<string> {
  const clipped = items.slice(0, maxItems).map((it) => ({
    title: it.title,
    url: it.url,
    origin: it.origin,
    ...it.payload,
  }));

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content:
          `아래 JSON은 오늘 새로 수집된 아이템이다. 지시대로 한국어 마크다운으로 요약하라.\n\n` +
          JSON.stringify(clipped, null, 2),
      },
    ],
  });

  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return text;
}
