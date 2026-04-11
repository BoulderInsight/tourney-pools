import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = body.plan === "annual" ? "annual" : "monthly";

  const priceId = plan === "annual"
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID;

  // Fallback to legacy one-time price if subscription prices aren't configured yet
  const finalPriceId = priceId || process.env.STRIPE_PRICE_ID;
  const isSubscription = !!priceId;

  if (!finalPriceId) {
    return NextResponse.json({ error: "Stripe price not configured" }, { status: 500 });
  }

  try {
    const sql = getDb();

    const rows = await sql`SELECT tier, stripe_customer_id FROM chairmen WHERE id = ${session.chairmanId}`;
    if (rows[0]?.tier === "pro" || rows[0]?.tier === "paid") {
      return NextResponse.json({ error: "Already on Pro" }, { status: 400 });
    }

    // Get or create Stripe customer
    let customerId = rows[0]?.stripe_customer_id;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: session.email,
        name: session.name,
        metadata: { chairmanId: session.chairmanId },
      });
      customerId = customer.id;
      await sql`UPDATE chairmen SET stripe_customer_id = ${customerId} WHERE id = ${session.chairmanId}`;
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: finalPriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?upgraded=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
      metadata: { chairmanId: session.chairmanId },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
