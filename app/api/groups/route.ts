import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createGroup, listGroupsForChairman } from "@/lib/groups";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const groups = await listGroupsForChairman(sql, session.chairmanId);
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const initialMemberPersonIds = Array.isArray(body.personIds)
    ? body.personIds.filter((p: unknown): p is string => typeof p === "string")
    : [];

  const sql = getDb();
  // Verify any provided personIds belong to this chairman before linking them.
  // A bad personId would otherwise silently no-op (FK enforces existence but not ownership).
  if (initialMemberPersonIds.length > 0) {
    const rows = await sql`
      SELECT id FROM people
      WHERE chairman_id = ${session.chairmanId} AND id = ANY(${initialMemberPersonIds}::uuid[])
    `;
    const validIds = new Set(rows.map((r) => r.id as string));
    for (const id of initialMemberPersonIds) {
      if (!validIds.has(id)) {
        return NextResponse.json({ error: `Person ${id} not owned by you` }, { status: 403 });
      }
    }
  }

  const group = await createGroup(sql, session.chairmanId, name, initialMemberPersonIds);
  return NextResponse.json({ group });
}
