import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { backfillPeopleForPool } from "@/lib/people";
import { createGroup } from "@/lib/groups";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const poolRows = await sql`
    SELECT id FROM pools WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id as string;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Make sure every player has a person_id. Phase 1 already does this on pool reads,
  // but this endpoint is called directly so we run the backfill here too.
  await backfillPeopleForPool(sql, poolId);

  const memberRows = await sql`
    SELECT person_id FROM players WHERE pool_id = ${poolId} AND person_id IS NOT NULL
  `;
  const personIds = memberRows.map((r) => r.person_id as string);

  const group = await createGroup(sql, session.chairmanId, name, personIds);
  return NextResponse.json({ group, memberCount: personIds.length });
}
