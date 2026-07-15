/**
 * One-off: rename a Person and cascade to linked players (pool rosters copy
 * the name into players.name). Dry-run by default.
 *
 *   npx tsx scripts/fix-person-name.ts "Mile" "Mike"           # dry-run
 *   npx tsx scripts/fix-person-name.ts "Mile" "Mike" --apply   # write
 */
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const [from, to] = process.argv.slice(2).filter((a) => a !== "--apply");
  const apply = process.argv.includes("--apply");
  if (!from || !to) {
    console.error('Usage: npx tsx scripts/fix-person-name.ts "Old Name" "New Name" [--apply]');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL!);
  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY-RUN"}\n`);

  const people = await sql`
    SELECT pe.id, pe.name, pe.phone, pe.venmo_handle, pe.cashapp_handle, pe.paypal_handle,
           c.email AS chairman_email,
           (SELECT string_agg(g.name, ', ') FROM group_members gm JOIN groups g ON g.id = gm.group_id
            WHERE gm.person_id = pe.id) AS groups
    FROM people pe JOIN chairmen c ON c.id = pe.chairman_id
    WHERE pe.name = ${from}
  `;
  if (people.length === 0) {
    console.log(`No person named "${from}" found.`);
    return;
  }
  for (const p of people) {
    console.log(`Person ${p.id}`);
    console.log(`  name: ${p.name} -> ${to}`);
    console.log(`  chairman: ${p.chairman_email}  phone: ${p.phone ?? "-"}  groups: ${p.groups ?? "-"}`);
    const players = await sql`
      SELECT pl.id, pl.name, po.pool_name, po.slug
      FROM players pl JOIN pools po ON po.id = pl.pool_id
      WHERE pl.person_id = ${p.id}
    `;
    for (const pl of players) {
      console.log(`  linked player ${pl.id} "${pl.name}" in pool "${pl.pool_name}" (${pl.slug})`);
    }
    if (apply) {
      await sql`UPDATE people SET name = ${to} WHERE id = ${p.id}`;
      const updated = await sql`
        UPDATE players SET name = ${to} WHERE person_id = ${p.id} AND name = ${from} RETURNING id
      `;
      console.log(`  ✅ renamed person + ${updated.length} player row(s)`);
    }
  }
  if (!apply) console.log("\nDry-run only. Re-run with --apply to write.");
}

main().catch((e) => { console.error(e); process.exit(1); });
