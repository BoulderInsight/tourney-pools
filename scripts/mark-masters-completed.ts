import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MASTERS_ID = "bc814af1-22b8-4a2d-978b-7fac101267e4";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const r = await sql`
    UPDATE tournaments SET status = 'completed', updated_at = now()
    WHERE id = ${MASTERS_ID} AND status = 'in_progress'
    RETURNING name, status, end_date
  `;
  console.log(r[0] ?? "(no change, already not in_progress)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
