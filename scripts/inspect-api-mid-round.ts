import { readFileSync } from "fs";
import { fetchLeaderboard } from "../lib/golf-api";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const lb = await fetchLeaderboard("033", 2026);
  console.log("Tournament status:", lb.status, "round:", lb.roundId);

  // Show raw fields for: a finished-R1 player, an active mid-round player, and a not-yet-teed-off player
  const samples = lb.golfers.slice(0, 30).map((g) => ({
    name: `${g.firstName} ${g.lastName}`,
    status: g.status,
    total: g.total,
    pos: g.position,
    thru: g.thru,
    currentRound: g.currentRound,
    r1: g.rounds.find((r) => r.roundId === 1)?.scoreToPar ?? "",
    r2: g.rounds.find((r) => r.roundId === 2)?.scoreToPar ?? "",
  }));
  console.table(samples);
}

main();
