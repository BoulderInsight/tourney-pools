import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  // Check if already paid
  const rows = await sql`SELECT tier, stripe_customer_id FROM chairmen WHERE id = ${session.chairmanId}`;
  if (rows[0]?.tier === "paid") {
    return NextResponse.json({ error: "Already premium" }, { status: 400 });
  }

  // Get or create Stripe customer
  let customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      name: session.name,
      metadata: { chairmanId: session.chairmanId },
    });
    customerId = customer.id;
    await sql`UPDATE chairmen SET stripe_customer_id = ${customerId} WHERE id = ${session.chairmanId}`;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
    metadata: {
      chairmanId: session.chairmanId,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
