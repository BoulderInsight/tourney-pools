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

  // Verify column existence
  console.log("=== COLUMNS on tournament_golfers ===");
  const tgCols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'tournament_golfers'
    ORDER BY ordinal_position
  `;
  console.table(tgCols);

  console.log("\n=== COLUMNS on golfers (pool-specific) ===");
  const gCols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'golfers'
    ORDER BY ordinal_position
  `;
  console.table(gCols);

  // Check Masters sync staleness (it's marked in_progress — has it actually been updating?)
  console.log("\n=== MASTERS tournament_golfers max updated_at (cron health check) ===");
  const masters = await sql`
    SELECT
      MIN(updated_at) AS oldest_update,
      MAX(updated_at) AS newest_update,
      COUNT(*) AS total
    FROM tournament_golfers
    WHERE tournament_id = 'bc814af1-22b8-4a2d-978b-7fac101267e4'
  `;
  console.table(masters);

  console.log("\n=== PGA tournament_golfers max updated_at ===");
  const pga = await sql`
    SELECT
      MIN(updated_at) AS oldest_update,
      MAX(updated_at) AS newest_update,
      COUNT(*) AS total,
      COUNT(odds_api_id) AS with_api_id,
      COUNT(r1) AS with_r1
    FROM tournament_golfers
    WHERE tournament_id = '93ec852a-b362-458c-963c-5b7ee2885978'
  `;
  console.table(pga);

  // Try the exact cron query against PGA (proving the SQL bug would fire if status were flipped)
  console.log("\n=== TRY the cron's UPDATE clause against PGA tournament ===");
  try {
    const result = await sql`
      SELECT 1 FROM tournament_golfers
      WHERE tournament_id = '93ec852a-b362-458c-963c-5b7ee2885978'
        AND (manual_override IS NULL OR manual_override = false)
      LIMIT 1
    `;
    console.log("Query succeeded — no manual_override bug.");
  } catch (e) {
    console.log("Query FAILS:", e instanceof Error ? e.message : e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
