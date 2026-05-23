import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const sql = neon(process.env.DATABASE_URL!);

  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  // Tournaments that should be 'completed' but are still 'scheduled'/'in_progress'
  const stale = await sql`
    SELECT id, name, status, start_date, end_date
    FROM tournaments
    WHERE end_date < CURRENT_DATE
      AND status IN ('scheduled', 'in_progress')
    ORDER BY end_date DESC
  `;
  console.log(`Tournaments past end_date but not marked completed: ${stale.length}`);
  console.table(
    stale.map((t) => ({
      name: t.name,
      status: t.status,
      end_date: t.end_date?.toISOString().split("T")[0],
    }))
  );

  // Tournaments that should be 'in_progress' but are still 'scheduled'
  const live = await sql`
    SELECT id, name, status, start_date, end_date
    FROM tournaments
    WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
      AND status = 'scheduled'
    ORDER BY start_date ASC
  `;
  console.log(`\nTournaments running NOW but still marked scheduled: ${live.length}`);
  console.table(
    live.map((t) => ({
      name: t.name,
      status: t.status,
      start_date: t.start_date?.toISOString().split("T")[0],
      end_date: t.end_date?.toISOString().split("T")[0],
    }))
  );

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to update.");
    return;
  }

  const c1 = await sql`
    UPDATE tournaments SET status = 'completed', updated_at = now()
    WHERE end_date < CURRENT_DATE
      AND status IN ('scheduled', 'in_progress')
    RETURNING id
  `;
  const c2 = await sql`
    UPDATE tournaments SET status = 'in_progress', updated_at = now()
    WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
      AND status = 'scheduled'
    RETURNING id
  `;
  console.log(`\nMarked ${c1.length} completed, ${c2.length} in_progress.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
