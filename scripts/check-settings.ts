import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const CJ = "dc28c4ec-6d99-41e8-867d-a17bb2c3f030";
  const pools = await sql`SELECT slug, pool_name, settings, draft_complete, setup_complete FROM pools WHERE tournament_id = ${CJ}`;
  for (const p of pools) {
    const s = p.settings as Record<string, unknown>;
    console.log(`${p.pool_name} (${p.slug}): draftType=${s.draftType}, scoringType=${s.scoringType}, bestN=${s.bestN}, draft_complete=${p.draft_complete}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
