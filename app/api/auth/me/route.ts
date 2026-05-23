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
  const rows = await sql`
    SELECT tier, pro_until FROM chairmen WHERE id = ${session.chairmanId}
  `;
  const tier = rows[0]?.tier || "free";
  const proUntil = rows[0]?.pro_until ?? null;

  return NextResponse.json({ ...session, tier, proUntil });
}
