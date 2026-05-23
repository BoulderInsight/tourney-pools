"use client";

import type { PaymentHandle } from "@/lib/types";
import { buildPaymentLink, paymentMethodLabel } from "@/lib/payment-links";

/**
 * Post-tournament tip jar that lives in the same slot as the sponsor ad on the
 * public pool page. Matches the sponsor banner's dark card so the swap between
 * "ad while live" and "tip jar after the win" reads as a single design language.
 *
 * Renders nothing if the chairman has no payment handle on file. The caller
 * decides whether to show this vs. the sponsor banner vs. nothing based on
 * tournament status and the 30-day archive cutoff.
 */
export function TipTheCommish({
  chairmanName,
  paymentInfo,
}: {
  chairmanName: string;
  paymentInfo: PaymentHandle;
}) {
  // 25 cents, prefilled. The note is ignored by Cash App and PayPal; Venmo shows it.
  const TIP_AMOUNT = 0.25;
  const url = buildPaymentLink(paymentInfo.method, paymentInfo.handle, {
    amount: TIP_AMOUNT,
    note: "Two bits for the commish",
  });
  const displayName = chairmanName || "the Commish";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Tip ${displayName} $0.25 via ${paymentMethodLabel(paymentInfo.method)}`}
      className="block rounded-xl overflow-hidden my-4 active:opacity-95 transition-opacity"
    >
      <div className="bg-gray-900 px-4 py-5 text-center">
        <div className="inline-block bg-tp-accent text-tp-primary text-base font-bold px-5 py-2.5 rounded-full">
          Tip the Commish
        </div>
        <p className="text-white/80 text-xs italic mt-3">
          ...you know, for the effort
        </p>
        <p className="text-white/50 text-[11px] mt-1">{displayName}</p>
        <p className="text-white/35 text-[10px] uppercase tracking-wider mt-3">
          Suggested amount: two bits &middot; via {paymentMethodLabel(paymentInfo.method)}
        </p>
      </div>
    </a>
  );
}
