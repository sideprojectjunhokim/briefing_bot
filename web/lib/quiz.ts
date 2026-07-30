// 넌센스 퀴즈 — 문제은행은 전역, 기록은 사람별.
//
// 브리핑 읽다 지겨울 때 하나씩. 맞히면 카운트가 오르고, 카운트가 티어가 된다.
// 진지해지는 순간 죽는 기능이라 문구 전체에 장난기를 깔았다.
import { requireSql } from "./db";

export interface QuizQuestion {
  id: number;
  question: string;
}

export interface QuizStats {
  /** 지금까지 맞힌 수 — 티어의 기준 */
  correct: number;
  /** 포기한 수 */
  gaveup: number;
  /** 문제은행 전체 크기 */
  total: number;
  tier: string;
  /** 다음 티어까지 몇 개 — 마지막 티어면 null */
  toNext: number | null;
}

/**
 * 티어 사다리. 하한이 곧 이름이다.
 * 첫 칸 이름이 이 기능의 톤을 정한다 — "넌 센스가 없네"에서 시작해야
 * 브론즈가 칭찬이 된다.
 */
const TIERS: [number, string][] = [
  [0, "무센스"],
  [5, "브론즈 센스"],
  [15, "실버 센스"],
  [30, "골드 센스"],
  [60, "플래티넘 센스"],
  [100, "다이아 센스"],
  [200, "넌센스 그 자체"],
];

export function tierOf(correct: number): { tier: string; toNext: number | null } {
  let tier = TIERS[0][1];
  let toNext: number | null = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (correct >= TIERS[i][0]) {
      tier = TIERS[i][1];
      toNext = i + 1 < TIERS.length ? TIERS[i + 1][0] - correct : null;
    }
  }
  return { tier, toNext };
}

/** 정답 비교 전 정규화 — 공백·문장부호·대소문자 차이로 틀렸다고 하면 정 떨어진다 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s.,!?'"‘’“”~\-–—()[\]]/g, "")
    .trim();
}

export async function getQuizStats(userId: number): Promise<QuizStats> {
  const sql = requireSql();
  const [row] = (await sql`
    select
      (select count(*)::int from quiz_attempts where user_id = ${userId} and result = 'correct') as correct,
      (select count(*)::int from quiz_attempts where user_id = ${userId} and result = 'gaveup') as gaveup,
      (select count(*)::int from quiz_questions) as total`) as {
    correct: number;
    gaveup: number;
    total: number;
  }[];
  return { ...row, ...tierOf(row.correct) };
}

/** 아직 안 푼 문제 중 하나를 무작위로. 다 풀었으면 null */
export async function nextQuestion(userId: number): Promise<QuizQuestion | null> {
  const sql = requireSql();
  const rows = (await sql`
    select q.id, q.question
    from quiz_questions q
    where not exists (
      select 1 from quiz_attempts a
      where a.user_id = ${userId} and a.question_id = q.id
    )
    order by random()
    limit 1`) as QuizQuestion[];
  return rows[0] ?? null;
}

/**
 * 답 제출. 오답은 기록하지 않는다 — 재도전은 자유고, 맞히는 게 목적이다.
 * (브루트포스? 넌센스 퀴즈를 브루트포스로 푸는 것도 그 나름의 센스다.)
 */
export async function submitAnswer(
  userId: number,
  questionId: number,
  given: string,
): Promise<{ correct: boolean; answer?: string } | null> {
  const sql = requireSql();
  const rows = (await sql`
    select answer, alts from quiz_questions where id = ${questionId}`) as {
    answer: string;
    alts: string[];
  }[];
  if (!rows[0]) return null;

  const ok = [rows[0].answer, ...rows[0].alts].some((a) => normalize(a) === normalize(given));
  if (!ok) return { correct: false };

  await sql`
    insert into quiz_attempts (user_id, question_id, result)
    values (${userId}, ${questionId}, 'correct')
    on conflict (user_id, question_id) do nothing`;
  return { correct: true, answer: rows[0].answer };
}

/** 포기 — 답을 보여주고 그 문제는 은퇴시킨다. 카운트는 안 오른다. */
export async function giveUp(userId: number, questionId: number): Promise<string | null> {
  const sql = requireSql();
  const rows = (await sql`
    select answer from quiz_questions where id = ${questionId}`) as { answer: string }[];
  if (!rows[0]) return null;
  await sql`
    insert into quiz_attempts (user_id, question_id, result)
    values (${userId}, ${questionId}, 'gaveup')
    on conflict (user_id, question_id) do nothing`;
  return rows[0].answer;
}

// ── 장난기 — 서버가 골라 내려보낸다(화면마다 다르게 만들지 않으려고) ──

const RIGHT = [
  "오… 센스 있는데?",
  "정답. 오늘 컨디션 좋네.",
  "맞았어. 이 맛에 넌센스 하지.",
  "정답! 방금 그건 좀 멋있었다.",
  "그걸 맞히네. 인정.",
  "정답. 뇌가 말랑말랑하군.",
];

const WRONG = [
  "땡. 넌… 센스가 없네.",
  "아쉽다. 그 답은 좀 진지했어.",
  "땡. 더 이상하게 생각해봐.",
  "틀렸어. 정답은 더 한심한 쪽이야.",
  "그럴듯한데 아니야. 한 번 더.",
  "땡. 논리를 버려. 여긴 넌센스야.",
];

const GAVEUP = [
  "포기도 전략이지. 답은 이거였어 —",
  "흠, 이건 좀 아까운데. 정답은 —",
  "괜찮아, 이 문제 만든 사람이 이상한 거야. 정답은 —",
  "다음 건 맞히자. 정답은 —",
];

export function quip(kind: "right" | "wrong" | "gaveup"): string {
  const pool = kind === "right" ? RIGHT : kind === "wrong" ? WRONG : GAVEUP;
  return pool[Math.floor(Math.random() * pool.length)];
}
