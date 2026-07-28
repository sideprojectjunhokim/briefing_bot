// db/schema.sql을 Neon에 적용한다. `npm run db:push`
//
// 스키마가 전부 idempotent라(create table if not exists / add column if not exists)
// 여러 번 돌려도 안전하다. 세미콜론으로 잘라 순서대로 보내므로 $$ 블록은 쓰지 마라.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const here = dirname(fileURLToPath(import.meta.url));

// next dev는 .env.local을 알아서 읽지만 맨 node는 아니다
function loadEnvLocal() {
  try {
    const text = readFileSync(join(here, "..", ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // 없으면 환경변수만 쓴다
  }
}

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL이 없습니다. web/.env.local에 넣거나 환경변수로 주세요.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(join(here, "..", "..", "db", "schema.sql"), "utf8");

const statements = schema
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

let applied = 0;
for (const stmt of statements) {
  try {
    await sql.query(stmt);
    applied += 1;
  } catch (e) {
    console.error(`\n실패한 구문:\n${stmt}\n→ ${e.message}`);
    process.exit(1);
  }
}

console.log(`스키마 적용 완료 — ${applied}개 구문.`);
