import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { PaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Same sigil-strip normalization the people endpoints use. */
function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^[@$]+/, "");
  return trimmed.length === 0 ? null : trimmed;
}

function cleanPreferred(value: unknown): PaymentMethod | null {
  if (value === "venmo" || value === "cashapp" || value === "paypal") return value;
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT tier, pro_until, custom_ad_image, custom_ad_url, custom_ad_headline, custom_ad_description, ad_removed,
           venmo_handle, cashapp_handle, paypal_handle, preferred_method
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
  } else if (body.action === "save_payments") {
    await sql`
      UPDATE chairmen SET
        venmo_handle    = ${cleanHandle(body.venmoHandle)},
        cashapp_handle  = ${cleanHandle(body.cashappHandle)},
        paypal_handle   = ${cleanHandle(body.paypalHandle)},
        preferred_method = ${cleanPreferred(body.preferredMethod)}
      WHERE id = ${session.chairmanId}
    `;
  }

  return NextResponse.json({ ok: true });
}
