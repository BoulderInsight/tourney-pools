import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE pools ADD COLUMN IF NOT EXISTS awaiting_field BOOLEAN NOT NULL DEFAULT false`;
  const col = await sql`
    SELECT column_name, data_type, column_default FROM information_schema.columns
    WHERE table_name = 'pools' AND column_name = 'awaiting_field'`;
  console.log("awaiting_field column:", col[0] || "NOT FOUND");
}
main().catch((e) => { console.error(e); process.exit(1); });
