import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isProEffective } from "@/lib/tier";

export const dynamic = "force-dynamic";

/**
 * Public RSVP submit. Anyone with the pool slug can call this for any player id
 * in that pool. Tradeoff: pool slugs are unguessable (nanoid), the leaderboard
 * URL is shareable already, and the chairman can override any status. Per-invitee
 * tokens would be more secure but the spec opted for a single shared invite link.
 *
 * Locked once draft_complete=true: the chairman has committed to the roster and
 * RSVPs can no longer flip the active player list.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const sql = getDb();
  const body = await req.json().catch(() => ({}));
  const { playerId, status } = body as { playerId?: string; status?: string };

  if (!playerId || (status !== "accepted" && status !== "declined")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const poolRows = await sql`
    SELECT p.id, p.draft_complete, c.tier, c.pro_until 
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    WHERE p.slug = ${params.slug}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const pool = poolRows[0];

  if (pool.draft_complete) {
    return NextResponse.json(
      { error: "Draft is complete. Pool roster is locked." },
      { status: 409 },
    );
  }

  if (status === "accepted") {
    const isPro = isProEffective(pool.tier, pool.pro_until);
    if (!isPro) {
      const playerCount = await sql`
        SELECT COUNT(*) as count FROM players 
        WHERE pool_id = ${pool.id} 
          AND rsvp_status != 'declined'
          AND id != ${playerId}
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

  const updated = await sql`
    UPDATE players
    SET rsvp_status = ${status}
    WHERE id = ${playerId} AND pool_id = ${pool.id}
    RETURNING id, name, rsvp_status
  `;

  if (updated.length === 0) {
    return NextResponse.json({ error: "Player not found in this pool" }, { status: 404 });
  }

  return NextResponse.json({
    player: {
      id: updated[0].id as string,
      name: updated[0].name as string,
      rsvpStatus: updated[0].rsvp_status as "pending" | "accepted" | "declined",
    },
  });
}
