import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { fetchLeaderboard } from "../lib/golf-api";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PGA_TOURNAMENT_ID = "93ec852a-b362-458c-963c-5b7ee2885978";

function parseScore(s: string): number | null {
  if (!s || s === "") return null;
  if (s === "E") return 0;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // C-1: flip status
  const flipped = await sql`
    UPDATE tournaments
    SET status = 'in_progress', updated_at = now()
    WHERE id = ${PGA_TOURNAMENT_ID}
    RETURNING name, status
  `;
  console.log("Flipped:", flipped[0]);

  // C-2: run the cron's exact logic once to seed scores immediately
  const t = await sql`
    SELECT id, name, api_tournament_id, year
    FROM tournaments
    WHERE id = ${PGA_TOURNAMENT_ID}
  `;
  const tournament = t[0];

  const leaderboard = await fetchLeaderboard(tournament.api_tournament_id, tournament.year);

  let updated = 0;
  for (const golfer of leaderboard.golfers) {
    const r1 = golfer.rounds.find((r) => r.roundId === 1);
    const r2 = golfer.rounds.find((r) => r.roundId === 2);
    const r3 = golfer.rounds.find((r) => r.roundId === 3);
    const r4 = golfer.rounds.find((r) => r.roundId === 4);

    const madeCut =
      golfer.status === "cut"
        ? false
        : golfer.status === "active" && (r3 || r4)
        ? true
        : null;

    const result = await sql`
      UPDATE tournament_golfers SET
        r1 = COALESCE(${parseScore(r1?.scoreToPar || "")}, r1),
        r2 = COALESCE(${parseScore(r2?.scoreToPar || "")}, r2),
        r3 = COALESCE(${parseScore(r3?.scoreToPar || "")}, r3),
        r4 = COALESCE(${parseScore(r4?.scoreToPar || "")}, r4),
        made_cut = COALESCE(${madeCut}, made_cut),
        status = ${golfer.status},
        updated_at = now()
      WHERE tournament_id = ${tournament.id}
        AND odds_api_id = ${golfer.playerId}
        AND (manual_override IS NULL OR manual_override = false)
      RETURNING id
    `;
    if (result.length > 0) updated++;
  }

  console.log(`Updated ${updated} golfer rows from leaderboard API.`);
  console.log(`API tournament status: ${leaderboard.status}`);

  // C-3: bump last_sync_at on pools so the page stops claiming stale data
  await sql`UPDATE pools SET last_sync_at = now() WHERE tournament_id = ${tournament.id} AND setup_complete = true`;

  // Quick verification — show first 5 PGA golfers with scores
  const sample = await sql`
    SELECT name, odds_api_id, r1, r2, r3, r4, status, made_cut
    FROM tournament_golfers
    WHERE tournament_id = ${tournament.id}
      AND odds_api_id IS NOT NULL
    ORDER BY (r1 + COALESCE(r2,0) + COALESCE(r3,0) + COALESCE(r4,0)) ASC NULLS LAST
    LIMIT 10
  `;
  console.log("\nTop 10 by total (sanity check):");
  console.table(sample);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
