import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  if (process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      event = getStripe().webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    event = JSON.parse(body) as Stripe.Event;
  }

  console.log("Stripe webhook event:", event.type);

  const sql = getDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const chairmanId = session.metadata?.chairmanId;
    const customerId = session.customer as string | null;

    console.log("Checkout completed — chairmanId:", chairmanId, "customerId:", customerId);

    if (chairmanId) {
      await sql`UPDATE chairmen SET tier = 'pro' WHERE id = ${chairmanId}`;
      console.log("Updated tier to pro via chairmanId:", chairmanId);
    } else if (customerId) {
      // Fallback: match by Stripe customer ID
      const result = await sql`UPDATE chairmen SET tier = 'pro' WHERE stripe_customer_id = ${customerId} RETURNING id, email`;
      console.log("Updated tier to pro via customerId:", customerId, "matched:", result.length);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    if (customerId) {
      await sql`UPDATE chairmen SET tier = 'free' WHERE stripe_customer_id = ${customerId}`;
      console.log("Downgraded to free via subscription deleted, customerId:", customerId);
    }
  }

  return NextResponse.json({ received: true });
}
