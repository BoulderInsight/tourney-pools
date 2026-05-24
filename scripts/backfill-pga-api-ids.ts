import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { fetchLeaderboard } from "../lib/golf-api";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PGA_TOURNAMENT_ID = "93ec852a-b362-458c-963c-5b7ee2885978";
const PGA_API_ID = "033";
const PGA_YEAR = 2026;

function normalize(name: string): string {
  const decomposed = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return decomposed.replace(/ø/gi, "o").toLowerCase().replace(/[^a-z]/g, "");
}

function lastNameKey(name: string): string {
  const parts = name.trim().split(/\s+/);
  return normalize(parts[parts.length - 1]);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const sql = neon(process.env.DATABASE_URL!);

  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY-RUN"}\n`);

  // 1. Load current PGA tournament_golfers rows
  const dbRows = (await sql`
    SELECT id, name, odds_api_id
    FROM tournament_golfers
    WHERE tournament_id = ${PGA_TOURNAMENT_ID}
    ORDER BY name
  `) as { id: string; name: string; odds_api_id: string | null }[];
  console.log(`Local PGA tournament_golfers: ${dbRows.length}`);

  // 2. Fetch slashgolf leaderboard
  const lb = await fetchLeaderboard(PGA_API_ID, PGA_YEAR);
  console.log(`Slashgolf leaderboard golfers: ${lb.golfers.length}`);
  console.log(`Tournament API status: ${lb.status}\n`);

  // 3. Build fast lookup maps from API field
  const byFull = new Map<string, typeof lb.golfers[number]>();
  const byLast = new Map<string, typeof lb.golfers[number][]>();
  for (const g of lb.golfers) {
    const full = normalize(`${g.firstName}${g.lastName}`);
    byFull.set(full, g);
    const last = normalize(g.lastName);
    if (!byLast.has(last)) byLast.set(last, []);
    byLast.get(last)!.push(g);
  }

  // 4. Match each DB row
  type MatchRow = {
    db_id: string;
    db_name: string;
    existing_api_id: string | null;
    matched_api_id: string | null;
    matched_api_name: string | null;
    confidence: "exact" | "lastname" | "ambiguous" | "none";
  };
  const matches: MatchRow[] = [];

  for (const row of dbRows) {
    const full = normalize(row.name);
    const last = lastNameKey(row.name);

    let match: typeof lb.golfers[number] | undefined;
    let confidence: MatchRow["confidence"] = "none";

    if (byFull.has(full)) {
      match = byFull.get(full);
      confidence = "exact";
    } else if (byLast.has(last)) {
      // Require first-initial agreement to avoid e.g. "Zach Johnson" → "Dustin Johnson"
      const dbFirstInitial = normalize(row.name.trim().split(/\s+/)[0])[0];
      const candidates = byLast.get(last)!.filter(
        (c) => normalize(c.firstName)[0] === dbFirstInitial
      );
      if (candidates.length === 1) {
        match = candidates[0];
        confidence = "lastname";
      } else if (candidates.length > 1) {
        confidence = "ambiguous";
      }
    }

    matches.push({
      db_id: row.id,
      db_name: row.name,
      existing_api_id: row.odds_api_id,
      matched_api_id: match?.playerId ?? null,
      matched_api_name: match ? `${match.firstName} ${match.lastName}` : null,
      confidence,
    });
  }

  // 5. Report
  const exact = matches.filter((m) => m.confidence === "exact").length;
  const lastname = matches.filter((m) => m.confidence === "lastname").length;
  const ambiguous = matches.filter((m) => m.confidence === "ambiguous");
  const none = matches.filter((m) => m.confidence === "none");

  console.log(`Match summary: exact=${exact}  lastname-only=${lastname}  ambiguous=${ambiguous.length}  none=${none.length}\n`);

  if (lastname > 0) {
    console.log("Last-name matches (review these):");
    console.table(
      matches
        .filter((m) => m.confidence === "lastname")
        .map((m) => ({ db_name: m.db_name, api_name: m.matched_api_name, api_id: m.matched_api_id }))
    );
  }

  if (ambiguous.length > 0) {
    console.log("\nAMBIGUOUS, multiple API candidates share last name (no auto-match):");
    console.table(ambiguous.map((m) => ({ db_name: m.db_name })));
  }

  if (none.length > 0) {
    console.log("\nUNMATCHED, no API row found (will be left with NULL odds_api_id):");
    console.table(none.map((m) => ({ db_name: m.db_name })));
  }

  // 6. Apply (if --apply)
  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write updates.");
    return;
  }

  let written = 0;
  for (const m of matches) {
    if (!m.matched_api_id) continue;
    if (m.existing_api_id === m.matched_api_id) continue;
    await sql`
      UPDATE tournament_golfers
      SET odds_api_id = ${m.matched_api_id}, updated_at = now()
      WHERE id = ${m.db_id}
    `;
    written++;
  }
  console.log(`\nWrote ${written} odds_api_id values.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
