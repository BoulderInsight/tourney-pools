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

  // Check for duplicate event delivery (idempotency)
  try {
    const existingEvent = await sql`
      SELECT id FROM stripe_webhook_events 
      WHERE event_id = ${event.id}
    `;
    if (existingEvent.length > 0) {
      console.log("Duplicate event received, skipping:", event.id);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Record event before processing
    await sql`
      INSERT INTO stripe_webhook_events (event_id, event_type, received_at)
      VALUES (${event.id}, ${event.type}, now())
    `;
  } catch (err) {
    // If table doesn't exist yet (migration not run), log and continue
    // This allows the webhook to work during transition period
    console.error("Idempotency check failed (table may not exist):", err);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const chairmanId = session.metadata?.chairmanId;
    const customerId = session.customer as string | null;
    const paymentStatus = session.payment_status;

    if (paymentStatus === "paid") {
      if (chairmanId) {
        await sql`UPDATE chairmen SET tier = 'pro' WHERE id = ${chairmanId}`;
        console.log("Updated tier to pro via checkout.session.completed (paid), event:", event.id);
      } else if (customerId) {
        const result = await sql`UPDATE chairmen SET tier = 'pro' WHERE stripe_customer_id = ${customerId} RETURNING id`;
        console.log("Updated tier to pro via customerId (paid), event:", event.id, "matched:", result.length);
      }
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;
    
    if (customerId) {
      const result = await sql`
        UPDATE chairmen 
        SET tier = 'pro' 
        WHERE stripe_customer_id = ${customerId}
        RETURNING id
      `;
      if (result.length > 0) {
        console.log("Updated tier to pro via invoice.paid, event:", event.id);
      } else {
        console.log("No chairman found for customer:", customerId, "event:", event.id);
      }
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
      } else if (status === "incomplete" || status === "unpaid" || status === "canceled" || status === "incomplete_expired") {
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
