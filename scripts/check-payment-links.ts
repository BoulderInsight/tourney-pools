// Run with: npx tsx scripts/check-payment-links.ts
import { buildPaymentLink, pickHandleForPerson } from "../lib/payment-links";

const cases = [
  { method: "venmo" as const, handle: "@whitlock", amount: 20, note: "Blue Rock Mafia payout" },
  { method: "venmo" as const, handle: "whitlock", amount: 12.5, note: "" },
  { method: "cashapp" as const, handle: "$jake", amount: 7.75, note: "ignored" },
  { method: "paypal" as const, handle: "samp", amount: 100, note: "ignored" },
];

for (const c of cases) {
  const url = buildPaymentLink(c.method, c.handle, { amount: c.amount, note: c.note });
  console.log(`${c.method.padEnd(8)} ${c.handle.padEnd(12)} $${c.amount}  ->  ${url}`);
}

const picked = pickHandleForPerson({
  venmoHandle: null,
  cashappHandle: "jake",
  paypalHandle: "jakep",
  preferredMethod: "paypal",
});
console.log("\nPicked (preferred=paypal):", picked);
