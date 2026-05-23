/**
 * Phone helpers for the chairman-only "Text the Pool" feature. US-only in v1; the
 * storage column is E.164 so adding international parsing later is additive.
 */

/**
 * Normalize a US phone input to E.164 (+1XXXXXXXXXX). Accepts anything a human
 * might type: "(919) 555-1234", "919-555-1234", "919.555.1234", "9195551234",
 * "+1 919 555 1234". Returns null when the input can't be coerced (wrong digit
 * count after stripping, leading-1 ambiguity, etc.) so callers can surface a
 * "please re-enter" hint.
 */
export function normalizeUsPhoneE164(input: string): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * Friendly US display from an E.164 number. Returns the input unchanged when it
 * doesn't look like a US E.164 string, so the chairman sees something rather than
 * nothing if a value somehow escaped normalization.
 */
export function formatUsPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  if (!e164.startsWith("+1") || e164.length !== 12) return e164;
  const d = e164.slice(2);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Build an sms: URL that opens the native messaging app with the given recipients
 * pre-addressed. Returns null when no E.164 recipients were supplied so the caller
 * can hide the button rather than render a no-op link.
 *
 * Format choice: for a single recipient we use the RFC 5724 form `sms:+1...`. For
 * multiple, we use the iOS-friendly `sms:/open?addresses=...` variant, which is the
 * one form that reliably opens a fresh group MMS composition on iOS instead of
 * joining an existing thread with whichever number it parses first. Android's
 * native SMS apps treat the path as opaque and tend to honor the comma list too.
 *
 * The leading `+` of each E.164 number is URL-encoded as `%2B` so the query parser
 * doesn't turn it into a space.
 */
export function buildSmsLink(phones: (string | null | undefined)[]): string | null {
  const valid = phones.filter(
    (p): p is string => typeof p === "string" && p.startsWith("+") && p.length >= 8,
  );
  if (valid.length === 0) return null;
  if (valid.length === 1) return `sms:${valid[0]}`;
  const encoded = valid.map(encodeURIComponent).join(",");
  return `sms:/open?addresses=${encoded}`;
}
