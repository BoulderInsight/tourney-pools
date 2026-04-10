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

    // Completed rounds (have a total score)
    const r1 = r1Total != null ? r1Total - PAR : null;
    const r2 = r2Total != null ? r2Total - PAR : null;
    const r3 = r3Total != null ? r3Total - PAR : null;
    const r4 = r4Total != null ? r4Total - PAR : null;

    let finalR1 = r1, finalR2 = r2, finalR3 = r3, finalR4 = r4;

    // For in-progress rounds, use the "today" field (e.g. -2, 1, "E" for even)
    const today = p.today;
    const thru = p.thru;
    const isOnCourse = thru && thru !== "" && thru !== "F" && thru !== "--";

    if (isOnCourse && today != null && today !== "") {
      const todayScore = today === "E" ? 0 : Number(today);
      if (!isNaN(todayScore)) {
        const completedRounds = [r1, r2, r3, r4].filter(r => r !== null).length;
        if (completedRounds === 0) finalR1 = todayScore;
        else if (completedRounds === 1) finalR2 = todayScore;
        else if (completedRounds === 2) finalR3 = todayScore;
        else if (completedRounds === 3) finalR4 = todayScore;
      }
    }

    // Cut status: status "C" = cut, "F" or similar = finished/active
    let madeCut: boolean | null = null;
    if (p.status === "C") {
      madeCut = false;
    } else if (r3 != null) {
      madeCut = true;
    }

    golfers.push({
      name: p.full_name || `${p.first_name} ${p.last_name}`,
      r1: finalR1,
      r2: finalR2,
      r3: finalR3,
      r4: finalR4,
      madeCut,
    });
  }

  return golfers;
}

function normalizedName(name: string): string {
  // Decompose accented chars (é→e, ø→o, á→a, etc.) then strip non-alpha
  const decomposed = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Handle ø/Ø specifically (not decomposed by NFD)
  const fixed = decomposed.replace(/ø/gi, "o");
  return fixed.toLowerCase().replace(/[^a-z]/g, "");
}

function normalizedLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return normalizedName(parts[parts.length - 1]);
}

// Sync scores to the shared tournament_golfers table (affects ALL pools)
export async function syncTournamentScores(): Promise<{ updated: number; unmatched: string[] }> {
  const scores = await fetchTournamentScores();
  const sql = getDb();

  const tGolfers = await sql`
    SELECT id, name, odds_api_id FROM tournament_golfers
  `;

  let updated = 0;
  const unmatched: string[] = [];

  for (const score of scores) {
    if (!score.name) continue;

    // Match by stored API name first
    let tg = tGolfers.find((g) => g.odds_api_id && g.odds_api_id === score.name);
    // Then exact normalized name
    if (!tg) {
      const normalized = normalizedName(score.name);
      tg = tGolfers.find((g) => normalizedName(g.name) === normalized);
    }
    // Then last name match
    if (!tg) {
      const scoreLast = normalizedLastName(score.name);
      const lastNameMatches = tGolfers.filter((g) => normalizedLastName(g.name) === scoreLast);
      if (lastNameMatches.length === 1) {
        tg = lastNameMatches[0];
      }
    }

    if (!tg) {
      unmatched.push(score.name);
      continue;
    }

    await sql`
      UPDATE tournament_golfers SET
        r1 = COALESCE(${score.r1}, r1),
        r2 = COALESCE(${score.r2}, r2),
        r3 = COALESCE(${score.r3}, r3),
        r4 = COALESCE(${score.r4}, r4),
        made_cut = COALESCE(${score.madeCut}, made_cut),
        odds_api_id = COALESCE(odds_api_id, ${score.name})
      WHERE id = ${tg.id}
    `;
    updated++;
  }

  // Update last_sync_at on all active pools
  await sql`UPDATE pools SET last_sync_at = now() WHERE setup_complete = true`;

  return { updated, unmatched };
}

// Legacy wrapper for per-pool sync calls
export async function syncPoolScores(poolId: string): Promise<{ updated: number; unmatched: string[] }> {
  const result = await syncTournamentScores();
  const sql = getDb();
  await sql`UPDATE pools SET last_sync_at = now() WHERE id = ${poolId}`;
  return result;
}
