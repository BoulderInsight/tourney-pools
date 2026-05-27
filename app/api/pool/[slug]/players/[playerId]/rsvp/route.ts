import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Chairman-only RSVP override. Lets the chairman force a player's status from
 * the roster UI (e.g. marking a known-in player as accepted instead of waiting
 * for them to tap the link, or correcting a mis-tap).
 *
 * Locked once draft_complete=true.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; playerId: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };
  if (status !== "pending" && status !== "accepted" && status !== "declined") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const sql = getDb();
  const poolRows = await sql`
    SELECT id, draft_complete FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const pool = poolRows[0];
  // Lock only if a draft has *actually* happened (golfer assignments exist).
  // The draft_complete flag alone is too brittle: some pools end up with it
  // set without ever having anyone RSVP, leaving the chairman unable to flip
  // anyone to accepted. Checking the assignments table makes the lock match
  // the real intent — "the roster is frozen because picks have been made."
  if (pool.draft_complete) {
    const assigned = await sql`
      SELECT 1 FROM assignments WHERE pool_id = ${pool.id} LIMIT 1
    `;
    if (assigned.length > 0) {
      return NextResponse.json(
        { error: "Draft is complete. Pool roster is locked." },
        { status: 409 },
      );
    }
  }

  const updated = await sql`
    UPDATE players
    SET rsvp_status = ${status}
    WHERE id = ${params.playerId} AND pool_id = ${pool.id}
    RETURNING id, name, rsvp_status
  `;
  if (updated.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  return NextResponse.json({
    player: {
      id: updated[0].id as string,
      name: updated[0].name as string,
      rsvpStatus: updated[0].rsvp_status as "pending" | "accepted" | "declined",
    },
  });
}
