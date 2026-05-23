import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  // a future tournament + the in-progress CJ CUP
  const ts = await sql`
    SELECT id, name, start_date FROM tournaments
    WHERE api_source='slashgolf'
    ORDER BY ABS(EXTRACT(EPOCH FROM (start_date - now()))) ASC LIMIT 3`;
  for (const t of ts) {
    const res = await fetch(`https://tourneypools.com/api/tournaments/${t.id}/field`);
    const data = await res.json();
    console.log(`${t.name}: apiBacked=${data.apiBacked} hasField=${data.hasField} golfers=${data.golfers?.length ?? 0}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
