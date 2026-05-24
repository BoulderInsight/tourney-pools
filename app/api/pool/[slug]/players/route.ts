import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { findOrCreatePerson, setPersonPhone } from "@/lib/people";
import { normalizeUsPhoneE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Chairman-only: add a player to a pool that hasn't drafted yet.
 *
 * Used by the /pool/[slug]/players page when the chairman realizes they
 * forgot someone. Once draft_complete=true, the roster is locked (409) and
 * additions need to happen via re-drafting, which is out of scope here.
 *
 * Body: { name: string, phone?: string }
 *   name   non-empty after trim
 *   phone  optional US number; rejected with 400 if it can't be coerced
 *
 * The new player starts at the highest pick_order so the existing draft
 * order is preserved if the pool used live draft. RSVP defaults to 'pending'
 * which lights up the chairman's invite button.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phoneInput = typeof body.phone === "string" ? body.phone.trim() : "";

  if (name.length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const sql = getDb();
  const poolRows = await sql`
    SELECT id, draft_complete FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
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

  // Validate phone up front so we don't leave a Person half-updated. Empty
  // input is fine; only a non-empty, non-coercible value is rejected.
  let e164: string | null = null;
  if (phoneInput.length > 0) {
    e164 = normalizeUsPhoneE164(phoneInput);
    if (!e164) {
      return NextResponse.json({ error: "Invalid US phone number" }, { status: 400 });
    }
  }

  const person = await findOrCreatePerson(sql, session.chairmanId, name);
  if (e164) {
    await setPersonPhone(sql, person.id, e164);
  }

  // Append at the next pick_order so live-snake draft order stays sequential.
  const orderRows = await sql`
    SELECT COALESCE(MAX(pick_order), -1) + 1 AS next FROM players WHERE pool_id = ${pool.id}
  `;
  const pickOrder = Number(orderRows[0]?.next ?? 0);

  const inserted = await sql`
    INSERT INTO players (pool_id, name, pick_order, person_id, rsvp_status)
    VALUES (${pool.id}, ${name}, ${pickOrder}, ${person.id}, 'pending')
    RETURNING id, name, rsvp_status, invited_at
  `;
  const row = inserted[0];

  return NextResponse.json({
    id: row.id as string,
    name: row.name as string,
    rsvpStatus: row.rsvp_status as string,
    invitedAt: row.invited_at as string | null,
  });
}
