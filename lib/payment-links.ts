import type { PaymentHandle, PaymentMethod } from "@/lib/types";

export interface PaymentLinkOptions {
  /** Dollar amount, can include cents. Formatted to 2 decimal places in the URL. */
  amount: number;
  /** Optional human-readable note prefilled in the payment app where supported. */
  note?: string;
}

/** Strip a leading @ if present (Person handles are stored without @, but accept either). */
function cleanHandle(handle: string): string {
  // Tolerate both Twitter-style (@) and Cash App-style ($) sigils on input. The
  // builders re-add app-specific prefixes themselves (e.g. cash.app/$HANDLE), so
  // the stored handle should never carry one.
  return handle.trim().replace(/^[@$]+/, "");
}

export function buildVenmoLink(handle: string, opts: PaymentLinkOptions): string {
  const params = new URLSearchParams({
    txn: "pay",
    amount: opts.amount.toFixed(2),
  });
  if (opts.note) params.set("note", opts.note);
  return `https://venmo.com/${encodeURIComponent(cleanHandle(handle))}?${params.toString()}`;
}

export function buildCashappLink(handle: string, opts: PaymentLinkOptions): string {
  // Cash App's universal-link format: cash.app/$USERNAME/AMOUNT. The note isn't supported.
  return `https://cash.app/$${encodeURIComponent(cleanHandle(handle))}/${opts.amount.toFixed(2)}`;
}

export function buildPaypalLink(handle: string, opts: PaymentLinkOptions): string {
  // paypal.me/{handle}/{amount} prefills the amount and opens the PayPal app/web flow.
  // The note isn't supported in the URL.
  return `https://paypal.me/${encodeURIComponent(cleanHandle(handle))}/${opts.amount.toFixed(2)}`;
}

/** Build a payment-app deep link for the given method. */
export function buildPaymentLink(
  method: PaymentMethod,
  handle: string,
  opts: PaymentLinkOptions,
): string {
  switch (method) {
    case "venmo": return buildVenmoLink(handle, opts);
    case "cashapp": return buildCashappLink(handle, opts);
    case "paypal": return buildPaypalLink(handle, opts);
  }
}

/** Human-readable label per app. */
export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "venmo": return "Venmo";
    case "cashapp": return "Cash App";
    case "paypal": return "PayPal";
  }
}

/**
 * Pick the preferred handle for a Person. If they have a preferred method with a handle,
 * use that. Otherwise fall back to Venmo, then Cash App, then PayPal. Returns null if
 * none of the three has a handle on file.
 */
export function pickHandleForPerson(person: {
  venmoHandle: string | null;
  cashappHandle: string | null;
  paypalHandle: string | null;
  preferredMethod: PaymentMethod | null;
}): PaymentHandle | null {
  const order: PaymentMethod[] = person.preferredMethod
    ? [person.preferredMethod, "venmo", "cashapp", "paypal"]
    : ["venmo", "cashapp", "paypal"];
  for (const m of order) {
    const value =
      m === "venmo" ? person.venmoHandle
      : m === "cashapp" ? person.cashappHandle
      : person.paypalHandle;
    if (value) return { method: m, handle: value };
  }
  return null;
}
