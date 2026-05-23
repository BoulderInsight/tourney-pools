/**
 * Tier helpers. Centralizes the "is this chairman Pro right now?" check so
 * we don't sprinkle inline tier comparisons (which would miss the promo
 * window) across the codebase.
 *
 * A chairman is treated as Pro if EITHER:
 *   1. Their stored tier is 'pro' or the legacy 'paid' value, OR
 *   2. They have a pro_until timestamp set to a future time (active promo)
 *
 * When the promo expires, isProEffective() flips back to false automatically
 * since it compares against the current time on every call.
 */

export type RawTier = "free" | "pro" | "paid" | string | null | undefined;

/**
 * Does this chairman count as Pro right now? Pass either the JS Date the
 * promo expires at, an ISO string, or null/undefined if no promo is set.
 */
export function isProEffective(
  tier: RawTier,
  proUntil: Date | string | null | undefined,
): boolean {
  if (tier === "pro" || tier === "paid") return true;
  if (!proUntil) return false;
  const expires = typeof proUntil === "string" ? new Date(proUntil) : proUntil;
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() > Date.now();
}

/**
 * True only when isProEffective is true because of an active promo (not
 * because tier is permanently Pro). Useful for showing "Pro promo expires
 * in N days" badges that shouldn't appear for real Pro subscribers.
 */
export function isPromoActive(
  tier: RawTier,
  proUntil: Date | string | null | undefined,
): boolean {
  if (tier === "pro" || tier === "paid") return false;
  if (!proUntil) return false;
  const expires = typeof proUntil === "string" ? new Date(proUntil) : proUntil;
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() > Date.now();
}

/**
 * Human-readable expiry like "May 31" or "May 31, 2027" if it's a different
 * year. Returns empty string when there is no upcoming expiry.
 */
export function formatPromoExpiry(
  proUntil: Date | string | null | undefined,
): string {
  if (!proUntil) return "";
  const expires = typeof proUntil === "string" ? new Date(proUntil) : proUntil;
  if (Number.isNaN(expires.getTime())) return "";
  if (expires.getTime() <= Date.now()) return "";
  const now = new Date();
  return expires.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(expires.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
