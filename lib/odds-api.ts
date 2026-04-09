import { getDb } from "./db";

const MASTERS_SCORES_URL = "https://www.masters.com/en_US/scores/feeds/2026/scores.json";

interface MastersGolferScore {
  name: string;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  madeCut: boolean | null;
}

export async function fetchTournamentScores(): Promise<MastersGolferScore[]> {
  const res = await fetch(MASTERS_SCORES_URL, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`Masters API error: ${res.status}`);
  }

  const data = await res.json();
  const players = data?.data?.player || [];
  const PAR = 72;

  const golfers: MastersGolferScore[] = [];

  for (const p of players) {
    const r1Total = p.round1?.total;
    const r2Total = p.round2?.total;
    const r3Total = p.round3?.total;
    const r4Total = p.round4?.total;

    // Only count rounds that are finished (have a total score)
    const r1 = r1Total != null ? r1Total - PAR : null;
    const r2 = r2Total != null ? r2Total - PAR : null;
    const r3 = r3Total != null ? r3Total - PAR : null;
    const r4 = r4Total != null ? r4Total - PAR : null;

    // Cut status: status "C" = cut, "F" or similar = finished/active
    let madeCut: boolean | null = null;
    if (p.status === "C") {
      madeCut = false;
    } else if (r3 != null) {
      madeCut = true;
    }

    golfers.push({
      name: p.full_name || `${p.first_name} ${p.last_name}`,
      r1,
      r2,
      r3,
      r4,
      madeCut,
    });
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
