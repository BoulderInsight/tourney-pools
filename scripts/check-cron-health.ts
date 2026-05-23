import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const PGA = "93ec852a-b362-458c-963c-5b7ee2885978";

  // 1. When did tournament_golfers last update for PGA?
  const tg = await sql`
    SELECT MIN(updated_at) AS oldest, MAX(updated_at) AS newest, COUNT(*) AS n,
           COUNT(*) FILTER (WHERE updated_at > now() - interval '30 minutes') AS updated_last_30m,
           COUNT(*) FILTER (WHERE updated_at > now() - interval '2 hours') AS updated_last_2h
    FROM tournament_golfers
    WHERE tournament_id = ${PGA}
  `;
  console.log("PGA tournament_golfers update freshness:");
  console.table(tg);

  // 2. When did each linked pool last sync?
  const pools = await sql`
    SELECT pool_name, last_sync_at, setup_complete
    FROM pools WHERE tournament_id = ${PGA}
    ORDER BY last_sync_at DESC NULLS LAST
  `;
  console.log("\nPGA-linked pools:");
  console.table(
    pools.map((p) => ({
      pool: p.pool_name,
      last_sync_at: p.last_sync_at?.toISOString(),
      setup_complete: p.setup_complete,
    }))
  );

  // 3. Server clock
  const t = await sql`SELECT now() AS now_utc, current_date AS today`;
  console.log("\nDB clock:", t[0]);
}

main();
