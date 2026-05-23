import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { groupExistsForChairman, removeMemberFromGroup } from "@/lib/groups";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; personId: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const owned = await groupExistsForChairman(sql, params.id, session.chairmanId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const removed = await removeMemberFromGroup(sql, params.id, params.personId);
  if (!removed) {
    return NextResponse.json({ error: "Not a member" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
