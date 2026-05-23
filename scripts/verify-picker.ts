import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT name, status, start_date, end_date
    FROM tournaments
    WHERE status IN ('scheduled', 'in_progress')
      AND end_date >= CURRENT_DATE
    ORDER BY
      CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
      start_date ASC
    LIMIT 10
  `;
  console.table(
    rows.map((r) => ({
      name: r.name,
      status: r.status,
      dates: `${r.start_date?.toISOString().split("T")[0]} → ${r.end_date?.toISOString().split("T")[0]}`,
    }))
  );
}

main();
