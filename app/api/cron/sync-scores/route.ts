import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syncPoolScores } from "@/lib/odds-api";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const pools = await sql`
    SELECT id, slug FROM pools WHERE setup_complete = true
  `;

  const results = [];
  for (const pool of pools) {
    try {
      const result = await syncPoolScores(pool.id);
      results.push({ slug: pool.slug, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ slug: pool.slug, error: message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
