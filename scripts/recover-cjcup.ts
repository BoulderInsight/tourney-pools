// Recover live scores for THE CJ CUP Byron Nelson.
//
// The pools for this tournament were set up off the generic default field, so
// their tournament_golfers rows have no odds_api_id and the score-sync cron
// can't match them. This script fuzzy-matches the field to the live API by
// name, backfills odds_api_id, flips the tournament to in_progress, and seeds
// scores immediately.
//
//   npx tsx scripts/recover-cjcup.ts            (dry-run)
//   npx tsx scripts/recover-cjcup.ts --apply    (write changes)

import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { fetchLeaderboard, extractRoundScores, normalizeName } from "../lib/golf-api";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const CJ_TOURNAMENT_ID = "dc28c4ec-6d99-41e8-867d-a17bb2c3f030";
const API_TOURN_ID = "019";
const YEAR = 2026;

async function main() {
  const apply = process.argv.includes("--apply");
  const sql = neon(process.env.DATABASE_URL!);
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  const leaderboard = await fetchLeaderboard(API_TOURN_ID, YEAR);
  console.log(`API leaderboard: status="${leaderboard.status}", ${leaderboard.golfers.length} golfers`);

  const dbGolfers = await sql`
    SELECT id, name, odds_api_id FROM tournament_golfers WHERE tournament_id = ${CJ_TOURNAMENT_ID}
  `;
  console.log(`DB tournament_golfers: ${dbGolfers.length}\n`);

  // Index API golfers by normalized name
  const apiByName = new Map<string, { playerId: string }>();
  for (const g of leaderboard.golfers) {
    apiByName.set(normalizeName(`${g.firstName} ${g.lastName}`), g);
  }

  const matches: { dbId: string; dbName: string; playerId: string }[] = [];
  const unmatched: string[] = [];
  for (const d of dbGolfers) {
    const g = apiByName.get(normalizeName(d.name));
    if (!g) { unmatched.push(d.name); continue; }
    matches.push({ dbId: d.id, dbName: d.name, playerId: g.playerId });
  }

  console.log(`Matched ${matches.length}/${dbGolfers.length} golfers to the live field; ${unmatched.length} unmatched.`);
  console.table(matches.map((m) => ({ golfer: m.dbName, playerId: m.playerId })));
  if (unmatched.length) {
    console.log("Unmatched (not in this tournament's field — will never have a score):");
    console.log("  " + unmatched.join(", "));
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to backfill IDs, flip status, and seed scores.");
    return;
  }

  // 1. Backfill odds_api_id on matched rows
  let idsSet = 0;
  for (const m of matches) {
    const r = await sql`
      UPDATE tournament_golfers SET odds_api_id = ${m.playerId}, updated_at = now()
      WHERE id = ${m.dbId} AND odds_api_id IS NULL RETURNING id
    `;
    if (r.length > 0) idsSet++;
  }
  console.log(`\nSet odds_api_id on ${idsSet} golfers.`);

  // 2. Flip tournament status so the cron picks it up
  const flipped = await sql`
    UPDATE tournaments SET status = 'in_progress', updated_at = now()
    WHERE id = ${CJ_TOURNAMENT_ID} RETURNING name, status
  `;
  console.log(`Tournament "${flipped[0].name}" → ${flipped[0].status}`);

  // 3. Seed scores now (same logic the cron runs)
  let updated = 0;
  for (const golfer of leaderboard.golfers) {
    const { r1, r2, r3, r4 } = extractRoundScores(golfer);
    const madeCut =
      golfer.status === "cut" ? false
      : golfer.status === "active" && (r3 !== null || r4 !== null) ? true
      : null;
    const r = await sql`
      UPDATE tournament_golfers SET
        r1 = COALESCE(${r1}, r1), r2 = COALESCE(${r2}, r2),
        r3 = COALESCE(${r3}, r3), r4 = COALESCE(${r4}, r4),
        made_cut = COALESCE(${madeCut}, made_cut),
        status = ${golfer.status}, updated_at = now()
      WHERE tournament_id = ${CJ_TOURNAMENT_ID} AND odds_api_id = ${golfer.playerId}
        AND (manual_override IS NULL OR manual_override = false)
      RETURNING id
    `;
    if (r.length > 0) updated++;
  }
  console.log(`Seeded scores for ${updated} golfers.`);

  // 4. Bump pool sync timestamps so pages stop showing "stale"
  await sql`
    UPDATE pools SET last_sync_at = now()
    WHERE tournament_id = ${CJ_TOURNAMENT_ID} AND setup_complete = true
  `;

  // 5. Verify
  const top = await sql`
    SELECT name, r1, r2, r3, r4, status FROM tournament_golfers
    WHERE tournament_id = ${CJ_TOURNAMENT_ID} AND odds_api_id IS NOT NULL AND r1 IS NOT NULL
    ORDER BY (COALESCE(r1,0)+COALESCE(r2,0)+COALESCE(r3,0)+COALESCE(r4,0)) ASC
    LIMIT 10
  `;
  console.log("\nTop 10 CJ CUP golfers by total (verification):");
  console.table(top);
}

main().catch((e) => { console.error(e); process.exit(1); });
