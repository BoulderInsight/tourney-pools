import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  fetchLeaderboard,
  extractRoundScores,
  normalizeName,
} from "@/lib/golf-api";
import { importTournamentField, draftPoolFromField } from "@/lib/draft-pool";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const results: { tournament: string; updated: number; status: string }[] = [];
  const errors: string[] = [];

  // Promote tournaments whose start date has arrived (scheduled → in_progress).
  // Nothing else does this, without it a tournament is never synced on day one.
  await sql`
    UPDATE tournaments SET status = 'in_progress', updated_at = now()
    WHERE status = 'scheduled'
      AND start_date <= CURRENT_DATE
      AND end_date >= CURRENT_DATE
  `;

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

      // Index this tournament's golfers. Pools created through the setup
      // wizard store golfers by name with no odds_api_id, so we match on
      // odds_api_id first, then fall back to a unique normalized name,
      // backfilling the id so future syncs are an exact match.
      const dbGolfers = await sql`
        SELECT id, name, odds_api_id
        FROM tournament_golfers
        WHERE tournament_id = ${tournament.id}
      `;
      const byApiId = new Map<string, string>();
      const byName = new Map<string, string | null>();
      for (const g of dbGolfers) {
        if (g.odds_api_id) byApiId.set(String(g.odds_api_id), g.id);
        const nm = normalizeName(g.name);
        // null marks an ambiguous name shared by 2+ golfers, never match it
        byName.set(nm, byName.has(nm) ? null : g.id);
      }

      let updated = 0;

      for (const golfer of leaderboard.golfers) {
        const { r1, r2, r3, r4 } = extractRoundScores(golfer);

        const madeCut = golfer.status === "cut"
          ? false
          : golfer.status === "active" && (r3 !== null || r4 !== null)
          ? true
          : null;

        // Resolve the row: API id, then unique normalized name.
        let targetId = byApiId.get(golfer.playerId);
        let backfillId = false;
        if (!targetId) {
          const named = byName.get(
            normalizeName(`${golfer.firstName} ${golfer.lastName}`)
          );
          if (named) {
            targetId = named;
            backfillId = true;
          }
        }
        if (!targetId) continue;

        // Update tournament_golfers, skip manual overrides
        const result = await sql`
          UPDATE tournament_golfers SET
            r1 = COALESCE(${r1}, r1),
            r2 = COALESCE(${r2}, r2),
            r3 = COALESCE(${r3}, r3),
            r4 = COALESCE(${r4}, r4),
            made_cut = COALESCE(${madeCut}, made_cut),
            odds_api_id = COALESCE(odds_api_id, ${backfillId ? golfer.playerId : null}),
            status = ${golfer.status},
            updated_at = now()
          WHERE id = ${targetId}
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

  // Unlock pools waiting on a field that has now been published.
  let unlocked = 0;
  const awaitingPools = await sql`
    SELECT p.id, p.settings, t.id AS tournament_id,
           t.api_tournament_id, t.year
    FROM pools p
    JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.awaiting_field = true
      AND t.api_source = 'slashgolf'
      AND t.api_tournament_id IS NOT NULL
  `;
  const handledTournaments = new Set<string>();
  for (const pool of awaitingPools) {
    if (handledTournaments.has(pool.tournament_id)) continue;
    handledTournaments.add(pool.tournament_id);
    try {
      const field = await importTournamentField(
        pool.tournament_id,
        pool.api_tournament_id,
        pool.year
      );
      if (!field) continue; // field still not published, try again next run

      for (const p of awaitingPools.filter((x) => x.tournament_id === pool.tournament_id)) {
        const draftType = p.settings?.draftType || "auto-snake";
        const { drafted } = await draftPoolFromField(p.id, draftType, field);
        await sql`
          UPDATE pools SET
            awaiting_field = false,
            draft_complete = ${drafted},
            last_sync_at = now()
          WHERE id = ${p.id}
        `;
        unlocked++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`awaiting-field unlock: ${message}`);
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
    unlocked,
    errors: errors.length > 0 ? errors : undefined,
  });
}
