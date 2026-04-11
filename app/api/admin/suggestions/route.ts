import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: List all suggestions (super admin only)
export async function GET() {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();
  const rows = await sql`SELECT id, name FROM pool_name_suggestions ORDER BY created_at DESC`;
  return NextResponse.json(rows);
}
