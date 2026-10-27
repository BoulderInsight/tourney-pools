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

  // Enforce player cap for free pools: max(8, current_count)
  // This grandfathers existing over-8 pools but blocks them from going higher
  if (status === "pending" || status === "accepted") {
    const isPro = isProEffective(pool.tier, pool.pro_until);
    if (!isPro) {
      // Non-interactive HTTP transaction (the neon() driver has no .begin()).
      // The FOR UPDATE lock serializes concurrent updates on the pool row;
      // the UPDATE's WHERE clause re-checks the cap inside the same
      // transaction so the count it sees reflects any writes that just
      // released the lock. A player already counted as active (pending or
      // accepted) can always switch between active statuses; a declined
      // player can only become active if doing so keeps the active count
      // under 8 (grandfathered pools already above 8 cannot grow further).
      const result = await sql.transaction([
        sql`SELECT id FROM pools WHERE id = ${pool.id} FOR UPDATE`,
        sql`
          UPDATE players
          SET rsvp_status = ${status}
          WHERE id = ${params.playerId} AND pool_id = ${pool.id}
            AND (
              rsvp_status <> 'declined'
              OR (
                SELECT count(*) FROM players
                WHERE pool_id = ${pool.id} AND rsvp_status <> 'declined'
              ) < 8
            )
          RETURNING id, name, rsvp_status
        `,
      ]);
      const [updated] = result[1];

      if (!updated) {
        const [exists] = await sql`
          SELECT 1 FROM players WHERE id = ${params.playerId} AND pool_id = ${pool.id}
        `;
        if (!exists) {
          return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }
        return NextResponse.json(
          { error: "Free pools hold up to 8 players. Upgrade to Pro to add more." },
          { status: 403 },
        );
      }

      return NextResponse.json({
        player: {
          id: updated.id as string,
          name: updated.name as string,
          rsvpStatus: updated.rsvp_status as "pending" | "accepted" | "declined",
        },
      });
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
