// Run with: npx tsx scripts/check-payment-plan.ts
// Verifies the netted payout matches the user's hand-worked example.
import { computePaymentPlan } from "../lib/pool";
import type { PlayerStanding } from "../lib/types";

function p(id: string, name: string, rank: number, prize: number): PlayerStanding {
  return {
    player: { id, name },
    rank,
    totalScore: -rank,
    prize,
    golfers: [],
  };
}

// 6 players, $20 buy-in, 70-30 → Brack $84, Jef $36
const standings: PlayerStanding[] = [
  p("brack",     "Brack",    1, 84),
  p("jef",       "Jef",      2, 36),
  p("josh",      "Josh",     3, 0),
  p("ray",       "Ray",      4, 0),
  p("chig",      "Chig",     5, 0),
  p("whitlock",  "Whitlock", 6, 0),
];

const plan = computePaymentPlan(standings, 20);

const expected: Record<string, string> = {
  josh:     "Brack $20.00",
  ray:      "Brack $20.00",
  chig:     "Brack $20.00",
  whitlock: "Brack $4.00, Jef $16.00",
};

let ok = true;
for (const id of Object.keys(expected)) {
  const transfers = plan.get(id) ?? [];
  const got = transfers.map((t) => `${t.toPlayerName} $${t.amount.toFixed(2)}`).join(", ");
  const want = expected[id];
  const pass = got === want;
  if (!pass) ok = false;
  console.log(`${pass ? "OK " : "FAIL"}  ${id.padEnd(9)} → ${got}   (want: ${want})`);
}

console.log(ok ? "\nAll cases match." : "\nSome cases failed.");
process.exit(ok ? 0 : 1);
