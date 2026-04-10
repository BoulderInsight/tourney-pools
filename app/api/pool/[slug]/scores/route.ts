import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "Super admin required" }, { status: 403 });
  }

  const sql = getDb();

  const poolRows = await sql`
    SELECT id FROM pools WHERE slug = ${params.slug}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id;

  const { golferId, field, value } = await req.json();

  // Find the pool golfer and its linked tournament golfer
  const golferRows = await sql`
    SELECT g.id, g.tournament_golfer_id FROM golfers g
    WHERE g.id = ${golferId} AND g.pool_id = ${poolId}
  `;
  if (golferRows.length === 0) {
    return NextResponse.json({ error: "Golfer not found" }, { status: 404 });
  }

  const tgId = golferRows[0].tournament_golfer_id;

  // Write scores to tournament_golfers (shared) if linked, otherwise to pool golfer
  const targetTable = tgId ? "tournament_golfers" : "golfers";
  const targetId = tgId || golferId;

  if (field === "madeCut") {
    if (tgId) {
      await sql`UPDATE tournament_golfers SET made_cut = ${value} WHERE id = ${tgId}`;
    } else {
      await sql`UPDATE golfers SET made_cut = ${value} WHERE id = ${golferId}`;
    }
  } else if (["r1", "r2", "r3", "r4"].includes(field)) {
    const numVal = value === "" || value === null ? null : Number(value);
    if (tgId) {
      if (field === "r1") await sql`UPDATE tournament_golfers SET r1 = ${numVal} WHERE id = ${tgId}`;
      else if (field === "r2") await sql`UPDATE tournament_golfers SET r2 = ${numVal} WHERE id = ${tgId}`;
      else if (field === "r3") await sql`UPDATE tournament_golfers SET r3 = ${numVal} WHERE id = ${tgId}`;
      else if (field === "r4") await sql`UPDATE tournament_golfers SET r4 = ${numVal} WHERE id = ${tgId}`;
    } else {
      if (field === "r1") await sql`UPDATE golfers SET r1 = ${numVal} WHERE id = ${golferId}`;
      else if (field === "r2") await sql`UPDATE golfers SET r2 = ${numVal} WHERE id = ${golferId}`;
      else if (field === "r3") await sql`UPDATE golfers SET r3 = ${numVal} WHERE id = ${golferId}`;
      else if (field === "r4") await sql`UPDATE golfers SET r4 = ${numVal} WHERE id = ${golferId}`;
    }
  }

  // Mark pool golfer as manually overridden
  await sql`UPDATE golfers SET manual_override = true WHERE id = ${golferId}`;

  return NextResponse.json({ ok: true });
}
