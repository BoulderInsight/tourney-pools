import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Return current draft state (players with order, assignments so far, available golfers)
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  // GET is public so spectators can watch the draft
  const sql = getDb();
  const poolRows = await sql`
    SELECT id, settings FROM pools
    WHERE slug = ${params.slug}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id;

  const players = await sql`SELECT id, name, pick_order FROM players WHERE pool_id = ${poolId} ORDER BY pick_order`;
  const golfers = await sql`
    SELECT g.id, g.name, g.world_ranking, tg.world_ranking as tg_ranking
    FROM golfers g
    LEFT JOIN tournament_golfers tg ON g.tournament_golfer_id = tg.id
    WHERE g.pool_id = ${poolId}
    ORDER BY COALESCE(tg.world_ranking, g.world_ranking, 9999), g.name
  `;
  const assignments = await sql`
    SELECT player_id, golfer_id, pick_number FROM assignments WHERE pool_id = ${poolId} ORDER BY pick_number
  `;

  return NextResponse.json({ players, golfers, assignments });
}

// POST: Make a pick or draw order or lock pool
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const poolRows = await sql`
    SELECT id FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id;

  const body = await req.json();

  if (body.action === "draw_order") {
    // Randomly assign pick_order to players
    const players = await sql`SELECT id FROM players WHERE pool_id = ${poolId}`;
    const order = players.map((_, i) => i).sort(() => Math.random() - 0.5);
    for (let i = 0; i < players.length; i++) {
      await sql`UPDATE players SET pick_order = ${order[i]} WHERE id = ${players[i].id}`;
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "pick") {
    const { playerId, golferId, pickNumber } = body;
    // Verify golfer not already picked
    const existing = await sql`SELECT id FROM assignments WHERE pool_id = ${poolId} AND golfer_id = ${golferId}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Golfer already drafted" }, { status: 400 });
    }
    await sql`
      INSERT INTO assignments (pool_id, player_id, golfer_id, pick_number)
      VALUES (${poolId}, ${playerId}, ${golferId}, ${pickNumber})
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "undo") {
    // Remove the last pick
    const last = await sql`
      SELECT id FROM assignments WHERE pool_id = ${poolId} ORDER BY pick_number DESC LIMIT 1
    `;
    if (last.length > 0) {
      await sql`DELETE FROM assignments WHERE id = ${last[0].id}`;
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "lock") {
    await sql`UPDATE pools SET draft_complete = true WHERE id = ${poolId}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
