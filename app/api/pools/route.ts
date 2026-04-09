import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const pools = await sql`
    SELECT id, slug, pool_name, buy_in, setup_complete, created_at,
           (SELECT COUNT(*) FROM players WHERE pool_id = pools.id) as player_count
    FROM pools
    WHERE chairman_id = ${session.chairmanId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json(pools);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { poolName } = await req.json();
  const slug = nanoid(10);

  const sql = getDb();
  await sql`
    INSERT INTO pools (slug, chairman_id, pool_name)
    VALUES (${slug}, ${session.chairmanId}, ${poolName || 'My Masters Pool'})
  `;

  return NextResponse.json({ slug });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { poolId } = await req.json();
  const sql = getDb();

  // Verify ownership before deleting (CASCADE handles children)
  const result = await sql`
    DELETE FROM pools WHERE id = ${poolId} AND chairman_id = ${session.chairmanId}
    RETURNING id
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
