import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  getDb: () => {
    const mockSql = vi.fn();
    return mockSql;
  },
}));

vi.mock("@/lib/golf-api", () => ({
  fetchLeaderboard: vi.fn(),
  extractRoundScores: vi.fn(),
  normalizeName: vi.fn(),
}));

vi.mock("@/lib/draft-pool", () => ({
  importTournamentField: vi.fn(),
  draftPoolFromField: vi.fn(),
}));

describe("Cron Sync Scores Route", () => {
  const originalEnv = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CRON_SECRET = originalEnv;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it("returns 503 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;

    const req = new NextRequest("http://localhost:3000/api/cron/sync-scores", {
      method: "GET",
      headers: {
        authorization: "Bearer something",
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe("Cron not configured");
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = "test-secret-123";

    const req = new NextRequest("http://localhost:3000/api/cron/sync-scores", {
      method: "GET",
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it("returns 401 when Bearer undefined is sent", async () => {
    process.env.CRON_SECRET = "test-secret-123";

    const req = new NextRequest("http://localhost:3000/api/cron/sync-scores", {
      method: "GET",
      headers: {
        authorization: "Bearer undefined",
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it("returns 401 when wrong secret is sent", async () => {
    process.env.CRON_SECRET = "test-secret-123";

    const req = new NextRequest("http://localhost:3000/api/cron/sync-scores", {
      method: "GET",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
  });
});
