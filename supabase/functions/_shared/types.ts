// 모듈/소스 2계층 타입 (03 문서)
// Source = 피드 1개 어댑터, Module = 브리핑 섹션(=카드) 1개. 모듈은 소스 여러 개를 통합.

export interface RawItem {
  externalId: string; // source_items.external_id 로 들어감. '<origin>:<id>' 권장
  url?: string;
  title: string;
  origin: string; // 어느 Source에서 왔나 (렌더 그룹핑·디버깅)
  payload?: Record<string, unknown>;
}

export interface Source {
  key: string; // 'geeknews' 등. RawItem.origin 값
  label: string; // "GeekNews"
  enabled: boolean; // false면 스킵 (사이트 죽었을 때 코드 한 줄로 차단)
  fetch(): Promise<RawItem[]>;
}

export type RenderSpec =
  | { mode: "llm"; systemPrompt: string; maxItems: number }
  | { mode: "template"; format: (items: RawItem[]) => string };

export interface SourceModule {
  key: string; // DB의 module_key와 일치
  label: string; // 카드 헤더용 ("👨‍💻 테크 뉴스")
  sources: Source[]; // 1개 이상
  render: RenderSpec;
}
