import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(null);
  }

  const sql = getDb();
  const rows = await sql`SELECT tier FROM chairmen WHERE id = ${session.chairmanId}`;
  const tier = rows[0]?.tier || "free";

  return NextResponse.json({ ...session, tier });
}
