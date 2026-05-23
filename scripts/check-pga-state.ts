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

  // Status distribution
  const byStatus = await sql`
    SELECT status, COUNT(*) AS n
    FROM tournament_golfers
    WHERE tournament_id = ${PGA}
      AND odds_api_id IS NOT NULL
    GROUP BY status ORDER BY n DESC
  `;
  console.log("Player status distribution (PGA, with API ID):");
  console.table(byStatus);

  // Players who have R1 but not done — i.e. should still be moving
  const inFlux = await sql`
    SELECT name, r1, r2, r3, r4, status, updated_at
    FROM tournament_golfers
    WHERE tournament_id = ${PGA}
      AND odds_api_id IS NOT NULL
      AND status NOT IN ('cut', 'wd', 'complete')
    ORDER BY updated_at DESC
    LIMIT 10
  `;
  console.log("\nPlayers still 'active' (R1 not yet complete):");
  console.table(
    inFlux.map((g) => ({
      name: g.name,
      r1: g.r1, r2: g.r2, r3: g.r3, r4: g.r4,
      status: g.status,
      updated: g.updated_at?.toISOString().substr(11, 8),
    }))
  );

  // Hopefully different `updated_at` over time tells us cron is firing
  const distinct = await sql`
    SELECT DISTINCT date_trunc('minute', updated_at) AS minute, COUNT(*) AS golfers_updated_at_that_minute
    FROM tournament_golfers
    WHERE tournament_id = ${PGA}
      AND odds_api_id IS NOT NULL
      AND updated_at > now() - interval '6 hours'
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 20
  `;
  console.log("\nDistinct update minutes for PGA golfers (last 6h):");
  console.table(
    distinct.map((d) => ({
      minute: d.minute?.toISOString(),
      golfers_at_that_minute: d.golfers_updated_at_that_minute,
    }))
  );
}

main();
