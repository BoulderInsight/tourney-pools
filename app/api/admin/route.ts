import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEarlyChairmanThankYou } from "@/lib/email";
import { formatPromoExpiry } from "@/lib/tier";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return null;
  }
  return session;
}

// GET: List all chairmen with their pools
export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();

  const chairmen = await sql`
    SELECT
      c.id, c.email, c.name, c.email_verified, c.is_super_admin, c.tier, c.pro_until, c.created_at,
      (SELECT COUNT(*) FROM pools WHERE chairman_id = c.id) as pool_count
    FROM chairmen c
    ORDER BY c.created_at DESC
  `;

  const pools = await sql`
    SELECT
      p.id, p.slug, p.pool_name, p.buy_in, p.setup_complete, p.created_at,
      p.chairman_id,
      c.name as chairman_name, c.email as chairman_email,
      (SELECT COUNT(*) FROM players WHERE pool_id = p.id) as player_count,
      (SELECT COUNT(*) FROM golfers WHERE pool_id = p.id) as golfer_count
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    ORDER BY p.created_at DESC
  `;

  return NextResponse.json({ chairmen, pools });
}

// DELETE: Delete a chairman or pool
export async function DELETE(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, id } = await req.json();
  const sql = getDb();

  if (type === "chairman") {
    // Delete chairman and all their pools (cascade)
    await sql`DELETE FROM pools WHERE chairman_id = ${id}`;
    await sql`DELETE FROM chairmen WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  }

  if (type === "pool") {
    await sql`DELETE FROM pools WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// PATCH: Update chairman (verify email, toggle super admin, reset password)
export async function PATCH(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, action, value } = await req.json();
  const sql = getDb();

  if (action === "verify_email") {
    await sql`UPDATE chairmen SET email_verified = true, verification_token = NULL WHERE id = ${id}`;
  } else if (action === "toggle_super_admin") {
    await sql`UPDATE chairmen SET is_super_admin = ${value} WHERE id = ${id}`;
  } else if (action === "toggle_verified") {
    await sql`UPDATE chairmen SET email_verified = ${value} WHERE id = ${id}`;
  } else if (action === "set_tier") {
    await sql`UPDATE chairmen SET tier = ${value} WHERE id = ${id}`;
  } else if (action === "grant_promo") {
    // Two-week Pro window + thank-you email in one click. Used for early
    // chairmen who set up exactly one pool. We compute the timestamp here
    // (rather than in SQL) so the same value goes into both the UPDATE and
    // the email body.
    const rows = await sql`SELECT email, name, pro_until FROM chairmen WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Chairman not found" }, { status: 404 });
    }
    const chairman = rows[0];
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // The DB write happens before the email send. If the email send fails
    // we'd rather have the promo recorded than silently lose it; the admin
    // can re-trigger the email on its own if needed.
    await sql`UPDATE chairmen SET pro_until = ${expires.toISOString()} WHERE id = ${id}`;

    try {
      await sendEarlyChairmanThankYou(
        chairman.email as string,
        (chairman.name as string) || "",
        formatPromoExpiry(expires),
      );
    } catch (err) {
      console.error("[admin/grant_promo] email send failed:", err);
      return NextResponse.json(
        { ok: true, emailSent: false, error: "Promo applied but email send failed. Check SMTP." },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, emailSent: true, expiresAt: expires.toISOString() });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
