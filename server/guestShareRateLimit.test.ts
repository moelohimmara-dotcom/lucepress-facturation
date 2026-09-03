import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetGuestShareRateLimitForTests,
  assertGuestShareRateLimit,
} from "./_core/guestShareRateLimit";

describe("guestShareRateLimit", () => {
  beforeEach(() => {
    __resetGuestShareRateLimitForTests();
  });

  it("autorise les premières tentatives puis bloque l’IP", () => {
    for (let i = 0; i < 40; i += 1) {
      expect(assertGuestShareRateLimit("203.0.113.10").allowed).toBe(true);
    }
    const blocked = assertGuestShareRateLimit("203.0.113.10");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("isole les compteurs par IP", () => {
    for (let i = 0; i < 41; i += 1) {
      assertGuestShareRateLimit("203.0.113.1");
    }
    expect(assertGuestShareRateLimit("203.0.113.2").allowed).toBe(true);
  });
});
