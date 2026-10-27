import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "./route";
import { NextRequest } from "next/server";

const mockSession = {
  chairmanId: "chairman-123",
  email: "test@example.com",
  name: "Test User",
};

let mockPool = {
  id: "pool-123",
  tier: "free",
  pro_until: null,
};

let mockCurrentPlayer = {
  id: "player-123",
  rsvp_status: "pending",
};

let mockPlayerCount = 0;
let mockPlayerExists = true;

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

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

      if (query.includes("SELECT p.id, c.tier, c.pro_until")) {
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
          const currentlyActive = mockCurrentPlayer.rsvp_status !== "declined";
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

describe("PATCH /api/pool/[slug]/players/[playerId]/rsvp - Legacy Over-8 Pools", () => {
  beforeEach(() => {
    mockPool = {
      id: "pool-123",
      tier: "free",
      pro_until: null,
    };
    mockCurrentPlayer = {
      id: "player-123",
      rsvp_status: "pending",
    };
    mockPlayerCount = 0;
    mockPlayerExists = true;
  });

  it("allows over-8 legacy pool to re-accept already accepted player", async () => {
    // Pool has 10 accepted players total, including this one
    mockPlayerCount = 10;
    mockCurrentPlayer.rsvp_status = "accepted";

    const req = new NextRequest(
      "http://localhost:3000/api/pool/test-slug/players/player-123/rsvp",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
      }
    );

    // Should succeed - not increasing count, cap is max(8, 10) = 10
    const response = await PATCH(req, { params: { slug: "test-slug", playerId: "player-123" } });
    expect(response.status).toBe(200);
  });

  it("allows over-8 legacy pool to accept pending player at cap", async () => {
    // Pool has 9 accepted + 1 pending (this player) = 10 total, 9 non-declined
    mockPlayerCount = 9;
    mockCurrentPlayer.rsvp_status = "pending";

    const req = new NextRequest(
      "http://localhost:3000/api/pool/test-slug/players/player-123/rsvp",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
      }
    );

    // Should succeed - pending still counts as non-declined, not increasing count
    const response = await PATCH(req, { params: { slug: "test-slug", playerId: "player-123" } });
    expect(response.status).toBe(200);
  });

  it("blocks over-8 legacy pool from accepting declined player at cap", async () => {
    // Pool has 10 accepted + 1 declined (this player) = 11 total, 10 non-declined
    mockPlayerCount = 10;
    mockCurrentPlayer.rsvp_status = "declined";

    const req = new NextRequest(
      "http://localhost:3000/api/pool/test-slug/players/player-123/rsvp",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
      }
    );

    // Should be blocked - would go from 10 to 11, cap is max(8, 10) = 10
    const response = await PATCH(req, { params: { slug: "test-slug", playerId: "player-123" } });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("Free pools hold up to 8 players");
  });

  it("returns 404 when the player does not belong to the pool", async () => {
    mockPlayerCount = 10;
    mockCurrentPlayer.rsvp_status = "declined";
    mockPlayerExists = false;

    const req = new NextRequest(
      "http://localhost:3000/api/pool/test-slug/players/player-123/rsvp",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
      }
    );

    const response = await PATCH(req, { params: { slug: "test-slug", playerId: "player-123" } });
    expect(response.status).toBe(404);
  });

  it("allows over-8 legacy pool to decline a player", async () => {
    // Pool has 10 accepted players
    mockPlayerCount = 10;
    mockCurrentPlayer.rsvp_status = "accepted";

    const req = new NextRequest(
      "http://localhost:3000/api/pool/test-slug/players/player-123/rsvp",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "declined" }),
      }
    );

    // Should succeed - declining is always allowed
    const response = await PATCH(req, { params: { slug: "test-slug", playerId: "player-123" } });
    expect(response.status).toBe(200);
  });
});
