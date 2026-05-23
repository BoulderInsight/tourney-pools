import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public RSVP landing data. No auth — anyone with the pool slug can hit this.
 * The pool slug is already publicly shareable (it's the leaderboard URL too) so
 * this doesn't widen the privacy surface.
 *
 * Returns: pool name, tournament info, the (non-declined) invitee list with each
 * player's id, name, and current rsvp_status. Phones and payment handles are
 * NEVER included; those stay chairman-only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const sql = getDb();
  const poolRows = await sql`
    SELECT p.id, p.slug, p.pool_name, p.buy_in, p.settings, p.draft_complete,
           c.name AS chairman_name,
           t.name AS tournament_name, t.course_name AS tournament_course,
           t.location AS tournament_location, t.start_date AS tournament_start_date,
           t.end_date AS tournament_end_date, t.status AS tournament_status
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.slug = ${params.slug}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const pool = poolRows[0];

  // Show pending and accepted invitees so people can find their name and so
  // already-accepted invitees see "Already joined". Declined are intentionally
  // omitted from the public list (they can still re-tap their original link
  // because the row still exists, but they won't see their own name here; the
  // /join page handles the "I declined, can I change my mind?" UX separately
  // by accepting any player id even if not visible in the list).
  const players = await sql`
    SELECT id, name, rsvp_status
    FROM players
    WHERE pool_id = ${pool.id}
    ORDER BY name
  `;

  return NextResponse.json({
    poolName: pool.pool_name,
    buyIn: pool.buy_in,
    settings: pool.settings,
    chairmanName: pool.chairman_name,
    draftComplete: !!pool.draft_complete,
    tournament: pool.tournament_name
      ? {
          name: pool.tournament_name,
          course: pool.tournament_course,
          location: pool.tournament_location,
          startDate: pool.tournament_start_date,
          endDate: pool.tournament_end_date,
          status: pool.tournament_status,
        }
      : null,
    players: players.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      rsvpStatus: r.rsvp_status as "pending" | "accepted" | "declined",
    })),
  });
}
