import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

// Minimal .env.local loader
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("=== TOURNAMENTS ===");
  const tournaments = await sql`
    SELECT id, name, slug, year, status, api_source, api_tournament_id,
           start_date, end_date, updated_at
    FROM tournaments
    ORDER BY start_date DESC NULLS LAST
  `;
  console.table(tournaments);

  console.log("\n=== POOLS ===");
  const pools = await sql`
    SELECT p.id, p.slug, p.pool_name, p.tournament_id, t.name as tournament_name,
           t.status as tournament_status, p.setup_complete, p.last_sync_at, p.created_at
    FROM pools p
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    ORDER BY p.created_at DESC
  `;
  console.table(pools);

  console.log("\n=== PGA-RELATED TOURNAMENTS ===");
  const pga = await sql`
    SELECT id, name, slug, year, status, api_source, api_tournament_id, start_date, end_date
    FROM tournaments
    WHERE name ILIKE '%PGA%' OR slug ILIKE '%pga%'
  `;
  console.table(pga);

  console.log("\n=== ELIGIBLE FOR SYNC (what the cron sees) ===");
  const eligible = await sql`
    SELECT id, name, api_tournament_id, year, status, api_source
    FROM tournaments
    WHERE status = 'in_progress' AND api_source = 'slashgolf' AND api_tournament_id IS NOT NULL
  `;
  console.table(eligible);

  if (pga.length > 0) {
    const pgaT = pga[0];
    console.log(`\n=== SAMPLE GOLFERS for tournament "${pgaT.name}" (first 5) ===`);
    const golfers = await sql`
      SELECT id, name, odds_api_id, r1, r2, r3, r4, status, made_cut, manual_override, updated_at
      FROM tournament_golfers
      WHERE tournament_id = ${pgaT.id}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 5
    `;
    console.table(golfers);

    const totalGolfers = await sql`
      SELECT COUNT(*)::int AS total,
             COUNT(odds_api_id)::int AS with_api_id
      FROM tournament_golfers
      WHERE tournament_id = ${pgaT.id}
    `;
    console.log(`Total golfers: ${totalGolfers[0].total}, with odds_api_id: ${totalGolfers[0].with_api_id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
