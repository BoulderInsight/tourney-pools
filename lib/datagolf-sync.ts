import { getDb } from "./db";
import {
  fetchPreTournamentPredictions,
  indexPredictionsByName,
  lookupPrediction,
} from "./datagolf";

/**
 * Fetch DataGolf pre-tournament predictions for the current PGA Tour event
 * and write the win/top10 probabilities onto every matching tournament_golfers
 * row that belongs to the given tournament. Returns a small summary the
 * caller can log.
 *
 * Idempotent and self-throttling: skips the network call if dg_synced_at
 * was updated within the last `freshSeconds` window (default 6 hours), so
 * a chairman who runs the wizard twice doesn't burn DataGolf calls.
 *
 * Failure mode: this function never throws. DataGolf hiccups should not
 * block a draft. A skip due to errors is logged and the draft falls back
 * to whatever ranking signal is already on tournament_golfers (most likely
 * nothing, meaning the sort lands on name).
 */
export async function syncTournamentPredictions(
  tournamentId: string,
  options: { freshSeconds?: number } = {},
): Promise<{ updated: number; total: number; matched: number; skipped: string }> {
  const freshSeconds = options.freshSeconds ?? 6 * 60 * 60;
  const sql = getDb();

  // Bail out if we synced recently. Saves an API call per pool when several
  // chairmen draft the same event the same morning.
  const tRows = await sql`
    SELECT name, dg_synced_at FROM tournaments WHERE id = ${tournamentId}
  `;
  if (tRows.length === 0) {
    return { updated: 0, total: 0, matched: 0, skipped: "tournament not found" };
  }
  const tournament = tRows[0];
  const syncedAt = tournament.dg_synced_at as Date | string | null;
  if (syncedAt) {
    const ageMs = Date.now() - new Date(syncedAt as string | Date).getTime();
    if (ageMs < freshSeconds * 1000) {
      return { updated: 0, total: 0, matched: 0, skipped: "recently synced" };
    }
  }

  let preds;
  try {
    preds = await fetchPreTournamentPredictions("pga");
  } catch (err) {
    console.error("[datagolf-sync] fetch failed:", err);
    return { updated: 0, total: 0, matched: 0, skipped: `fetch error: ${(err as Error).message}` };
  }

  if (preds.predictions.length === 0) {
    // Off-week or season break: no predictions to apply.
    await sql`UPDATE tournaments SET dg_synced_at = now() WHERE id = ${tournamentId}`;
    return { updated: 0, total: 0, matched: 0, skipped: `no predictions for ${preds.eventName}` };
  }

  const index = indexPredictionsByName(preds.predictions);

  const golfers = await sql`
    SELECT id, name FROM tournament_golfers WHERE tournament_id = ${tournamentId}
  `;
  let matched = 0;
  let updated = 0;
  for (const g of golfers) {
    const hit = lookupPrediction(g.name as string, index);
    if (!hit) continue;
    matched += 1;
    // dg_skill_rating: we use top10Prob as a stable secondary signal since
    // the baseline prediction set doesn't ship a separate skill_rating field.
    // Larger = better. Used as the second sort key in draftGolfers.
    await sql`
      UPDATE tournament_golfers
      SET dg_win_prob = ${hit.winProb},
          dg_skill_rating = ${hit.top10Prob},
          dg_updated_at = now()
      WHERE id = ${g.id}
    `;
    updated += 1;
  }

  await sql`UPDATE tournaments SET dg_synced_at = now() WHERE id = ${tournamentId}`;

  return { updated, total: golfers.length, matched, skipped: "" };
}
