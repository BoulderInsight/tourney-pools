/**
 * DataGolf API client (https://datagolf.com/api-access-info).
 *
 * Why DataGolf and not betting outrights:
 *   - The Odds API only carries odds for the four men's majors. DataGolf
 *     publishes pre-tournament model predictions for every PGA Tour and
 *     DP World Tour event we'd ever run a pool around.
 *   - Their `win` field is a probability calibrated against Vegas, course
 *     fit, and recent form. It is a strictly better signal than world
 *     ranking, which slashgolf does not even expose for tournament fields.
 *
 * Endpoints used:
 *   GET /preds/pre-tournament?tour=pga&odds_format=percent&file_format=json
 *     → { event_name, last_updated, baseline: [{ player_name, dg_id, win,
 *         top_5, top_10, top_20, make_cut }], baseline_history_fit: [...] }
 *
 * Requires a Scratch PLUS subscription ($30/mo) for API access; the BASIC
 * tier does not include it.
 */

export interface DataGolfPrediction {
  /** "Last, First" as returned by DataGolf. Use `normalizedNameKey` to match. */
  playerName: string;
  /** Probability of winning the event, 0..1. */
  winProb: number;
  /** Probability of finishing top 10, 0..1. Used as a tiebreaker. */
  top10Prob: number;
}

export interface DataGolfPredictions {
  /** Event the predictions are for, e.g. "Charles Schwab Challenge". */
  eventName: string;
  /** Last refresh timestamp from DataGolf (UTC). */
  lastUpdated: string | null;
  predictions: DataGolfPrediction[];
}

/**
 * Fetch current-week pre-tournament predictions for a tour.
 *
 * Returns an empty `predictions` array when DataGolf has no active event for
 * the tour (off-week, season break). Callers should fall back to alphabetical
 * sort in that case.
 *
 * Throws on auth failures or rate limits so the caller can surface a
 * meaningful error to the chairman during setup.
 */
export async function fetchPreTournamentPredictions(
  tour: "pga" | "euro" = "pga",
): Promise<DataGolfPredictions> {
  const key = process.env.DATAGOLF_API_KEY;
  if (!key) {
    throw new Error("DATAGOLF_API_KEY not set");
  }
  const url = `https://feeds.datagolf.com/preds/pre-tournament?tour=${tour}&odds_format=percent&file_format=json&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    throw new Error("DataGolf rejected the API key (check subscription tier and key)");
  }
  if (res.status === 429) {
    throw new Error("Rate limited by DataGolf");
  }
  if (!res.ok) {
    throw new Error(`DataGolf API error: ${res.status}`);
  }
  const data = await res.json();

  // The baseline model is the one DataGolf treats as canonical. baseline_history_fit
  // is the variant that leans more on course history. We use baseline for stability;
  // the difference is usually small and history_fit is noisier early week.
  const rows: Array<Record<string, unknown>> = Array.isArray(data?.baseline) ? data.baseline : [];

  const predictions: DataGolfPrediction[] = rows
    .map((r) => ({
      playerName: typeof r.player_name === "string" ? r.player_name : "",
      winProb: typeof r.win === "number" ? r.win : Number(r.win) || 0,
      top10Prob: typeof r.top_10 === "number" ? r.top_10 : Number(r.top_10) || 0,
    }))
    .filter((p) => p.playerName.length > 0);

  return {
    eventName: typeof data?.event_name === "string" ? data.event_name : "",
    lastUpdated: typeof data?.last_updated === "string" ? data.last_updated : null,
    predictions,
  };
}

/**
 * Build a stable comparison key for golfer names so we can match DataGolf's
 * "Last, First" rows against slashgolf's "First Last" rows without false
 * negatives from accents, suffixes, or punctuation.
 *
 * Strategy:
 *   1. NFD-decompose and strip diacritics (é → e, ñ → n)
 *   2. Strip non-letters (handles "J.J. Spaun" vs "J J Spaun" etc.)
 *   3. Lowercase
 *
 * Same shape as the matcher in lib/odds-api.ts. Keep the two in sync if you
 * touch either.
 */
function normalizedKey(name: string): string {
  const decomposed = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Handle ø/Ø specifically (NFD doesn't decompose it)
  const fixed = decomposed.replace(/ø/gi, "o");
  return fixed.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Build a quick-lookup map keyed by both the DataGolf "Last, First" name and
 * a swapped "First Last" version of the same row. The double-keying means a
 * caller with either name shape gets an O(1) hit on the first try.
 */
export function indexPredictionsByName(
  predictions: DataGolfPrediction[],
): Map<string, DataGolfPrediction> {
  const map = new Map<string, DataGolfPrediction>();
  for (const p of predictions) {
    const original = normalizedKey(p.playerName);
    map.set(original, p);
    // Swap "Last, First" -> "First Last" and index that too. Some golfers
    // ("J.J. Spaun" -> "Spaun, J.J.") only round-trip cleanly when we
    // normalize after the swap.
    const commaIdx = p.playerName.indexOf(",");
    if (commaIdx > 0) {
      const last = p.playerName.slice(0, commaIdx).trim();
      const first = p.playerName.slice(commaIdx + 1).trim();
      const swapped = `${first} ${last}`;
      const swappedKey = normalizedKey(swapped);
      if (swappedKey && !map.has(swappedKey)) {
        map.set(swappedKey, p);
      }
    }
  }
  return map;
}

/**
 * Look up a DataGolf prediction by a slashgolf-style "First Last" golfer
 * name. Returns null when no match is found (DataGolf doesn't quote this
 * player, or the name differs in a way the normalizer can't bridge).
 */
export function lookupPrediction(
  golferName: string,
  index: Map<string, DataGolfPrediction>,
): DataGolfPrediction | null {
  const key = normalizedKey(golferName);
  return index.get(key) ?? null;
}

/**
 * Convert a DataGolf win probability to an American-odds string for display.
 *   p = 0.10  -> "+900"   (decimal 10.0 -> +900)
 *   p = 0.25  -> "+300"
 *   p = 0.55  -> "-122"
 *
 * Used for the pre-draft odds badge on the leaderboard. Anything outside
 * (0, 1) returns null so the caller can hide the badge.
 */
export function winProbToAmericanOdds(winProb: number | null | undefined): string | null {
  if (winProb == null || !isFinite(winProb) || winProb <= 0 || winProb >= 1) return null;
  const decimal = 1 / winProb;
  // Above 2.00 decimal -> positive American (underdog). Below -> negative (favorite).
  if (decimal >= 2) {
    const american = Math.round((decimal - 1) * 100);
    return `+${american}`;
  }
  const american = Math.round(-100 / (decimal - 1));
  return `${american}`;
}
