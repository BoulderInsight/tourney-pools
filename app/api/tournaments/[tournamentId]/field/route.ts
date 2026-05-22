import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchLeaderboard } from "@/lib/golf-api";

export const dynamic = "force-dynamic";

// Returns the real golfer field for an API-backed tournament, so the pool
// setup wizard can draft from the actual field instead of the default list.
export async function GET(
  _req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  const sql = getDb();
  const rows = await sql`
    SELECT name, api_source, api_tournament_id, year
    FROM tournaments WHERE id = ${params.tournamentId}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  const t = rows[0];

  // Not an API-backed tournament — the wizard falls back to the default field
  if (t.api_source !== "slashgolf" || !t.api_tournament_id) {
    return NextResponse.json({ apiBacked: false, hasField: false, golfers: [] });
  }

  try {
    const leaderboard = await fetchLeaderboard(t.api_tournament_id, t.year);
    const golfers = leaderboard.golfers
      .map((g) => ({
        name: `${g.firstName} ${g.lastName}`.trim(),
        lastName: g.lastName || "",
      }))
      .filter((g) => g.name.length > 0)
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name))
      .map((g) => ({ name: g.name }));

    return NextResponse.json({
      apiBacked: true,
      hasField: golfers.length > 0,
      tournamentName: t.name,
      golfers,
    });
  } catch (err) {
    // The field isn't published yet (the API returns 400 pre-tournament) —
    // report it as API-backed so the wizard enters "awaiting field" mode.
    console.error(`[tournaments/${params.tournamentId}/field] field not available:`, err);
    return NextResponse.json({ apiBacked: true, hasField: false, golfers: [] });
  }
}
