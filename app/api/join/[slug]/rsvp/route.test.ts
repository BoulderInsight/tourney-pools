import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

let mockPool: {
  id: string;
  draft_complete: boolean;
  tier: string;
  pro_until: string | null;
} = {
  id: "pool-123",
  draft_complete: false,
  tier: "free",
  pro_until: null,
};
let mockPlayerCount = 0;
let mockCurrentStatus = "pending";
let mockPlayerExists = true;

vi.mock("@/lib/db", () => ({
  getDb: () => {
    // The real neon() HTTP driver has no .begin() -- only .transaction(),
    // which takes an array of already-constructed queries and batches them
    // as one non-interactive transaction. We model that split here: the
    // lock and cap-gated update are "lazy" descriptors that only resolve
    // once handed to .transaction(); everything else resolves immediately,
    // same as a plain (non-transactional) query.
    const mockSql: any = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");

      if (query.includes("SELECT p.id, p.draft_complete, c.tier, c.pro_until")) {
        return Promise.resolve([mockPool]);
      }

      if (query.includes("SELECT id FROM pools") && query.includes("FOR UPDATE")) {
        return { __lazy: "lock" };
      }

      if (query.includes("UPDATE players") && query.includes("rsvp_status <> 'declined'")) {
        return { __lazy: "cappedUpdate" };
      }

      if (query.includes("SELECT 1 FROM players WHERE id")) {
        return Promise.resolve(mockPlayerExists ? [{ "?column?": 1 }] : []);
      }

      if (query.includes("UPDATE players")) {
        return Promise.resolve([
          {
            id: "player-123",
            name: "Test Player",
            rsvp_status: "accepted",
          },
        ]);
      }

      return Promise.resolve([]);
    });

    mockSql.transaction = vi.fn(async (queries: any[]) => {
      return queries.map((q) => {
        if (q && q.__lazy === "lock") {
          return [{ id: mockPool.id }];
        }
        if (q && q.__lazy === "cappedUpdate") {
          if (!mockPlayerExists) {
            return [];
          }
          const currentlyActive = mockCurrentStatus !== "declined";
          const underCap = mockPlayerCount < 8;
          if (!currentlyActive && !underCap) {
            return [];
          }
          return [{ id: "player-123", name: "Test Player", rsvp_status: "accepted" }];
        }
        return [];
      });
    });

    return mockSql;
  },
}));

describe("POST /api/join/[slug]/rsvp - RSVP Edge Cases", () => {
  beforeEach(() => {
    mockPool = {
      id: "pool-123",
      draft_complete: false,
      tier: "free",
      pro_until: null,
    };
    mockPlayerCount = 0;
    mockCurrentStatus = "pending";
    mockPlayerExists = true;
  });

  it("allows player to accept at 7 non-declined players", async () => {
    // Pool has 7 total non-declined players (including this declined player makes no difference)
    mockPlayerCount = 7;
    mockCurrentStatus = "declined";

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });

  it("blocks player from accepting at 8 non-declined players", async () => {
    // Pool has 8 total non-declined players already, this player is declined
    mockPlayerCount = 8;
    mockCurrentStatus = "declined";

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("Free pools hold up to 8 players");
  });

  it("allows already-active player to re-accept at 8 active players", async () => {
    // Player is already pending (counted as active); re-accepting should
    // not be blocked by the cap even though the pool is already at 8.
    mockPlayerCount = 8;
    mockCurrentStatus = "pending";

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });

  it("returns 404 when the player does not belong to the pool", async () => {
    mockPlayerCount = 5;
    mockCurrentStatus = "declined";
    mockPlayerExists = false;

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(404);
  });

  it("allows player to decline regardless of count", async () => {
    mockPlayerCount = 10;
    mockCurrentStatus = "accepted";

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "declined" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });
});

describe("POST /api/join/[slug]/rsvp - Promo Expiry", () => {
  beforeEach(() => {
    mockPlayerExists = true;
  });

  it("enforces cap with expired promo", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockPool = {
      id: "pool-123",
      draft_complete: false,
      tier: "free",
      pro_until: pastDate.toISOString(),
    };
    mockPlayerCount = 8;
    mockCurrentStatus = "declined";

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(403);
  });

  it("allows with active promo", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockPool = {
      id: "pool-123",
      draft_complete: false,
      tier: "free",
      pro_until: futureDate.toISOString(),
    };
    mockPlayerCount = 8;
    mockCurrentStatus = "declined";

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });
});
