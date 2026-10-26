import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

let mockPool = {
  id: "pool-123",
  draft_complete: false,
  tier: "free",
  pro_until: null,
};
let mockPlayerCount = 0;
let mockCurrentStatus = "pending";

vi.mock("@/lib/db", () => ({
  getDb: () => {
    const mockSql: any = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");
      if (query.includes("SELECT p.id, p.draft_complete, c.tier, c.pro_until")) {
        return Promise.resolve([mockPool]);
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
    
    // Add transaction support for free tier cap checks
    mockSql.begin = vi.fn(async (fn: (tx: any) => Promise<any>) => {
      const tx = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join("");
        
        if (query.includes("SELECT id FROM pools") && query.includes("FOR UPDATE")) {
          return Promise.resolve([{ id: mockPool.id }]);
        }
        if (query.includes("SELECT rsvp_status FROM players WHERE id")) {
          return Promise.resolve([{ rsvp_status: mockCurrentStatus }]);
        }
        if (query.includes("SELECT COUNT(*) as count FROM players")) {
          return Promise.resolve([{ count: mockPlayerCount }]);
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
      }) as any;
      
      return await fn(tx);
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
