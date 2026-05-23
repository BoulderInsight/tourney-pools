import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { fetchLeaderboard } from "../lib/golf-api";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const CJ = "dc28c4ec-6d99-41e8-867d-a17bb2c3f030";

  const tg = await sql`SELECT name, odds_api_id, r1, r2, r3, r4, status FROM tournament_golfers
    WHERE tournament_id = ${CJ} ORDER BY name LIMIT 8`;
  console.log("Sample CJ CUP tournament_golfers:");
  console.table(tg);

  // Pool-specific golfers + assignment count
  const g = await sql`SELECT COUNT(*)::int total, COUNT(tournament_golfer_id)::int linked
    FROM golfers WHERE pool_id IN (SELECT id FROM pools WHERE tournament_id = ${CJ})`;
  console.log("Pool-specific golfers for CJ CUP pools:", g[0]);

  // What the live API returns for tournId 019
  try {
    const lb = await fetchLeaderboard("019", 2026);
    console.log(`\nLive API (tournId 019, 2026): status=${lb.status}, golfers=${lb.golfers.length}`);
    console.table(lb.golfers.slice(0, 5).map((x) => ({
      name: `${x.firstName} ${x.lastName}`, playerId: x.playerId, total: x.total,
      thru: x.thru, status: x.status,
    })));

    // Name overlap between DB field and API field
    const apiNames = new Set(lb.golfers.map((x) => `${x.firstName} ${x.lastName}`.toLowerCase().trim()));
    const dbNames = await sql`SELECT name FROM tournament_golfers WHERE tournament_id = ${CJ}`;
    const matched = dbNames.filter((d) => apiNames.has(String(d.name).toLowerCase().trim())).length;
    console.log(`\nName overlap: ${matched}/${dbNames.length} DB golfers exact-match an API name`);
  } catch (e) {
    console.log("\nLive API fetch failed:", e instanceof Error ? e.message : String(e));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
