/**
 * Verify the sms: URL builders produce forms iOS actually parses as
 * multi-recipient. Run: npx tsx scripts/verify-sms-links.ts
 *
 * Background (PR #23 → 183fbe1 → this fix): iOS Messages only reliably
 * addresses multiple recipients via the `sms:/open?addresses=a,b` form with
 * LITERAL commas between numbers. The plain RFC 5724 `sms:a,b` form opens a
 * compose with only the first number, and percent-encoding the commas
 * (`%2C`) stops iOS from splitting the list at all.
 */
import { buildSmsLink, buildIosMultiRecipientSmsLink } from "../lib/phone";

let failures = 0;
function check(label: string, actual: string | null, expected: string | null) {
  const ok = actual === expected;
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) {
    console.log(`   expected: ${expected}`);
    console.log(`   actual:   ${actual}`);
    failures++;
  }
}

const A = "+19195551234";
const B = "+13035556789";
const C = "+17205550000";

// Single recipient keeps the plain form so iOS threads into the existing 1:1.
check("buildSmsLink single recipient", buildSmsLink([A]), `sms:${A}`);

// Multi recipient must use /open?addresses= with literal commas; each number
// individually encoded so the query parser doesn't turn + into a space.
check(
  "buildSmsLink multi recipient",
  buildSmsLink([A, B, C]),
  "sms:/open?addresses=%2B19195551234,%2B13035556789,%2B17205550000",
);

check("buildSmsLink skips invalid entries", buildSmsLink([null, "", A, "911"]), `sms:${A}`);
check("buildSmsLink empty", buildSmsLink([null, undefined, ""]), null);

// Invite/broadcast form: same addresses rule, plus encoded body.
check(
  "buildIosMultiRecipientSmsLink literal commas + body",
  buildIosMultiRecipientSmsLink([A, B], "Join The Pool! https://tourneypools.com/join/x"),
  "sms:/open?addresses=%2B19195551234,%2B13035556789&body=Join%20The%20Pool!%20https%3A%2F%2Ftourneypools.com%2Fjoin%2Fx",
);
check("buildIosMultiRecipientSmsLink empty", buildIosMultiRecipientSmsLink([], "hi"), null);

// Regression guards: the two known-bad shapes must never come back.
const multi = buildSmsLink([A, B]) ?? "";
if (/^sms:\+[^/?]+,/.test(multi)) {
  console.log("❌ buildSmsLink regressed to plain comma form (iOS drops all but first recipient)");
  failures++;
}
const invite = buildIosMultiRecipientSmsLink([A, B], "hi") ?? "";
if (invite.includes("%2C")) {
  console.log("❌ buildIosMultiRecipientSmsLink percent-encodes commas (iOS won't split recipients)");
  failures++;
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
