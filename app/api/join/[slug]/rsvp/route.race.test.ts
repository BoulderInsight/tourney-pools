import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

let mockPool = {
  id: "pool-123",
  draft_complete: false,
  tier: "free",
  pro_until: null,
};

// Track player statuses and counts
let mockPlayers = new Map<string, string>(); // playerId -> status
let transactionInProgress = false;
let transactionQueue: Array<() => void> = [];

vi.mock("@/lib/db", () => ({
  getDb: () => {
    // The real neon() HTTP driver has no .begin() -- only .transaction(),
    // which batches an array of already-constructed queries as one
    // non-interactive transaction. The lock and cap-gated update are
    // "lazy" descriptors that are only evaluated inside .transaction(),
    // which serializes concurrent calls the same way the real `FOR UPDATE`
    // lock on the pool row would.
    const mockSql: any = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");

      if (query.includes("SELECT p.id, p.draft_complete, c.tier, c.pro_until")) {
        return Promise.resolve([mockPool]);
      }

      if (query.includes("SELECT id FROM pools") && query.includes("FOR UPDATE")) {
        return { __lazy: "lock" };
      }

      if (query.includes("UPDATE players") && query.includes("rsvp_status <> 'declined'")) {
        return {
          __lazy: "cappedUpdate",
          playerId: values[1] as string,
          status: values[0] as string,
        };
      }

      if (query.includes("SELECT 1 FROM players WHERE id")) {
        const playerId = values[0] as string;
        return Promise.resolve(mockPlayers.has(playerId) ? [{ "?column?": 1 }] : []);
      }

      // Plain UPDATE for Pro pools (no cap check)
      if (query.includes("UPDATE players")) {
        const status = values[0] as string;
        const playerId = values[1] as string;
        mockPlayers.set(playerId, status);
        return Promise.resolve([
          {
            id: playerId,
            name: "Test Player",
            rsvp_status: status,
          },
        ]);
      }

      return Promise.resolve([]);
    });

    mockSql.transaction = vi.fn(async (queries: any[]) => {
      // Wait if another transaction is in progress (simulates the FOR
      // UPDATE lock serializing concurrent transactions on the pool row).
      if (transactionInProgress) {
        await new Promise<void>((resolve) => {
          transactionQueue.push(resolve);
        });
      }
      transactionInProgress = true;

      try {
        return queries.map((q) => {
          if (q && q.__lazy === "lock") {
            return [{ id: mockPool.id }];
          }
          if (q && q.__lazy === "cappedUpdate") {
            const currentStatus = mockPlayers.get(q.playerId) || "declined";
            const currentlyActive = currentStatus !== "declined";
            const activeCount = Array.from(mockPlayers.values()).filter(
              (s) => s !== "declined"
            ).length;
            if (!currentlyActive && activeCount >= 8) {
              return [];
            }
            mockPlayers.set(q.playerId, q.status);
            return [{ id: q.playerId, name: "Test Player", rsvp_status: q.status }];
          }
          return [];
        });
      } finally {
        transactionInProgress = false;
        // Release next transaction from queue
        const next = transactionQueue.shift();
        if (next) next();
      }
    });

    return mockSql;
  },
}));

describe("POST /api/join/[slug]/rsvp - Race Condition Prevention", () => {
  beforeEach(() => {
    mockPool = {
      id: "pool-123",
      draft_complete: false,
      tier: "free",
      pro_until: null,
    };
    mockPlayers.clear();
    transactionInProgress = false;
    transactionQueue = [];

    // Start with 7 accepted players
    for (let i = 1; i <= 7; i++) {
      mockPlayers.set(`player-${i}`, "accepted");
    }
    // Add 2 declined players who will try to accept concurrently
    mockPlayers.set("player-8", "declined");
    mockPlayers.set("player-9", "declined");
  });

  it("prevents race condition: only one of two concurrent accepts succeeds at cap", async () => {
    // Pool has 7 accepted players
    // Two declined players try to accept simultaneously
    // Only one should succeed (bringing total to 8)

    const request1 = POST(
      new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
        method: "POST",
        body: JSON.stringify({ playerId: "player-8", status: "accepted" }),
      }),
      { params: { slug: "test-slug" } }
    );

    const request2 = POST(
      new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
        method: "POST",
        body: JSON.stringify({ playerId: "player-9", status: "accepted" }),
      }),
      { params: { slug: "test-slug" } }
    );

    // Execute both requests concurrently
    const [response1, response2] = await Promise.all([request1, request2]);

    // One should succeed (200), one should fail (403)
    const statuses = [response1.status, response2.status].sort();
    expect(statuses).toEqual([200, 403]);

    // Verify final state: exactly 8 non-declined players
    const finalCount = Array.from(mockPlayers.values()).filter(s => s !== "declined").length;
    expect(finalCount).toBe(8);

    // Verify one succeeded, one stayed declined
    const successCount = [
      mockPlayers.get("player-8") === "accepted" ? 1 : 0,
      mockPlayers.get("player-9") === "accepted" ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    expect(successCount).toBe(1);
  });

  it("allows concurrent accepts when pool is Pro", async () => {
    mockPool.tier = "pro";

    const request1 = POST(
      new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
        method: "POST",
        body: JSON.stringify({ playerId: "player-8", status: "accepted" }),
      }),
      { params: { slug: "test-slug" } }
    );

    const request2 = POST(
      new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
        method: "POST",
        body: JSON.stringify({ playerId: "player-9", status: "accepted" }),
      }),
      { params: { slug: "test-slug" } }
    );

    const [response1, response2] = await Promise.all([request1, request2]);

    // Both should succeed for Pro pool
    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    // Verify final state: 9 non-declined players
    const finalCount = Array.from(mockPlayers.values()).filter(s => s !== "declined").length;
    expect(finalCount).toBe(9);
  });
});
