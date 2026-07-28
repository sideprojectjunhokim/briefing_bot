/**
 * 관심사 목록. 온보딩과 수집기가 같이 본다.
 *
 * 두 종류가 섞여 있다.
 *   curated — 손으로 붙인 소스가 있다(핫딜·시세·테크뉴스·커뮤니티).
 *             query가 없고, 설정은 module_prefs가 관리한다.
 *   search  — 검색으로 채운다. query가 곧 검색어이고 topics 테이블에 들어간다.
 *
 * 직접 입력한 관심사도 search와 **완전히 같은 경로**로 돈다. 그래야 "직접 추가"가
 * 특별 케이스가 되지 않는다 — 특별 케이스는 그것만 계속 깨진다.
 */
export interface TopicPreset {
  key: string;
  label: string;
  /** 이 관심사로 뭘 받게 되는지 한 줄 */
  hint: string;
  group: string;
  /** 없으면 curated — 코드에 소스가 있다 */
  query?: string;
}

export const TOPIC_GROUPS = ["개발·기술", "돈·시장", "취미", "생활"] as const;

export const TOPICS: TopicPreset[] = [
  // ── 개발·기술 ──
  { key: "technews", label: "테크 뉴스", hint: "GeekNews에서 개발자 관심사만", group: "개발·기술" },
  { key: "ai", label: "AI · LLM", hint: "모델·도구·업계 동향", group: "개발·기술", query: "AI 인공지능 LLM 모델" },
  { key: "frontend", label: "웹 프론트엔드", hint: "React·프레임워크·브라우저", group: "개발·기술", query: "프론트엔드 React 웹개발" },
  { key: "backend", label: "백엔드 · 인프라", hint: "서버·클라우드·배포", group: "개발·기술", query: "백엔드 서버 클라우드 인프라" },
  { key: "data", label: "데이터 · DB", hint: "데이터베이스·파이프라인", group: "개발·기술", query: "데이터베이스 데이터 엔지니어링" },
  { key: "security", label: "보안", hint: "취약점·유출·대응", group: "개발·기술", query: "보안 취약점 해킹 유출" },
  { key: "mobile", label: "모바일 앱", hint: "iOS·안드로이드·스토어", group: "개발·기술", query: "iOS 안드로이드 앱 개발" },

  // ── 돈·시장 ──
  { key: "hotdeal", label: "핫딜 · 특가", hint: "지금 사도 되는 것만", group: "돈·시장" },
  { key: "market", label: "시세", hint: "지수·환율·코인 숫자", group: "돈·시장" },
  { key: "stock", label: "주식 · 증시", hint: "코스피·해외증시 흐름", group: "돈·시장", query: "코스피 증시 주식시장" },
  { key: "crypto", label: "코인", hint: "비트코인·가상자산", group: "돈·시장", query: "비트코인 가상자산 코인" },
  { key: "realestate", label: "부동산", hint: "아파트·전세·정책", group: "돈·시장", query: "부동산 아파트 전세 분양" },

  // ── 취미 ──
  { key: "game", label: "게임", hint: "신작·업데이트·콘솔", group: "취미", query: "게임 신작 콘솔 스팀" },
  { key: "car", label: "자동차", hint: "신차·전기차·시승", group: "취미", query: "자동차 신차 전기차" },
  { key: "camera", label: "카메라 · 사진", hint: "바디·렌즈·촬영", group: "취미", query: "카메라 렌즈 미러리스" },
  { key: "audio", label: "오디오", hint: "헤드폰·이어폰·스피커", group: "취미", query: "오디오 헤드폰 이어폰 스피커" },
  { key: "whisky", label: "위스키 · 와인", hint: "출시·가격·시음", group: "취미", query: "위스키 와인 주류" },
  { key: "camping", label: "캠핑", hint: "장비·차박·캠핑장", group: "취미", query: "캠핑 아웃도어 차박" },
  { key: "watch", label: "시계", hint: "신제품·브랜드", group: "취미", query: "손목시계 워치 브랜드" },

  // ── 생활 ──
  { key: "community", label: "커뮤니티 인기글", hint: "오늘 시끄러운 것만", group: "생활" },
  { key: "health", label: "건강 · 운동", hint: "운동법·영양·연구", group: "생활", query: "건강 운동 헬스 영양" },
  { key: "travel", label: "여행", hint: "항공권·숙소·목적지", group: "생활", query: "여행 항공권 해외여행" },
  { key: "food", label: "맛집 · 요리", hint: "새로 여는 곳·레시피", group: "생활", query: "맛집 요리 레시피" },
];

export function presetOf(key: string): TopicPreset | undefined {
  return TOPICS.find((t) => t.key === key);
}

/** curated = 코드에 소스가 있는 것. 나머지는 검색으로 채운다 */
export function isCurated(t: TopicPreset): boolean {
  return !t.query;
}

/** 직접 입력한 관심사의 키. 프리셋과 안 부딪히게 접두사를 붙인다 */
export function customKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .slice(0, 40);
  return `my-${slug || Math.random().toString(36).slice(2, 8)}`;
}
