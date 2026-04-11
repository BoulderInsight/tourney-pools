import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = getDb();

  const tournaments = await sql`
    SELECT id, name, slug, course_name, location, start_date, end_date, year, status, logo_url
    FROM tournaments
    WHERE status IN ('scheduled', 'in_progress')
    ORDER BY start_date ASC
  `;

  return NextResponse.json(tournaments);
}
