import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT tier, custom_ad_image, custom_ad_url FROM chairmen WHERE id = ${session.chairmanId}
  `;

  return NextResponse.json(rows[0] || {});
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { customAdImage, customAdUrl } = await req.json();
  const sql = getDb();

  await sql`
    UPDATE chairmen
    SET custom_ad_image = ${customAdImage || null}, custom_ad_url = ${customAdUrl || null}
    WHERE id = ${session.chairmanId}
  `;

  return NextResponse.json({ ok: true });
}
