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

  // If webhook secret is set, verify signature. Otherwise accept raw (for initial setup).
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      event = getStripe().webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    event = JSON.parse(body) as Stripe.Event;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const chairmanId = session.metadata?.chairmanId;

    if (chairmanId) {
      const sql = getDb();
      await sql`UPDATE chairmen SET tier = 'paid' WHERE id = ${chairmanId}`;
    }
  }

  return NextResponse.json({ received: true });
}
