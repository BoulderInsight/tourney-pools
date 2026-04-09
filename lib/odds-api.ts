import { getDb } from "./db";

const ESPN_GOLF_URL = "https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

interface ESPNGolferScore {
  name: string;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  madeCut: boolean | null;
}

export async function fetchTournamentScores(): Promise<ESPNGolferScore[]> {
  const res = await fetch(ESPN_GOLF_URL, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`ESPN API error: ${res.status}`);
  }

  const data = await res.json();
  const events = data.events || [];

  // Find the Masters (or current active tournament)
  const mastersEvent = events.find((e: { name?: string }) =>
    e.name?.toLowerCase().includes("masters")
  ) || events[0];

  if (!mastersEvent) {
    throw new Error("No active golf tournament found");
  }

  const golfers: ESPNGolferScore[] = [];

  for (const comp of mastersEvent.competitions || []) {
    for (const c of comp.competitors || []) {
      const athlete = c.athlete || {};
      const rawLinescores = c.linescores || [];
      const status = c.status?.type?.name || "";

      // ESPN linescore.displayValue has the relative-to-par score (e.g. "-5", "+2", "E")
      // linescore.value is running stroke total through holes played (unreliable mid-round)
      // Only count completed rounds where value is a valid 18-hole score (55-85)
      const rounds = rawLinescores.map((ls: { value?: number; displayValue?: string }) => {
        if (!ls?.displayValue) return null;
        const strokes = ls.value ?? 0;
        if (strokes < 55 || strokes > 85) return null;
        if (ls.displayValue === "E") return 0;
        const num = parseInt(ls.displayValue);
        return isNaN(num) ? null : num;
      });

      const r1 = rounds[0] ?? null;
      const r2 = rounds[1] ?? null;
      const r3 = rounds[2] ?? null;
      const r4 = rounds[3] ?? null;

      // Determine cut status
      let madeCut: boolean | null = null;
      if (status === "STATUS_CUT") {
        madeCut = false;
      } else if (r3 != null) {
        madeCut = true;
      }

      golfers.push({
        name: athlete.displayName || "",
        r1,
        r2,
        r3,
        r4,
        madeCut,
      });
    }
  }

  return golfers;
}

function normalizedName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export async function syncPoolScores(poolId: string): Promise<{ updated: number; unmatched: string[] }> {
  const scores = await fetchTournamentScores();
  const sql = getDb();

  const golfers = await sql`
    SELECT id, name, odds_api_id, manual_override
    FROM golfers WHERE pool_id = ${poolId}
  `;

  let updated = 0;
  const unmatched: string[] = [];

  for (const score of scores) {
    if (!score.name) continue;

    let golfer = golfers.find((g) => g.odds_api_id && g.odds_api_id === score.name);
    if (!golfer) {
      const normalized = normalizedName(score.name);
      golfer = golfers.find((g) => normalizedName(g.name) === normalized);
    }

    if (!golfer) {
      unmatched.push(score.name);
      continue;
    }

    if (golfer.manual_override) continue;

    await sql`
      UPDATE golfers SET
        r1 = COALESCE(${score.r1}, r1),
        r2 = COALESCE(${score.r2}, r2),
        r3 = COALESCE(${score.r3}, r3),
        r4 = COALESCE(${score.r4}, r4),
        made_cut = COALESCE(${score.madeCut}, made_cut),
        odds_api_id = COALESCE(odds_api_id, ${score.name})
      WHERE id = ${golfer.id}
    `;
    updated++;
  }

  await sql`UPDATE pools SET last_sync_at = now() WHERE id = ${poolId}`;

  return { updated, unmatched };
}
