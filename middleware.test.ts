import { describe, it, expect, vi, afterEach } from "vitest";
import { middleware } from "./middleware";
import { NextRequest } from "next/server";

describe("Middleware - Auth with Forged Cookie", () => {
  const originalEnv = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it("rejects API request with cookie signed with dev-secret-change-me", async () => {
    process.env.JWT_SECRET = "a-real-secret-that-is-at-least-32-characters-long";

    const forgedToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaGFpcm1hbklkIjoiZmFrZSIsImVtYWlsIjoiZmFrZUBleGFtcGxlLmNvbSIsIm5hbWUiOiJGYWtlIiwiaXNTdXBlckFkbWluIjp0cnVlfQ.fake";

    const req = new NextRequest("http://localhost:3000/api/pools", {
      method: "GET",
      headers: {
        cookie: `tp_session=${forgedToken}`,
      },
    });

    const response = await middleware(req);
    expect(response.status).toBe(401);
  });

  it("redirects page request with forged cookie to login", async () => {
    process.env.JWT_SECRET = "a-real-secret-that-is-at-least-32-characters-long";

    const forgedToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaGFpcm1hbklkIjoiZmFrZSIsImVtYWlsIjoiZmFrZUBleGFtcGxlLmNvbSIsIm5hbWUiOiJGYWtlIn0.fake";

    const req = new NextRequest("http://localhost:3000/dashboard", {
      method: "GET",
      headers: {
        cookie: `tp_session=${forgedToken}`,
      },
    });

    const response = await middleware(req);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("fails closed when JWT_SECRET is not set", async () => {
    delete process.env.JWT_SECRET;

    const req = new NextRequest("http://localhost:3000/api/pools", {
      method: "GET",
      headers: {
        cookie: "tp_session=any-token",
      },
    });

    const response = await middleware(req);
    expect(response.status).toBe(401);
  });
});
