import { readFileSync } from "fs";
import { fetchLeaderboard, extractRoundScores } from "../lib/golf-api";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const lb = await fetchLeaderboard("033", 2026);
  const rows = lb.golfers.slice(0, 30).map((g) => {
    const { r1, r2, r3, r4 } = extractRoundScores(g);
    return {
      name: `${g.firstName} ${g.lastName}`,
      status: g.status,
      total: g.total,
      thru: g.thru,
      r1: r1, r2: r2, r3: r3, r4: r4,
    };
  });
  console.table(rows);
}

main();
