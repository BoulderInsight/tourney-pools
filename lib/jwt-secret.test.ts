import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getJwtSecret } from "./jwt-secret";

describe("getJwtSecret", () => {
  const originalEnv = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it("returns null when JWT_SECRET is not set", () => {
    delete process.env.JWT_SECRET;
    const result = getJwtSecret();
    expect(result).toBeNull();
  });

  it("returns null when JWT_SECRET is too short", () => {
    process.env.JWT_SECRET = "short";
    const result = getJwtSecret();
    expect(result).toBeNull();
  });

  it("returns null when JWT_SECRET is exactly 31 characters", () => {
    process.env.JWT_SECRET = "a".repeat(31);
    const result = getJwtSecret();
    expect(result).toBeNull();
  });

  it("returns encoded secret when JWT_SECRET is exactly 32 characters", () => {
    process.env.JWT_SECRET = "a".repeat(32);
    const result = getJwtSecret();
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("returns encoded secret when JWT_SECRET is longer than 32 characters", () => {
    process.env.JWT_SECRET = "a".repeat(64);
    const result = getJwtSecret();
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
