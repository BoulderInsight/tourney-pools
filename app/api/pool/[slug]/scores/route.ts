import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

  const { golferId, field, value } = await req.json();

  const golferRows = await sql`
    SELECT id FROM golfers WHERE id = ${golferId} AND pool_id = ${poolId}
  `;
  if (golferRows.length === 0) {
    return NextResponse.json({ error: "Golfer not found" }, { status: 404 });
  }

  if (field === "madeCut") {
    await sql`UPDATE golfers SET made_cut = ${value}, manual_override = true WHERE id = ${golferId}`;
  } else if (field === "r1") {
    const numVal = value === "" || value === null ? null : Number(value);
    await sql`UPDATE golfers SET r1 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
  } else if (field === "r2") {
    const numVal = value === "" || value === null ? null : Number(value);
    await sql`UPDATE golfers SET r2 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
  } else if (field === "r3") {
    const numVal = value === "" || value === null ? null : Number(value);
    await sql`UPDATE golfers SET r3 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
  } else if (field === "r4") {
    const numVal = value === "" || value === null ? null : Number(value);
    await sql`UPDATE golfers SET r4 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
  } else if (field === "manualOverride") {
    await sql`UPDATE golfers SET manual_override = ${value} WHERE id = ${golferId}`;
  }

  return NextResponse.json({ ok: true });
}
