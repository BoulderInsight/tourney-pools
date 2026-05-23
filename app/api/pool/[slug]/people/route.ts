import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  backfillPeopleForPool,
  getPlayersWithPeople,
  reconcilePoolPersonsByName,
} from "@/lib/people";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const poolRows = await sql`
    SELECT id, pool_name, draft_complete FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const pool = poolRows[0];
  const poolId = pool.id as string;

  // First link any player that lacks a person_id (legacy pools), then reconcile
  // players currently linked to a handle-less Person back to the chairman's
  // handle-bearing Person of the same name (fixes pools where an earlier buggy
  // backfill orphaned handles later collected via a Group). Both idempotent.
  await backfillPeopleForPool(sql, poolId);
  await reconcilePoolPersonsByName(sql, poolId);

  const players = await getPlayersWithPeople(sql, poolId);
  return NextResponse.json({
    players,
    poolName: pool.pool_name,
    draftComplete: !!pool.draft_complete,
  });
}
