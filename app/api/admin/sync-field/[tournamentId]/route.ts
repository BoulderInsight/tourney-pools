import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fetchLeaderboard } from "@/lib/golf-api";

export async function POST(
  req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();

  // Look up the tournament to get the API tournament ID
  const tournRows = await sql`
    SELECT id, api_tournament_id, year FROM tournaments WHERE id = ${params.tournamentId}
  `;
  if (tournRows.length === 0) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const tournament = tournRows[0];
  if (!tournament.api_tournament_id) {
    return NextResponse.json({ error: "Tournament has no API source ID" }, { status: 400 });
  }

  // Fetch leaderboard (which includes the full field)
  const result = await fetchLeaderboard(
    tournament.api_tournament_id,
    tournament.year
  );

  // Parse round scores from scoreToPar strings (e.g. "-5" → -5, "E" → 0, "+3" → 3)
  const parseScore = (s: string): number | null => {
    if (!s || s === "") return null;
    if (s === "E") return 0;
    return Number(s);
  };

  let created = 0;
  let updated = 0;

  for (const golfer of result.golfers) {
    const fullName = `${golfer.firstName} ${golfer.lastName}`;

    const r1 = golfer.rounds.find((r) => r.roundId === 1);
    const r2 = golfer.rounds.find((r) => r.roundId === 2);
    const r3 = golfer.rounds.find((r) => r.roundId === 3);
    const r4 = golfer.rounds.find((r) => r.roundId === 4);

    const madeCut = golfer.status === "cut" ? false : golfer.status === "active" && (r3 || r4) ? true : null;

    // Check if golfer already exists for this tournament
    const existing = await sql`
      SELECT id FROM tournament_golfers
      WHERE tournament_id = ${tournament.id} AND odds_api_id = ${golfer.playerId}
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE tournament_golfers SET
          name = ${fullName},
          r1 = COALESCE(${parseScore(r1?.scoreToPar || "")}, r1),
          r2 = COALESCE(${parseScore(r2?.scoreToPar || "")}, r2),
          r3 = COALESCE(${parseScore(r3?.scoreToPar || "")}, r3),
          r4 = COALESCE(${parseScore(r4?.scoreToPar || "")}, r4),
          made_cut = COALESCE(${madeCut}, made_cut),
          status = ${golfer.status},
          updated_at = now()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO tournament_golfers (tournament_id, name, odds_api_id, r1, r2, r3, r4, made_cut, status)
        VALUES (
          ${tournament.id},
          ${fullName},
          ${golfer.playerId},
          ${parseScore(r1?.scoreToPar || "")},
          ${parseScore(r2?.scoreToPar || "")},
          ${parseScore(r3?.scoreToPar || "")},
          ${parseScore(r4?.scoreToPar || "")},
          ${madeCut},
          ${golfer.status}
        )
      `;
      created++;
    }
  }

  return NextResponse.json({
    ok: true,
    tournamentId: tournament.id,
    apiTournamentId: tournament.api_tournament_id,
    totalGolfers: result.golfers.length,
    tournamentStatus: result.status,
    created,
    updated,
  });
}
