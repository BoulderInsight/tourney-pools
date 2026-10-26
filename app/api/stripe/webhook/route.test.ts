import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import Stripe from "stripe";

vi.mock("@/lib/db", () => ({
  getDb: () => {
    const mockSql = vi.fn();
    return mockSql;
  },
}));

describe("Stripe Webhook Route", () => {
  const originalEnv = process.env.STRIPE_WEBHOOK_SECRET;
  const testSecret = "whsec_test123456789012345678901234";

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STRIPE_WEBHOOK_SECRET = originalEnv;
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe("Webhook not configured");
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;

    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Missing signature");
  });

  it("returns 400 when signature is invalid", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;

    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "invalid_signature",
      },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid signature");
  });
});
