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

  // Pick one chairman who has multiple pools across statuses for a realistic shape
  const chairmen = await sql`
    SELECT chairman_id, COUNT(*) AS n
    FROM pools
    GROUP BY chairman_id
    ORDER BY n DESC
    LIMIT 3
  `;
  console.log("Top chairmen by pool count:", chairmen);

  if (chairmen.length === 0) return;

  const chairmanId = chairmen[0].chairman_id;

  const pools = await sql`
    SELECT p.id, p.slug, p.pool_name, p.buy_in, p.setup_complete, p.created_at,
           t.status AS tournament_status, t.name AS tournament_name,
           (SELECT COUNT(*) FROM players WHERE pool_id = p.id) as player_count
    FROM pools p
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.chairman_id = ${chairmanId}
    ORDER BY
      CASE WHEN t.status IN ('completed', 'cancelled') THEN 1 ELSE 0 END,
      p.created_at DESC
  `;

  console.log(`\nPools for chairman ${chairmanId} (active-first ordering):`);
  console.table(
    pools.map((p) => ({
      pool_name: p.pool_name,
      tournament: p.tournament_name,
      status: p.tournament_status,
      created: p.created_at?.toISOString().split("T")[0],
    }))
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
