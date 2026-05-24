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
 *
 * Caveat: with several recipients followed by `?body=`, some iOS versions only
 * honor the first phone and swallow the rest into the body text. If reliable
 * multi-recipient addressing matters more than thread-matching (e.g. the one-off
 * Invite/Resend flow where the chairman is texting people they may have never
 * grouped with), use `buildIosMultiRecipientSmsLink` instead.
 */
export function buildSmsLink(phones: (string | null | undefined)[]): string | null {
  const valid = phones.filter(
    (p): p is string => typeof p === "string" && p.startsWith("+") && p.length >= 8,
  );
  if (valid.length === 0) return null;
  return `sms:${valid.join(",")}`;
}

/**
 * Build a multi-recipient SMS URL using the iOS-friendly `&addresses=` form
 * with a pre-filled body. Always opens a NEW composition (no thread matching),
 * but reliably addresses every recipient even when the body param is set.
 *
 * Use this for one-off broadcasts like Invite to Pool / Resend Invites where
 * thread matching isn't useful (these aren't a recurring group thread yet). For
 * the Text the Pool feature on the leaderboard, keep `buildSmsLink` so we at
 * least try to match the chairman's existing ad-hoc thread when one exists.
 *
 * Returns null when no valid recipients were supplied.
 */
export function buildIosMultiRecipientSmsLink(
  phones: (string | null | undefined)[],
  body: string,
): string | null {
  const valid = phones.filter(
    (p): p is string => typeof p === "string" && p.startsWith("+") && p.length >= 8,
  );
  if (valid.length === 0) return null;
  // iOS Messages parses both `sms:/open?addresses=` and `sms:&addresses=` but
  // the latter is more widely supported across versions and works in Mobile
  // Safari without the `/open` host segment. The body param uses `&body=` for
  // the same reason. Recipients stay comma-joined; the addresses param is
  // multi-value and iOS splits on commas internally.
  const addrs = encodeURIComponent(valid.join(","));
  const encodedBody = encodeURIComponent(body);
  return `sms:&addresses=${addrs}&body=${encodedBody}`;
}
