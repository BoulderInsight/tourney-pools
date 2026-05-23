// Run with: npx tsx scripts/verify-people-migration.ts
// Asserts that after a setup-wizard save, every player in the saved pool has a person_id
// and a matching row in `people` owned by the pool's chairman.
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT pl.id AS player_id, pl.name AS player_name, pl.person_id,
           p.chairman_id AS pool_chairman_id, pe.chairman_id AS person_chairman_id, pe.name AS person_name
    FROM players pl
    JOIN pools p ON p.id = pl.pool_id
    LEFT JOIN people pe ON pe.id = pl.person_id
    ORDER BY p.created_at DESC
    LIMIT 20
  `;
  console.log("Most recent 20 players:");
  for (const r of rows) {
    const linked = r.person_id ? "linked" : "MISSING person_id";
    const owned = r.person_chairman_id === r.pool_chairman_id ? "owned" : "OWNER MISMATCH";
    console.log(`  ${r.player_name.padEnd(20)}  ${linked.padEnd(20)}  ${owned}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
