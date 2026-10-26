import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

const mockSession = {
  chairmanId: "chairman-123",
  email: "test@example.com",
  name: "Test User",
};

let mockChairman: { tier: string; pro_until: string | null } = { tier: "free", pro_until: null };
let mockPoolCount = 0;

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => {
    const mockSql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");
      if (query.includes("SELECT tier, pro_until FROM chairmen")) {
        return Promise.resolve([mockChairman]);
      }
      if (query.includes("SELECT COUNT(*) as count FROM pools")) {
        return Promise.resolve([{ count: mockPoolCount }]);
      }
      if (query.includes("INSERT INTO pools")) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
    return mockSql;
  },
}));

describe("POST /api/pools - Free Tier Limits", () => {
  beforeEach(() => {
    mockChairman = { tier: "free", pro_until: null };
    mockPoolCount = 0;
  });

  it("allows free user to create first pool", async () => {
    mockPoolCount = 0;

    const req = new NextRequest("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ poolName: "My Pool" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });

  it("blocks free user from creating second pool", async () => {
    mockPoolCount = 1;

    const req = new NextRequest("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ poolName: "My Second Pool" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("Free plans include 1 pool");
    expect(data.upgradeUrl).toBeUndefined();
  });

  it("allows Pro user to create multiple pools", async () => {
    mockChairman = { tier: "pro", pro_until: null };
    mockPoolCount = 5;

    const req = new NextRequest("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ poolName: "My Pool" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });

  it("allows user with active promo to create multiple pools", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    mockChairman = { tier: "free", pro_until: futureDate.toISOString() };
    mockPoolCount = 3;

    const req = new NextRequest("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ poolName: "My Pool" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });
});
