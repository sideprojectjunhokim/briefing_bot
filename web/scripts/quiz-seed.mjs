// 넌센스 문제은행 시드 — db/quiz-questions.json → quiz_questions.
// 여러 번 돌려도 안전하다: question이 unique라 있는 건 건너뛴다.
// 문제를 더 채우려면 JSON에 추가하고 다시 돌리면 된다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const questions = JSON.parse(readFileSync(join(root, "db", "quiz-questions.json"), "utf-8"));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 필요 (web/.env.local 참고)");
  process.exit(1);
}
const sql = neon(url);

// alts가 배열이라 unnest 다중 배열로는 못 넘긴다(2차원 배열이 됨) — JSON으로 한 방에
const inserted = await sql`
  insert into quiz_questions (question, answer, alts)
  select x.q, x.a,
         coalesce(array(select jsonb_array_elements_text(x.alts)), '{}')
  from jsonb_to_recordset(${JSON.stringify(questions)}::jsonb) as x(q text, a text, alts jsonb)
  on conflict (question) do nothing
  returning id`;

const [{ n }] = await sql`select count(*)::int as n from quiz_questions`;
console.log(`시드 완료: 신규 ${inserted.length}건, 전체 ${n}건`);
