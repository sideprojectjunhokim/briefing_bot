/**
 * 모델 티어. 두 가지 일은 성격이 다르다.
 *
 *   fast — 매시 도는 선별·리드 작성. 호출이 잦으니 싼 게 중요하다.
 *          Haiku 4.5가 Claude 계열에서 가장 싸다($1/$5 per MTok).
 *   deep — 한 건을 파고들 때(사실 확인, 배경 조사). 사람이 명시적으로 부를 때만
 *          돌아서 호출이 드물고, 대신 틀리면 안 되는 쪽이다.
 *
 * env로 뺀 이유는 모델을 바꿀 때 재배포를 안 하려는 것뿐이다. 안 건드리면
 * 기본값으로 돈다.
 */
export const MODELS = {
  fast: process.env.BRIEFING_MODEL_FAST ?? "claude-haiku-4-5",
  deep: process.env.BRIEFING_MODEL_DEEP ?? "claude-sonnet-5",
} as const;

export type ModelTier = keyof typeof MODELS;
