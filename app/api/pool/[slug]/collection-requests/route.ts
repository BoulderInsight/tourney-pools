import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
    SELECT id FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id as string;

  const body = await req.json();
  const personId = typeof body.personId === "string" ? body.personId : "";
  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  // Confirm the Person belongs to this chairman before issuing a token for them.
  const personRows = await sql`
    SELECT id FROM people WHERE id = ${personId} AND chairman_id = ${session.chairmanId}
  `;
  if (personRows.length === 0) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const token = nanoid(16);
  await sql`
    INSERT INTO collection_requests (token, person_id, pool_id)
    VALUES (${token}, ${personId}, ${poolId})
  `;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tourneypools.com";
  return NextResponse.json({ token, url: `${baseUrl}/collect/${token}` });
}
