import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncTournamentPredictions } from "@/lib/datagolf-sync";

/**
 * Super-admin manual trigger to refresh DataGolf pre-tournament predictions
 * for a single tournament. Useful right after launch to backfill events that
 * were drafted before the integration existed, and as a recovery tool when
 * the wizard's automatic sync gets skipped (e.g. quota error, name mismatch
 * tweaks).
 *
 * Bypasses the 6-hour freshness window the wizard uses so a deliberate
 * admin call always hits the network. The same idempotent UPDATEs run
 * regardless of when the previous sync happened.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { tournamentId: string } },
) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();
  const tournRows = await sql`
    SELECT id, name FROM tournaments WHERE id = ${params.tournamentId}
  `;
  if (tournRows.length === 0) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const result = await syncTournamentPredictions(params.tournamentId, { freshSeconds: 0 });
  return NextResponse.json({
    ok: true,
    tournament: tournRows[0].name as string,
    ...result,
  });
}
