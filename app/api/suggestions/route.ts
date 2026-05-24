import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Render an arbitrary suggestion as a canonical pool name 'The X Pool'.
 *
 * Why: the suggestion is shown in the dashboard placeholder ('Pool name
 * (e.g. The Joshua Pool)') AND embedded as the example chairmen anchor on
 * when naming a pool. The 'The X Pool' shape reads cleanly in the SMS
 * invite body, e.g. 'You're invited to join The Joshua Pool for the
 * Charles Schwab Challenge'. Bare names ('JOSHUA!') made that body feel
 * awkward and chairmen-typed names often inherited the same shape.
 *
 * Rules:
 *   - Strip trailing punctuation (!, ?, .)
 *   - ALL-CAPS gets normalized to Title Case ('JOSHUA' -> 'Joshua') so the
 *     wrapping doesn't read like shouting. Mixed-case is left alone since
 *     intentional caps ('BMW Open') should survive.
 *   - If already starts with 'The' AND ends with 'Pool', leave it alone.
 *   - Otherwise add 'The' / 'Pool' on whichever end is missing.
 *
 * Applied on read only; the underlying suggestion text stays as the admin
 * entered it so they can revise without losing format flexibility.
 */
function poolifySuggestion(raw: string): string {
  const stripped = raw.trim().replace(/[!?.]+$/, "");
  const alphaOnly = stripped.replace(/[^A-Za-z]/g, "");
  const core =
    alphaOnly && alphaOnly === alphaOnly.toUpperCase() && alphaOnly !== alphaOnly.toLowerCase()
      ? stripped.toLowerCase().replace(/\b(\w)/g, (m) => m.toUpperCase())
      : stripped;
  const startsWithThe = /^the\s+/i.test(core);
  const hasPool = /\bpool\b/i.test(core);
  if (startsWithThe && hasPool) return core;
  if (startsWithThe) return `${core} Pool`;
  if (hasPool) return `The ${core}`;
  return `The ${core} Pool`;
}

// GET: Return a random pool name suggestion
export async function GET() {
  const sql = getDb();
  const rows = await sql`SELECT name FROM pool_name_suggestions ORDER BY random() LIMIT 1`;
  const raw = rows.length > 0 ? (rows[0].name as string) : "My Golf Pool";
  return NextResponse.json({ suggestion: poolifySuggestion(raw) });
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
