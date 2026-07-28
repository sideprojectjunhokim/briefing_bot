// M4. community — 커뮤니티 인기글. 여러 소스를 한 장으로 합친다.
// 난이도 낮은 순: 클리앙 → 루리웹 → 보배 → (방어 강함) 에펨·더쿠.
// ※ 아직 틀만: 소스 fetch 미구현이라 enabled:false로 자동 스킵된다.
import type { RawItem, Source, SourceModule } from "../types";
import { buildPrompt, LEAD_ASK } from "../prompt";

const clien: Source = {
  key: "clien",
  label: "클리앙 모공",
  enabled: false, // TODO: 인기글 수집 (RSS 없으면 HTML 파싱)
  async fetch(): Promise<RawItem[]> {
    throw new Error("community/clien 미구현");
  },
};

export const community: SourceModule = {
  key: "community",
  label: "커뮤니티",
  sources: [clien],
  render: {
    mode: "llm",
    maxInput: 30,
    prompt: (ctx) =>
      buildPrompt(
        {
          role: "너는 커뮤니티 인기글 큐레이터다. 읽는 사람은 시간을 쓸 값어치가 있는지만 알고 싶다.",
          leadAsk: LEAD_ASK.community,
          itemFormat: "- [제목](링크) — 제목만으로 모호할 때만 한 줄 부연",
          exclude: "정치 싸움, 어그로, 맥락 없이는 이해 안 되는 내부 농담",
        },
        ctx,
      ),
  },
};
