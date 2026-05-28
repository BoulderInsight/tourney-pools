import { getDb } from "./db";
import { fetchLeaderboard, extractRoundScores } from "./golf-api";
import { draftGolfers } from "./pool";
import { syncTournamentPredictions } from "./datagolf-sync";
import type { DraftType, Golfer, PoolPlayer } from "./types";

// A tournament_golfers row, as needed to build a pool's field. dg_* fields
// power the auto-snake seed order via draftGolfers; null when DataGolf has
// no quote for this golfer (off-tour event, name miss, sync skipped).
export interface FieldGolfer {
  id: string;
  name: string;
  world_ranking: number | null;
  dg_win_prob: number | null;
  dg_skill_rating: number | null;
}

// Fetch a tournament's live field from the golf API and upsert it into
// tournament_golfers. Returns the field in leaderboard order, or null if the
// field has not been published yet (the API returns nothing pre-tournament).
export async function importTournamentField(
  tournamentId: string,
  apiTournamentId: string,
  year: number
): Promise<FieldGolfer[] | null> {
  const sql = getDb();

  let leaderboard;
  try {
    leaderboard = await fetchLeaderboard(apiTournamentId, year);
  } catch {
    return null; // field not published yet, try again on the next cron run
  }
  if (leaderboard.golfers.length === 0) return null;

  for (const g of leaderboard.golfers) {
    const fullName = `${g.firstName} ${g.lastName}`.trim();
    const { r1, r2, r3, r4 } = extractRoundScores(g);
    const madeCut = g.status === "cut" ? false
      : g.status === "active" && (r3 !== null || r4 !== null) ? true : null;
    const existing = await sql`
      SELECT id FROM tournament_golfers
      WHERE tournament_id = ${tournamentId} AND odds_api_id = ${g.playerId}
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
    } else {
      await sql`
        INSERT INTO tournament_golfers (tournament_id, name, odds_api_id, r1, r2, r3, r4, made_cut, status)
        VALUES (${tournamentId}, ${fullName}, ${g.playerId}, ${r1}, ${r2}, ${r3}, ${r4}, ${madeCut}, ${g.status})
      `;
    }
  }

  // Now that tournament_golfers rows exist for every entrant, refresh
  // DataGolf pre-tournament predictions so the auto-snake draft below has a
  // real seed signal. syncTournamentPredictions silently no-ops on errors;
  // worst case the seed falls back to alphabetical (status quo before this).
  try {
    await syncTournamentPredictions(tournamentId);
  } catch (err) {
    console.error("[draft-pool] DataGolf sync threw (continuing):", err);
  }

  // Return the field in leaderboard order (the auto-snake seed order)
  const rows = await sql`
    SELECT id, name, odds_api_id, world_ranking, dg_win_prob, dg_skill_rating
    FROM tournament_golfers
    WHERE tournament_id = ${tournamentId} AND odds_api_id IS NOT NULL
  `;
  const byApiId = new Map(rows.map((r) => [String(r.odds_api_id), r]));
  return leaderboard.golfers
    .map((g) => byApiId.get(g.playerId))
    .filter((r) => r != null)
    .map((r) => ({
      id: r!.id as string,
      name: r!.name as string,
      world_ranking: r!.world_ranking as number | null,
      dg_win_prob: r!.dg_win_prob != null ? Number(r!.dg_win_prob) : null,
      dg_skill_rating: r!.dg_skill_rating != null ? Number(r!.dg_skill_rating) : null,
    }));
}

// (Re)create a pool's golfers from a tournament field and, for auto draft
// types, run the draft. For a live snake draft, golfers are placed but no
// assignments are made (the chairman runs the draft on the draft page).
// Returns whether a draft was actually run.
export async function draftPoolFromField(
  poolId: string,
  draftType: DraftType,
  field: FieldGolfer[]
): Promise<{ golferCount: number; drafted: boolean }> {
  const sql = getDb();

  await sql`DELETE FROM assignments WHERE pool_id = ${poolId}`;
  await sql`DELETE FROM golfers WHERE pool_id = ${poolId}`;

  const golfers: Golfer[] = [];
  for (const tg of field) {
    const row = await sql`
      INSERT INTO golfers (pool_id, name, world_ranking, tournament_golfer_id)
      VALUES (${poolId}, ${tg.name}, ${tg.world_ranking}, ${tg.id})
      RETURNING id, name
    `;
    golfers.push({
      id: row[0].id, name: row[0].name,
      r1: null, r2: null, r3: null, r4: null, madeCut: null,
      worldRanking: tg.world_ranking,
      // dg_* fields stay on the shared tournament_golfers row but we also
      // surface them here so draftGolfers can sort by them. The per-pool
      // golfers table doesn't need its own DG columns — the next read via
      // the public API joins tournament_golfers and picks them up.
      dgWinProb: tg.dg_win_prob,
      dgSkillRating: tg.dg_skill_rating,
    });
  }

  if (draftType !== "auto-snake" && draftType !== "random") {
    return { golferCount: golfers.length, drafted: false };
  }

  const playerRows = await sql`
    SELECT id, name FROM players WHERE pool_id = ${poolId} ORDER BY pick_order
  `;
  const players: PoolPlayer[] = playerRows.map((p) => ({ id: p.id, name: p.name }));
  const result = draftGolfers(players, golfers, draftType);
  for (const a of result) {
    await sql`
      INSERT INTO assignments (pool_id, player_id, golfer_id, pick_number)
      VALUES (${poolId}, ${a.playerId}, ${a.golferId}, ${a.pickNumber})
    `;
  }
  return { golferCount: golfers.length, drafted: true };
}
