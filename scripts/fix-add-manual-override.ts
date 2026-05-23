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

  // Idempotent: only add if missing
  const before = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tournament_golfers' AND column_name = 'manual_override'
  `;

  if (before.length > 0) {
    console.log("Column manual_override already exists — nothing to do.");
    return;
  }

  console.log("Adding column manual_override to tournament_golfers...");
  await sql`
    ALTER TABLE tournament_golfers
    ADD COLUMN manual_override BOOLEAN DEFAULT false
  `;

  // Sanity check
  const after = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'tournament_golfers' AND column_name = 'manual_override'
  `;
  console.table(after);

  // Confirm the cron's WHERE clause now works
  const test = await sql`
    SELECT COUNT(*)::int AS n FROM tournament_golfers
    WHERE (manual_override IS NULL OR manual_override = false)
  `;
  console.log("Cron WHERE clause now evaluates against", test[0].n, "rows.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
