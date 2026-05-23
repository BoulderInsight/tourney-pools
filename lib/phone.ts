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
 * RFC 5724 form `sms:phone1,phone2`. Plus signs are literals in the URL path so
 * they pass through untouched. iOS Messages will match this recipient set to an
 * existing group thread when one exists with those exact people, which is what
 * a chairman re-texting the same pool actually wants. We previously used the
 * iOS-specific `sms:/open?addresses=` form, but that always opens a fresh
 * composition rather than threading into the existing conversation.
 */
export function buildSmsLink(phones: (string | null | undefined)[]): string | null {
  const valid = phones.filter(
    (p): p is string => typeof p === "string" && p.startsWith("+") && p.length >= 8,
  );
  if (valid.length === 0) return null;
  return `sms:${valid.join(",")}`;
}
