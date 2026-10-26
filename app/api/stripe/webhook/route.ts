import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  if (!sig) {
    console.error("Missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("Stripe webhook event:", event.type, "id:", event.id);

  const sql = getDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const chairmanId = session.metadata?.chairmanId;
    const customerId = session.customer as string | null;
    const paymentStatus = session.payment_status;
    const mode = session.mode;

    const isPaid = paymentStatus === "paid";
    const isSubscription = mode === "subscription";

    if (chairmanId && (isPaid || isSubscription)) {
      await sql`UPDATE chairmen SET tier = 'pro' WHERE id = ${chairmanId}`;
      console.log("Updated tier to pro via checkout.session.completed, event:", event.id);
    } else if (customerId && (isPaid || isSubscription)) {
      const result = await sql`UPDATE chairmen SET tier = 'pro' WHERE stripe_customer_id = ${customerId} RETURNING id`;
      console.log("Updated tier to pro via customerId, event:", event.id, "matched:", result.length);
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const status = subscription.status;

    if (customerId) {
      if (status === "active" || status === "trialing" || status === "past_due") {
        await sql`UPDATE chairmen SET tier = 'pro' WHERE stripe_customer_id = ${customerId}`;
        console.log("Kept tier as pro (status:", status, "), event:", event.id);
      } else if (status === "unpaid" || status === "canceled" || status === "incomplete_expired") {
        await sql`UPDATE chairmen SET tier = 'free' WHERE stripe_customer_id = ${customerId}`;
        console.log("Downgraded to free (status:", status, "), event:", event.id);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    if (customerId) {
      await sql`UPDATE chairmen SET tier = 'free' WHERE stripe_customer_id = ${customerId}`;
      console.log("Downgraded to free via subscription.deleted, event:", event.id);
    }
  }

  return NextResponse.json({ received: true });
}
