import { getDb } from "./db";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

interface OddsApiScore {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
}

interface GolferScoreData {
  name: string;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  madeCut: boolean | null;
}

export async function fetchTournamentScores(): Promise<GolferScoreData[]> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) throw new Error("THE_ODDS_API_KEY not set");

  const res = await fetch(
    `${ODDS_API_BASE}/sports/golf_pga/scores/?apiKey=${apiKey}&daysFrom=3`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Odds API error: ${res.status} ${await res.text()}`);
  }

  const data: OddsApiScore[] = await res.json();

  const golferMap = new Map<string, GolferScoreData>();

  for (const event of data) {
    if (event.scores) {
      for (const s of event.scores) {
        if (!golferMap.has(s.name)) {
          golferMap.set(s.name, {
            name: s.name,
            r1: null,
            r2: null,
            r3: null,
            r4: null,
            madeCut: null,
          });
        }
      }
    }
  }

  return Array.from(golferMap.values());
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
