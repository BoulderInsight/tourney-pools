import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Return a random pool name suggestion
export async function GET() {
  const sql = getDb();
  const rows = await sql`SELECT name FROM pool_name_suggestions ORDER BY random() LIMIT 1`;
  const suggestion = rows.length > 0 ? rows[0].name : "My Golf Pool";
  return NextResponse.json({ suggestion });
}

// POST: Add a new suggestion (super admin only)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const sql = getDb();
  await sql`INSERT INTO pool_name_suggestions (name) VALUES (${name.trim()}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}

// DELETE: Remove a suggestion (super admin only)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  const sql = getDb();
  await sql`DELETE FROM pool_name_suggestions WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
