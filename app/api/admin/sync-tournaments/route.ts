import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fetchSchedule, fetchTournamentDetail } from "@/lib/golf-api";

export async function POST() {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const year = new Date().getFullYear();
  const sql = getDb();

  // Fetch PGA Tour schedule
  const schedule = await fetchSchedule(year);

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const t of schedule) {
    const slug = t.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      + `-${year}`;

    // Check if we already have this tournament
    const existing = await sql`
      SELECT id FROM tournaments
      WHERE api_tournament_id = ${t.tournId} AND year = ${year} AND api_source = 'slashgolf'
    `;

    // Fetch detail for course/location (rate-limit friendly: only for new or missing data)
    let courseName: string | null = null;
    let location: string | null = null;

    if (existing.length === 0) {
      try {
        const detail = await fetchTournamentDetail(t.tournId, year);
        courseName = detail.courseName;
        const parts = [detail.city, detail.state, detail.country].filter(Boolean);
        location = parts.length > 0 ? parts.join(", ") : null;
      } catch (err) {
        errors.push(`Detail fetch failed for ${t.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const startDate = t.startDate ? t.startDate.toISOString().split("T")[0] : null;
    const endDate = t.endDate ? t.endDate.toISOString().split("T")[0] : null;

    if (existing.length > 0) {
      // Update dates (they can shift)
      await sql`
        UPDATE tournaments SET
          name = ${t.name},
          start_date = ${startDate},
          end_date = ${endDate},
          updated_at = now()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO tournaments (name, slug, course_name, location, start_date, end_date, year, status, api_source, api_tournament_id)
        VALUES (${t.name}, ${slug}, ${courseName}, ${location}, ${startDate}, ${endDate}, ${year}, 'scheduled', 'slashgolf', ${t.tournId})
      `;
      created++;
    }
  }

  return NextResponse.json({
    ok: true,
    year,
    total: schedule.length,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}
