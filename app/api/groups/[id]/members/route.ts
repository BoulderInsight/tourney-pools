import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addMemberToGroup, getGroupForChairman } from "@/lib/groups";
import { findOrCreatePerson, createPerson, setPersonPhone } from "@/lib/people";
import { normalizeUsPhoneE164 } from "@/lib/phone";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const group = await getGroupForChairman(sql, params.id, session.chairmanId);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  let personId: string;

  if (typeof body.personId === "string" && body.personId.length > 0) {
    // Explicit Person id: chairman picked from the collision prompt or is
    // linking to a Person they know about. Verify ownership.
    const rows = await sql`
      SELECT id FROM people WHERE id = ${body.personId} AND chairman_id = ${session.chairmanId}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    personId = body.personId;
  } else if (typeof body.name === "string" && body.name.trim().length > 0) {
    // Typed-name path. forceNew=true means the chairman saw the collision
    // prompt and explicitly chose 'add as new person' (or wants to bypass
    // any silent match). Otherwise fall through to legacy find-or-create.
    const name = body.name.trim();
    const person = body.forceNew === true
      ? await createPerson(sql, session.chairmanId, name)
      : await findOrCreatePerson(sql, session.chairmanId, name);
    personId = person.id;
  } else {
    return NextResponse.json({ error: "personId or name required" }, { status: 400 });
  }

  // Optional phone on creation. Validated to E.164; bad input returns 400 so
  // the form can surface a "please re-enter" hint. Empty/missing is a no-op
  // (we don't clobber an existing handle-bearing Person's phone).
  if (typeof body.phone === "string" && body.phone.trim().length > 0) {
    const e164 = normalizeUsPhoneE164(body.phone);
    if (!e164) {
      return NextResponse.json({ error: "Invalid US phone number" }, { status: 400 });
    }
    await setPersonPhone(sql, personId, e164);
  }

  await addMemberToGroup(sql, params.id, personId);
  return NextResponse.json({ ok: true, personId });
}
