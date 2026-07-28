// M4. community — 커뮤니티 인기글 (03 문서), 여러 소스 통합
// render=llm. "다 받기" — 난이도 낮은 순: 클리앙 → 루리웹 → 보배 → (방어강함) 에펨·더쿠.
// ※ 틀만: 소스 fetch는 Phase 3. 클리앙부터 붙이고 실측, 막히면 enabled=false 유지.
import type { RawItem, Source, SourceModule } from "../types.ts";

const clien: Source = {
  key: "clien",
  label: "클리앙 모공",
  enabled: false, // TODO(Phase3): 클리앙 인기글 수집 (RSS 없으면 HTML 파싱)
  async fetch(): Promise<RawItem[]> {
    // external_id = 'clien:<게시글ID>'
    throw new Error("community/clien 미구현");
  },
};

// TODO(Phase3): ruliweb, bobae 추가 → (후순위) fmkorea, theqoo

export const community: SourceModule = {
  key: "community",
  label: "💬 커뮤니티",
  sources: [clien],
  render: {
    mode: "llm",
    maxItems: 30,
    systemPrompt:
      "너는 커뮤니티 인기글 큐레이터다.\n\n" +
      "출력은 두 부분이다.\n" +
      "1) 먼저 **리드 문단** 2~4문장. 오늘 커뮤니티가 무엇으로 시끄러운지, 그 글이 " +
      "왜 떴는지, 실제로 읽을 값어치가 있는지를 쓴다. 제목을 다시 나열하지 마라. " +
      "불릿 없이 평문 한 문단. 이 문단이 없으면 이 브리핑은 링크 목록일 뿐이다.\n" +
      "2) 빈 줄 뒤에 origin(사이트)별로 묶어 '### 사이트명' 소제목 + " +
      "'- [제목](링크)' 마크다운. 제목만으로 모호한 것만 한 줄 부연한다.\n\n" +
      "인사말·맺음말은 쓰지 마라.",
  },
};
