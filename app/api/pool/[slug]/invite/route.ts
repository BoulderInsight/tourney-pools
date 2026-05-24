import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildIosMultiRecipientSmsLink } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Chairman-only. Returns the sms: URL for inviting pool members and marks the
 * included invitees as `invited_at = now()` so a later tap of the same button
 * won't re-text people who've already been pinged.
 *
 * `mode`:
 *   "new"    - pending invitees with NULL invited_at. Used by "Invite to Pool".
 *   "resend" - all pending invitees regardless of prior invite. Used by "Resend
 *              Invites" to re-prod everyone who hasn't responded.
 *   "all"    - every player with a phone (pending OR accepted, declined
 *              excluded). Used by the dashboard "Text Pool" button to
 *              broadcast to the full pool. Accepted players tapping the link
 *              will see "you're already in" on /join.
 *
 * The pre-filled message: "You're invited to join {Pool Name} for the
 * {Tournament Name}! 🏌️ Tap here to RSVP: {join URL}". Body is URL-encoded
 * before being inserted into the sms: URL.
 *
 * Returns 200 with `{ smsUrl: null, recipients: [] }` when no eligible invitees
 * exist; the client hides the button.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode: "new" | "resend" | "all" =
    body.mode === "resend" ? "resend" : body.mode === "all" ? "all" : "new";

  const sql = getDb();
  const poolRows = await sql`
    SELECT p.id, p.slug, p.pool_name, p.draft_complete,
           t.name AS tournament_name
    FROM pools p
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.slug = ${params.slug} AND p.chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const pool = poolRows[0];
  if (pool.draft_complete) {
    return NextResponse.json(
      { error: "Draft is complete. Pool roster is locked." },
      { status: 409 },
    );
  }

  // Three recipient queries keyed by mode. All-mode pulls accepted players
  // alongside pending so the dashboard broadcast covers the whole pool.
  // Declined are never texted; if someone explicitly said no, they don't get
  // a re-ping.
  const rows = mode === "new"
    ? await sql`
        SELECT pl.id, pl.name, pe.phone
        FROM players pl
        JOIN people pe ON pe.id = pl.person_id
        WHERE pl.pool_id = ${pool.id}
          AND pl.rsvp_status = 'pending'
          AND pl.invited_at IS NULL
          AND pe.phone IS NOT NULL
      `
    : mode === "all"
    ? await sql`
        SELECT pl.id, pl.name, pe.phone
        FROM players pl
        JOIN people pe ON pe.id = pl.person_id
        WHERE pl.pool_id = ${pool.id}
          AND pl.rsvp_status IN ('pending', 'accepted')
          AND pe.phone IS NOT NULL
      `
    : await sql`
        SELECT pl.id, pl.name, pe.phone
        FROM players pl
        JOIN people pe ON pe.id = pl.person_id
        WHERE pl.pool_id = ${pool.id}
          AND pl.rsvp_status = 'pending'
          AND pe.phone IS NOT NULL
      `;

  const recipients = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    phone: r.phone as string,
  }));

  if (recipients.length === 0) {
    return NextResponse.json({ smsUrl: null, body: null, recipients: [] });
  }

  // NEXT_PUBLIC_BASE_URL is set in prod; falling back to tourneypools.com keeps
  // the link sensible if the env var ever drops out mid-deploy. The /join page
  // works behind either origin.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tourneypools.com";
  const joinUrl = `${baseUrl}/join/${pool.slug}`;
  const tournamentPart = pool.tournament_name ? ` for the ${pool.tournament_name}` : "";
  const messageBody = `You're invited to join ${pool.pool_name}${tournamentPart}! 🏌️ Tap here to RSVP: ${joinUrl}`;

  // Use the multi-recipient iOS form so every invitee actually gets addressed,
  // even with several recipients + a pre-filled body. The plain sms:p1,p2?body=
  // form is unreliable on iOS with many recipients: some versions only honor
  // the first phone and swallow the rest. Tradeoff: this always opens a fresh
  // composition, but for invite/resend that's fine (these aren't a recurring
  // group thread).
  const smsUrl = buildIosMultiRecipientSmsLink(recipients.map((r) => r.phone), messageBody);
  if (!smsUrl) {
    return NextResponse.json({ smsUrl: null, body: null, recipients: [] });
  }

  // Mark these invitees as texted now. Idempotent under repeat clicks: a "new"
  // invocation immediately after the first finds no rows because invited_at is
  // now set. "resend" always re-marks (the chairman is intentionally re-pinging).
  const ids = recipients.map((r) => r.id);
  await sql`
    UPDATE players SET invited_at = now()
    WHERE pool_id = ${pool.id} AND id = ANY(${ids}::uuid[])
  `;

  return NextResponse.json({ smsUrl, body: messageBody, recipients });
}
