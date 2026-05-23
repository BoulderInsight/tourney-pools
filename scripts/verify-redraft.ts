import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const CJ = "dc28c4ec-6d99-41e8-867d-a17bb2c3f030";
  const pools = await sql`SELECT id, pool_name FROM pools WHERE tournament_id = ${CJ} ORDER BY pool_name`;
  for (const pool of pools) {
    const rows = await sql`
      SELECT p.name AS player, COUNT(*)::int AS golfers,
        COUNT(*) FILTER (WHERE tg.r1 IS NOT NULL)::int AS with_r1
      FROM players p
      JOIN assignments a ON a.player_id = p.id
      JOIN golfers g ON g.id = a.golfer_id
      LEFT JOIN tournament_golfers tg ON tg.id = g.tournament_golfer_id
      WHERE p.pool_id = ${pool.id} GROUP BY p.name ORDER BY p.name`;
    console.log(`\n${pool.pool_name}:`);
    console.table(rows);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
