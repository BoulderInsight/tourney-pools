import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchLeaderboard, extractRoundScores } from "@/lib/golf-api";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const results: { tournament: string; updated: number; status: string }[] = [];
  const errors: string[] = [];

  // Find all in-progress tournaments with an API source
  const tournaments = await sql`
    SELECT id, name, api_tournament_id, year
    FROM tournaments
    WHERE status = 'in_progress' AND api_source = 'slashgolf' AND api_tournament_id IS NOT NULL
  `;

  for (const tournament of tournaments) {
    try {
      const leaderboard = await fetchLeaderboard(
        tournament.api_tournament_id,
        tournament.year
      );

      let updated = 0;

      for (const golfer of leaderboard.golfers) {
        const { r1, r2, r3, r4 } = extractRoundScores(golfer);

        const madeCut = golfer.status === "cut"
          ? false
          : golfer.status === "active" && (r3 !== null || r4 !== null)
          ? true
          : null;

        // Update tournament_golfers, skip manual overrides
        const result = await sql`
          UPDATE tournament_golfers SET
            r1 = COALESCE(${r1}, r1),
            r2 = COALESCE(${r2}, r2),
            r3 = COALESCE(${r3}, r3),
            r4 = COALESCE(${r4}, r4),
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

      // Mark tournament completed if API says so
      const apiStatus = leaderboard.status?.toLowerCase() || "";
      if (apiStatus === "completed" || apiStatus === "official") {
        await sql`UPDATE tournaments SET status = 'completed', updated_at = now() WHERE id = ${tournament.id}`;
      }

      // Update last_sync_at on all pools linked to this tournament
      await sql`UPDATE pools SET last_sync_at = now() WHERE tournament_id = ${tournament.id} AND setup_complete = true`;

      results.push({
        tournament: tournament.name,
        updated,
        status: apiStatus,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${tournament.name}: ${message}`);
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}
