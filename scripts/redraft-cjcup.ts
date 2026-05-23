// Re-draft THE CJ CUP Byron Nelson pools off the real tournament field.
//
// Both CJ CUP pools (auto-snake) were drafted on the generic default field;
// most drafted golfers aren't in the tournament. This imports the real field
// and re-runs the auto-snake draft so every player gets real, in-field golfers.
//
//   npx tsx scripts/redraft-cjcup.ts            (dry-run)
//   npx tsx scripts/redraft-cjcup.ts --apply    (back up, import, re-draft)

import { readFileSync, writeFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { fetchLeaderboard, extractRoundScores } from "../lib/golf-api";
import { draftGolfers } from "../lib/pool";
import type { Golfer, PoolPlayer } from "../lib/types";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const CJ = "dc28c4ec-6d99-41e8-867d-a17bb2c3f030";
const API_TOURN = "019";
const YEAR = 2026;

async function main() {
  const apply = process.argv.includes("--apply");
  const sql = neon(process.env.DATABASE_URL!);
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  const lb = await fetchLeaderboard(API_TOURN, YEAR);
  console.log(`Live CJ CUP field: ${lb.golfers.length} golfers (status: ${lb.status})`);

  const pools = await sql`
    SELECT id, slug, pool_name FROM pools WHERE tournament_id = ${CJ} ORDER BY pool_name
  `;
  console.log(`Pools to re-draft: ${pools.map((p) => p.pool_name).join(", ")}\n`);

  if (!apply) {
    for (const pool of pools) {
      const players = await sql`SELECT id FROM players WHERE pool_id = ${pool.id}`;
      const n = players.length;
      const lo = Math.floor(lb.golfers.length / n);
      const hi = lb.golfers.length % n === 0 ? lo : lo + 1;
      console.log(`  ${pool.pool_name}: ${n} players -> ${lo === hi ? lo : `${lo}-${hi}`} golfers each, all in the field`);
    }
    console.log("\nDry-run only. Re-run with --apply to back up, import the field, and re-draft.");
    return;
  }

  // 1. Back up current golfers + assignments (reversible safety net)
  const backup = { takenAt: new Date().toISOString(), tournament: CJ, pools: [] as unknown[] };
  for (const pool of pools) {
    const golfers = await sql`SELECT * FROM golfers WHERE pool_id = ${pool.id}`;
    const assignments = await sql`SELECT * FROM assignments WHERE pool_id = ${pool.id}`;
    backup.pools.push({ id: pool.id, slug: pool.slug, pool_name: pool.pool_name, golfers, assignments });
  }
  const backupPath = `scripts/redraft-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath}`);

  // 2. Import the real field into tournament_golfers (upsert by odds_api_id)
  let created = 0, updated = 0;
  for (const g of lb.golfers) {
    const fullName = `${g.firstName} ${g.lastName}`;
    const { r1, r2, r3, r4 } = extractRoundScores(g);
    const madeCut = g.status === "cut" ? false
      : g.status === "active" && (r3 !== null || r4 !== null) ? true : null;
    const existing = await sql`
      SELECT id FROM tournament_golfers WHERE tournament_id = ${CJ} AND odds_api_id = ${g.playerId}
    `;
    if (existing.length > 0) {
      await sql`
        UPDATE tournament_golfers SET
          name = ${fullName},
          r1 = COALESCE(${r1}, r1), r2 = COALESCE(${r2}, r2),
          r3 = COALESCE(${r3}, r3), r4 = COALESCE(${r4}, r4),
          made_cut = COALESCE(${madeCut}, made_cut),
          status = ${g.status}, updated_at = now()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO tournament_golfers (tournament_id, name, odds_api_id, r1, r2, r3, r4, made_cut, status)
        VALUES (${CJ}, ${fullName}, ${g.playerId}, ${r1}, ${r2}, ${r3}, ${r4}, ${madeCut}, ${g.status})
      `;
      created++;
    }
  }
  console.log(`Real field imported: ${created} new, ${updated} updated in tournament_golfers`);

  // 3. Build the real-field list in leaderboard order (the auto-snake seed)
  const realTg = await sql`
    SELECT id, name, odds_api_id, world_ranking FROM tournament_golfers
    WHERE tournament_id = ${CJ} AND odds_api_id IS NOT NULL
  `;
  const tgByApiId = new Map(realTg.map((r) => [String(r.odds_api_id), r]));
  const orderedTg = lb.golfers.map((g) => tgByApiId.get(g.playerId)).filter((t) => t != null);

  // 4. Re-draft each pool — mirror the setup route's auto-snake path
  for (const pool of pools) {
    await sql`DELETE FROM assignments WHERE pool_id = ${pool.id}`;
    await sql`DELETE FROM golfers WHERE pool_id = ${pool.id}`;

    const golfers: Golfer[] = [];
    for (const tg of orderedTg) {
      const row = await sql`
        INSERT INTO golfers (pool_id, name, world_ranking, tournament_golfer_id)
        VALUES (${pool.id}, ${tg.name}, ${tg.world_ranking}, ${tg.id})
        RETURNING id, name
      `;
      golfers.push({
        id: row[0].id, name: row[0].name,
        r1: null, r2: null, r3: null, r4: null, madeCut: null,
        worldRanking: tg.world_ranking,
      });
    }

    const playerRows = await sql`
      SELECT id, name FROM players WHERE pool_id = ${pool.id} ORDER BY pick_order
    `;
    const players: PoolPlayer[] = playerRows.map((p) => ({ id: p.id, name: p.name }));

    const draftResult = draftGolfers(players, golfers, "auto-snake");
    for (const a of draftResult) {
      await sql`
        INSERT INTO assignments (pool_id, player_id, golfer_id, pick_number)
        VALUES (${pool.id}, ${a.playerId}, ${a.golferId}, ${a.pickNumber})
      `;
    }
    await sql`UPDATE pools SET last_sync_at = now() WHERE id = ${pool.id}`;
    console.log(`  ${pool.pool_name}: re-drafted ${golfers.length} golfers to ${players.length} players`);
  }

  // 5. Verify — every drafted golfer should now be in the field
  console.log("\nVerification — golfers per player:");
  for (const pool of pools) {
    const rows = await sql`
      SELECT p.name AS player, COUNT(*)::int AS drafted,
             COUNT(tg.odds_api_id)::int AS in_field
      FROM players p
      JOIN assignments a ON a.player_id = p.id
      JOIN golfers g ON g.id = a.golfer_id
      LEFT JOIN tournament_golfers tg ON tg.id = g.tournament_golfer_id
      WHERE p.pool_id = ${pool.id}
      GROUP BY p.name ORDER BY p.name
    `;
    console.log(`\n  ${pool.pool_name}:`);
    console.table(rows);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
