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
    SELECT tier, custom_ad_image, custom_ad_url, custom_ad_headline, custom_ad_description, ad_removed
    FROM chairmen WHERE id = ${session.chairmanId}
  `;

  return NextResponse.json(rows[0] || {});
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const sql = getDb();

  if (body.action === "remove_ad") {
    await sql`UPDATE chairmen SET ad_removed = true, custom_ad_image = null, custom_ad_url = null, custom_ad_headline = null, custom_ad_description = null WHERE id = ${session.chairmanId}`;
  } else if (body.action === "restore_default") {
    await sql`UPDATE chairmen SET ad_removed = false, custom_ad_image = null, custom_ad_url = null, custom_ad_headline = null, custom_ad_description = null WHERE id = ${session.chairmanId}`;
  } else if (body.action === "save_custom") {
    await sql`
      UPDATE chairmen SET
        ad_removed = false,
        custom_ad_image = ${body.customAdImage || null},
        custom_ad_url = ${body.customAdUrl || null},
        custom_ad_headline = ${body.customAdHeadline || null},
        custom_ad_description = ${body.customAdDescription || null}
      WHERE id = ${session.chairmanId}
    `;
  }

  return NextResponse.json({ ok: true });
}
