import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isProEffective } from "@/lib/tier";

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
    SELECT p.id, c.tier, c.pro_until 
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    WHERE p.slug = ${params.slug} AND p.chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const pool = poolRows[0];

  if (status === "accepted") {
    const isPro = isProEffective(pool.tier, pool.pro_until);
    if (!isPro) {
      const playerCount = await sql`
        SELECT COUNT(*) as count FROM players 
        WHERE pool_id = ${pool.id} 
          AND rsvp_status != 'declined'
          AND id != ${params.playerId}
      `;
      const count = Number(playerCount[0]?.count || 0);
      
      if (count >= 8) {
        return NextResponse.json(
          { error: "Free pools can have up to 8 players. Upgrade to Pro to add more." },
          { status: 403 }
        );
      }
    }
  }
  // No draft_complete lock. Flipping a player's rsvp_status does not move
  // golfer assignments around — those rows live in the assignments table
  // independent of RSVP — it only changes whether the public leaderboard
  // includes them. The chairman owns this pool; they should be able to
  // mark someone accepted or declined at any time, including after a
  // draft has run (e.g. for pools where the field arrived and the draft
  // ran before anyone RSVPed, which is exactly when this endpoint is
  // most useful).

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
