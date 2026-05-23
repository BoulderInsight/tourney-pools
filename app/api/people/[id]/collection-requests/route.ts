import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPersonForChairman } from "@/lib/people";

/**
 * Mint a tokenized self-serve link tied to a Person (no pool context). Used from the
 * Groups view, where the chairman is collecting handles without a specific pool in mind.
 * Pool-context links live at POST /api/pool/[slug]/collection-requests.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const person = await getPersonForChairman(sql, params.id, session.chairmanId);
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }
  const token = nanoid(16);
  await sql`
    INSERT INTO collection_requests (token, person_id, pool_id)
    VALUES (${token}, ${person.id}, NULL)
  `;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tourneypools.com";
  return NextResponse.json({ token, url: `${baseUrl}/collect/${token}` });
}
