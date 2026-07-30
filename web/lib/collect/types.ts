// 모듈/소스 2계층 (03 문서). Source = 피드 1개 어댑터, Module = 종이 한 장.

export interface RawItem {
  externalId: string; // '<origin>:<id>' — 사이트 간 게시글 번호 겹침 방지
  url?: string;
  title: string;
  origin: string;
  payload?: Record<string, unknown>;
}

export interface Source {
  key: string;
  label: string;
  enabled: boolean; // false면 스킵 (사이트가 죽었을 때 코드 한 줄로 차단)
  fetch(): Promise<RawItem[]>;
}

/** 이어 붙이기 재료 — 사용자가 최근에 **읽은** 장과 그 안에 있던 제목들 */
export interface ReadRef {
  briefingId: number;
  daysAgo: number;
  titles: string[];
}

export interface PromptContext {
  /** 이 장에 담을 항목 상한. module_prefs.pick_max에서 온다 */
  pickMax: number;
  recentlyRead: ReadRef[];
}

export type RenderSpec =
  | {
      mode: "llm";
      /** LLM에 넘길 입력 상한. 소스가 늘어도 토큰이 안 늘게 잡는 뚜껑 */
      maxInput: number;
      prompt(ctx: PromptContext): string;
      /** 모델 출력 뒤에 코드가 덧붙이는 것(표지 이미지 등). 모델에게 URL을 쓰게 하지 않는다 */
      postProcess?(content: string, picked: RawItem[]): string;
    }
  | { mode: "template"; format(items: RawItem[]): string };

export interface SourceModule {
  key: string; // DB의 module_key
  label: string;
  sources: Source[];
  render: RenderSpec;
  /**
   * 안 읽은 장이 이만큼 쌓여 있으면 이번 회차는 쉰다.
   *
   * 뉴스형에는 없다 — 소식은 그 시간에 있었던 일이라 미루면 없어진다.
   * 탐험형(SCP·백룸)은 아카이브에서 꺼내 오는 것이라 서두를 이유가 없고,
   * 대신 **읽는 속도만큼 계속 나온다** — 읽으면 다음 회차에 새 걸 채운다.
   */
  queueCap?: number;
}
