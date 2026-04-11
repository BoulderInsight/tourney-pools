import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.isSuperAdmin) return null;
  return session;
}

// GET: List all tournaments (including completed/cancelled)
export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();
  const tournaments = await sql`
    SELECT t.*,
      (SELECT COUNT(*) FROM pools WHERE tournament_id = t.id) as pool_count
    FROM tournaments t
    ORDER BY t.start_date DESC
  `;

  return NextResponse.json(tournaments);
}

// POST: Create or update a tournament
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, slug, courseName, location, startDate, endDate, year, status, logoUrl, apiSource, apiTournamentId } = body;

  if (!name || !slug || !year) {
    return NextResponse.json({ error: "name, slug, and year are required" }, { status: 400 });
  }

  const sql = getDb();

  if (id) {
    // Update existing
    await sql`
      UPDATE tournaments SET
        name = ${name},
        slug = ${slug},
        course_name = ${courseName || null},
        location = ${location || null},
        start_date = ${startDate || null},
        end_date = ${endDate || null},
        year = ${year},
        status = ${status || 'scheduled'},
        logo_url = ${logoUrl || null},
        api_source = ${apiSource || null},
        api_tournament_id = ${apiTournamentId || null},
        updated_at = now()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true, id });
  }

  // Create new
  const result = await sql`
    INSERT INTO tournaments (name, slug, course_name, location, start_date, end_date, year, status, logo_url, api_source, api_tournament_id)
    VALUES (${name}, ${slug}, ${courseName || null}, ${location || null}, ${startDate || null}, ${endDate || null}, ${year}, ${status || 'scheduled'}, ${logoUrl || null}, ${apiSource || null}, ${apiTournamentId || null})
    RETURNING id
  `;

  return NextResponse.json({ ok: true, id: result[0].id });
}

// DELETE: Remove a tournament
export async function DELETE(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  const sql = getDb();

  // Check for linked pools first
  const linked = await sql`SELECT COUNT(*) as count FROM pools WHERE tournament_id = ${id}`;
  if (Number(linked[0].count) > 0) {
    return NextResponse.json({ error: "Cannot delete tournament with linked pools" }, { status: 400 });
  }

  // Delete tournament_golfers first, then tournament
  await sql`DELETE FROM tournament_golfers WHERE tournament_id = ${id}`;
  await sql`DELETE FROM tournaments WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
