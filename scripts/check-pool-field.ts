// How many of each player's drafted golfers are actually in the live field?
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const CJ = "dc28c4ec-6d99-41e8-867d-a17bb2c3f030";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const pools = await sql`
    SELECT id, slug, pool_name FROM pools WHERE tournament_id = ${CJ} ORDER BY pool_name
  `;

  for (const pool of pools) {
    const rows = await sql`
      SELECT p.name AS player, g.name AS golfer,
             tg.odds_api_id, tg.r1, tg.r2, tg.r3, tg.r4, tg.status
      FROM players p
      JOIN assignments a ON a.player_id = p.id
      JOIN golfers g ON g.id = a.golfer_id
      LEFT JOIN tournament_golfers tg ON tg.id = g.tournament_golfer_id
      WHERE p.pool_id = ${pool.id}
      ORDER BY p.name, g.name
    `;

    const byPlayer = new Map<string, { total: number; inField: number; scored: number }>();
    for (const r of rows) {
      const s = byPlayer.get(r.player) || { total: 0, inField: 0, scored: 0 };
      s.total++;
      if (r.odds_api_id) s.inField++;
      if (r.r1 !== null || r.r2 !== null || r.r3 !== null || r.r4 !== null) s.scored++;
      byPlayer.set(r.player, s);
    }

    console.log(`\n=== ${pool.pool_name}  (slug ${pool.slug}) ===`);
    console.table(
      Array.from(byPlayer.entries()).map(([player, s]) => ({
        player,
        golfers_drafted: s.total,
        in_CJ_field: s.inField,
        not_in_field: s.total - s.inField,
      }))
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
