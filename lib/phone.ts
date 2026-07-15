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

/** Keep only plausible E.164 strings; everything else is dropped silently. */
function validPhones(phones: (string | null | undefined)[]): string[] {
  return phones.filter(
    (p): p is string => typeof p === "string" && p.startsWith("+") && p.length >= 8,
  );
}

/**
 * `addresses=` value for the iOS `sms:/open?addresses=` form. Each number is
 * individually percent-encoded (so `+` doesn't decode to a space) but the
 * commas BETWEEN numbers must stay literal: iOS splits the recipient list on
 * raw commas before decoding, so an encoded `%2C` collapses the whole list
 * into one garbage recipient.
 */
function iosAddresses(valid: string[]): string {
  return valid.map(encodeURIComponent).join(",");
}

/**
 * Build an sms: URL that opens the native messaging app with the given recipients
 * pre-addressed. Returns null when no E.164 recipients were supplied so the caller
 * can hide the button rather than render a no-op link.
 *
 * Single recipient uses the RFC 5724 plain form `sms:+1...` so iOS threads into
 * the existing 1:1 conversation. Multiple recipients use `sms:/open?addresses=`,
 * the one form iOS reliably parses as a group; the plain comma form
 * (`sms:+1a,+1b`) looked nicer for thread-matching but iOS only honors the
 * first number (the 183fbe1 regression), so every group tap must pay the
 * fresh-composition cost.
 */
export function buildSmsLink(phones: (string | null | undefined)[]): string | null {
  const valid = validPhones(phones);
  if (valid.length === 0) return null;
  if (valid.length === 1) return `sms:${valid[0]}`;
  return `sms:/open?addresses=${iosAddresses(valid)}`;
}

/**
 * Multi-recipient SMS URL with a pre-filled body, for one-off broadcasts like
 * Invite to Pool / Resend Invites / dashboard Text Pool. Same
 * `sms:/open?addresses=` form as `buildSmsLink`; always opens a new composition.
 *
 * Returns null when no valid recipients were supplied.
 */
export function buildIosMultiRecipientSmsLink(
  phones: (string | null | undefined)[],
  body: string,
): string | null {
  const valid = validPhones(phones);
  if (valid.length === 0) return null;
  return `sms:/open?addresses=${iosAddresses(valid)}&body=${encodeURIComponent(body)}`;
}
