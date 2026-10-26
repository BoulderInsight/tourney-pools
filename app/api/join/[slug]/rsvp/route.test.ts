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

vi.mock("@/lib/db", () => ({
  getDb: () => {
    const mockSql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");
      if (query.includes("SELECT p.id, p.draft_complete, c.tier, c.pro_until")) {
        return Promise.resolve([mockPool]);
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
    });
    return mockSql;
  },
}));

describe("POST /api/join/[slug]/rsvp - RSVP Acceptance Limits", () => {
  beforeEach(() => {
    mockPool = {
      id: "pool-123",
      draft_complete: false,
      tier: "free",
      pro_until: null,
    };
    mockPlayerCount = 0;
  });

  it("allows 8th player to accept in free pool", async () => {
    mockPlayerCount = 7;

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });

  it("blocks 9th player from accepting in free pool", async () => {
    mockPlayerCount = 8;

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("Free pools can have up to 8 players");
  });

  it("allows declined player to decline again without limit check", async () => {
    mockPlayerCount = 8;

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "declined" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });

  it("allows Pro pool to accept 9th player", async () => {
    mockPool.tier = "pro";
    mockPlayerCount = 8;

    const req = new NextRequest("http://localhost:3000/api/join/test-slug/rsvp", {
      method: "POST",
      body: JSON.stringify({ playerId: "player-123", status: "accepted" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });
});
