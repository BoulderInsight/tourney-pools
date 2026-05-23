// When does the golf API actually publish a tournament's field?
// Tests fetchLeaderboard against upcoming tournaments at varying distances out.
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { fetchLeaderboard } from "../lib/golf-api";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const upcoming = await sql`
    SELECT name, api_tournament_id, year, start_date
    FROM tournaments
    WHERE start_date > CURRENT_DATE AND api_source = 'slashgolf' AND api_tournament_id IS NOT NULL
    ORDER BY start_date ASC
    LIMIT 12
  `;
  console.log(`Testing ${upcoming.length} upcoming tournaments:\n`);

  for (const t of upcoming) {
    const daysOut = Math.round(
      (new Date(t.start_date).getTime() - Date.now()) / 86400000
    );
    try {
      const lb = await fetchLeaderboard(t.api_tournament_id, t.year);
      console.log(
        `  +${String(daysOut).padStart(3)}d  ${t.name} — field: ${lb.golfers.length} golfers (status: ${lb.status})`
      );
    } catch (e) {
      console.log(
        `  +${String(daysOut).padStart(3)}d  ${t.name} — API error: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    await sleep(400);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
