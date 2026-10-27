import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

let mockDbResults: { [key: string]: any[] } = {};
let mockUpdateCalls: Array<{ query: string; tier: string }> = [];
const mockExistingEvents = new Set<string>();
let mockUpdateResult: Promise<any> = Promise.resolve([{ id: "chairman-123" }]);

vi.mock("@/lib/db", () => ({
  getDb: () => {
    const mockSql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");
      
      // Idempotency check
      if (query.includes("SELECT id FROM stripe_webhook_events")) {
        const eventId = values[0] as string;
        return Promise.resolve(
          mockExistingEvents.has(eventId) ? [{ id: "1" }] : []
        );
      }
      
      // Insert event record (after processing)
      if (query.includes("INSERT INTO stripe_webhook_events")) {
        const eventId = values[0] as string;
        mockExistingEvents.add(eventId);
        return Promise.resolve([]);
      }
      
      // Track tier updates
      if (query.includes("UPDATE chairmen") && query.includes("tier")) {
        // Find tier value in the query or values
        let tier: string | undefined;
        if (query.includes("tier = 'pro'")) tier = "pro";
        else if (query.includes("tier = 'free'")) tier = "free";
        else {
          // Look in values array
          tier = values.find((v) => v === "pro" || v === "free") as string;
        }
        
        if (tier) {
          mockUpdateCalls.push({ query, tier });
        }
        return mockUpdateResult;
      }
      
      return Promise.resolve([{ id: "chairman-123" }]);
    }) as any;
    return mockSql;
  },
}));

const mockExistingEventsLegacy = new Set<string>();

vi.mock("stripe", () => {
  const Stripe = vi.fn();
  Stripe.prototype.webhooks = {
    constructEvent: vi.fn((body: string, sig: string) => {
      const event = JSON.parse(body);
      if (event.id === "evt_invalid_signature" || sig === "invalid") {
        throw new Error("Invalid signature");
      }
      return event;
    }),
  };
  return { default: Stripe };
});

describe("Stripe Webhook Route - Real Tests", () => {
  const originalEnv = {
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };

  beforeEach(() => {
    mockDbResults = {};
    mockUpdateCalls = [];
    mockExistingEvents.clear();
    mockUpdateResult = Promise.resolve([{ id: "chairman-123" }]);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalEnv.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = originalEnv.STRIPE_SECRET_KEY;
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(503);
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when signature is invalid", async () => {
    const mockEvent = {
      id: "evt_invalid_signature",
      type: "checkout.session.completed",
    };

    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(400);
  });

  it("does NOT grant Pro when payment_status is unpaid", async () => {
    const mockEvent = {
      id: "evt_unpaid",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { chairmanId: "chairman-123" },
          customer: null,
          payment_status: "unpaid",
        },
      },
    };

    mockUpdateCalls = [];
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateCalls.length).toBe(0);
  });

  it("grants Pro when checkout.session.completed has payment_status paid", async () => {
    const mockEvent = {
      id: "evt_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { chairmanId: "chairman-456" },
          customer: null,
          payment_status: "paid",
        },
      },
    };

    mockUpdateCalls = [];
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateCalls.length).toBeGreaterThan(0);
    expect(mockUpdateCalls[0].tier).toBe("pro");
  });

  it("grants Pro on invoice.paid by stripe_customer_id lookup", async () => {
    const mockEvent = {
      id: "evt_invoice_paid",
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_abc123",
        },
      },
    };

    mockUpdateCalls = [];
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateCalls.length).toBeGreaterThan(0);
    expect(mockUpdateCalls[0].tier).toBe("pro");
  });

  it("keeps Pro for subscription status: active", async () => {
    const mockEvent = {
      id: "evt_sub_active",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_active",
          status: "active",
        },
      },
    };

    mockUpdateCalls = [];
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateCalls.length).toBeGreaterThan(0);
    expect(mockUpdateCalls[0].tier).toBe("pro");
  });

  it("downgrades to Free for subscription status: canceled", async () => {
    const mockEvent = {
      id: "evt_sub_canceled",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_canceled",
          status: "canceled",
        },
      },
    };

    mockUpdateCalls = [];
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateCalls.length).toBeGreaterThan(0);
    expect(mockUpdateCalls[0].tier).toBe("free");
  });

  it("downgrades to Free for subscription status: unpaid", async () => {
    const mockEvent = {
      id: "evt_sub_unpaid",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_unpaid",
          status: "unpaid",
        },
      },
    };

    mockUpdateCalls = [];
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateCalls.length).toBeGreaterThan(0);
    expect(mockUpdateCalls[0].tier).toBe("free");
  });

  it("downgrades to Free on subscription.deleted", async () => {
    const mockEvent = {
      id: "evt_sub_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_deleted",
        },
      },
    };

    mockUpdateCalls = [];
    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateCalls.length).toBeGreaterThan(0);
    expect(mockUpdateCalls[0].tier).toBe("free");
  });

  it("skips duplicate events", async () => {
    mockExistingEvents.add("evt_duplicate");

    const mockEvent = {
      id: "evt_duplicate",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { chairmanId: "chairman-789" },
          customer: null,
          payment_status: "paid",
        },
      },
    };

    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid-signature" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.duplicate).toBe(true);
  });

  it("records new events and processes them", async () => {
    const mockEvent = {
      id: "evt_new_event",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { chairmanId: "chairman-789" },
          customer: null,
          payment_status: "paid",
        },
      },
    };

    const response = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid-signature" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.received).toBe(true);
    expect(data.duplicate).toBeUndefined();
  });

  it("allows retry when processing fails mid-way", async () => {
    // First attempt: processing fails after idempotency check but before recording
    mockUpdateResult = Promise.reject(new Error("Database connection lost"));
    
    const mockEvent = {
      id: "evt_retry_test",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { chairmanId: "chairman-retry" },
          customer: null,
          payment_status: "paid",
        },
      },
    };

    try {
      await POST(
        new NextRequest("http://localhost/api/stripe/webhook", {
          method: "POST",
          headers: { "stripe-signature": "valid-signature" },
          body: JSON.stringify(mockEvent),
        })
      );
      // Should throw
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }

    // Event should NOT be in idempotency table yet (never recorded because processing failed)
    expect(mockExistingEvents.has("evt_retry_test")).toBe(false);

    // Second attempt: Stripe retries, processing succeeds
    mockUpdateResult = Promise.resolve([{ id: "chairman-retry" }]);
    
    const retryResponse = await POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid-signature" },
        body: JSON.stringify(mockEvent),
      })
    );

    expect(retryResponse.status).toBe(200);
    const data = await retryResponse.json();
    expect(data.received).toBe(true);
    expect(data.duplicate).toBeUndefined(); // NOT a duplicate, retry was processed
    
    // Now event IS in idempotency table (recorded after successful processing)
    expect(mockExistingEvents.has("evt_retry_test")).toBe(true);
  });
});
