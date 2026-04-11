import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = getDb();

  const tournaments = await sql`
    SELECT id, name, slug, course_name, location, start_date, end_date, year, status, logo_url, api_tournament_id
    FROM tournaments
    WHERE status IN ('scheduled', 'in_progress')
    ORDER BY start_date ASC
  `;

  // Generate logo URLs from PGA Tour CDN if we have an api_tournament_id
  const withLogos = tournaments.map((t) => ({
    ...t,
    logo_url: t.logo_url || (t.api_tournament_id
      ? `https://res.cloudinary.com/pgatour-prod/d_tournaments:logos:R000.png/tournaments/logos/R${t.api_tournament_id.padStart(3, "0")}.png`
      : null),
  }));

  return NextResponse.json(withLogos);
}
