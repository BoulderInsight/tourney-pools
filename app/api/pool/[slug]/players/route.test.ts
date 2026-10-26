import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

const mockSession = {
  chairmanId: "chairman-123",
  email: "test@example.com",
  name: "Test User",
};

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

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/people", () => ({
  findOrCreatePersonForPool: vi.fn(() =>
    Promise.resolve({ id: "person-123", chairmanId: "chairman-123", name: "Test Player" })
  ),
  createPerson: vi.fn(),
  setPersonPhone: vi.fn(),
}));

vi.mock("@/lib/phone", () => ({
  normalizeUsPhoneE164: vi.fn((phone) => (phone ? "+15551234567" : null)),
}));

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
      if (query.includes("SELECT COALESCE(MAX(pick_order)")) {
        return Promise.resolve([{ next: mockPlayerCount }]);
      }
      if (query.includes("INSERT INTO players")) {
        return Promise.resolve([
          {
            id: "player-123",
            name: "Test Player",
            rsvp_status: "pending",
            invited_at: null,
          },
        ]);
      }
      return Promise.resolve([]);
    });
    return mockSql;
  },
}));

describe("POST /api/pool/[slug]/players - Free Tier Limits", () => {
  beforeEach(() => {
    mockPool = {
      id: "pool-123",
      draft_complete: false,
      tier: "free",
      pro_until: null,
    };
    mockPlayerCount = 0;
  });

  it("allows free pool to add up to 8 players", async () => {
    mockPlayerCount = 7;

    const req = new NextRequest("http://localhost:3000/api/pool/test-slug/players", {
      method: "POST",
      body: JSON.stringify({ name: "Player 8" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });

  it("blocks free pool from adding 9th player", async () => {
    mockPlayerCount = 8;

    const req = new NextRequest("http://localhost:3000/api/pool/test-slug/players", {
      method: "POST",
      body: JSON.stringify({ name: "Player 9" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("Free pools hold up to 8 players");
    expect(data.upgradeUrl).toBeUndefined();
  });

  it("allows Pro pool to add more than 8 players", async () => {
    mockPool = {
      ...mockPool,
      tier: "pro",
    };
    mockPlayerCount = 10;

    const req = new NextRequest("http://localhost:3000/api/pool/test-slug/players", {
      method: "POST",
      body: JSON.stringify({ name: "Player 11" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });

  it("allows pool with active promo to add more than 8 players", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    mockPool = {
      ...mockPool,
      tier: "free",
      pro_until: futureDate.toISOString(),
    };
    mockPlayerCount = 9;

    const req = new NextRequest("http://localhost:3000/api/pool/test-slug/players", {
      method: "POST",
      body: JSON.stringify({ name: "Player 10" }),
    });

    const response = await POST(req, { params: { slug: "test-slug" } });
    expect(response.status).toBe(200);
  });
});
