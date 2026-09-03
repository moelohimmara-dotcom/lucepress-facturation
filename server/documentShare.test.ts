import { describe, expect, it } from "vitest";
import {
  createDocumentShareToken,
  computeDocumentShareExpiry,
  DOCUMENT_SHARE_TTL_MS,
  hashDocumentShareToken,
  isPlausibleDocumentShareToken,
} from "../shared/documentShare";

describe("documentShare tokens", () => {
  it("génère un jeton hex 64 chars plausible et une empreinte SHA-256 stable", () => {
    const token = createDocumentShareToken();
    expect(token).toHaveLength(64);
    expect(isPlausibleDocumentShareToken(token)).toBe(true);
    expect(hashDocumentShareToken(token)).toHaveLength(64);
    expect(hashDocumentShareToken(token)).toBe(hashDocumentShareToken(token));
    expect(hashDocumentShareToken(token)).not.toBe(token);
  });

  it("refuse les jetons trop courts ou non hex", () => {
    expect(isPlausibleDocumentShareToken("abc")).toBe(false);
    expect(isPlausibleDocumentShareToken("g".repeat(64))).toBe(false);
    expect(isPlausibleDocumentShareToken("a".repeat(63))).toBe(false);
  });

  it("calibre l’expiration autour de la validité devis sans dépasser 90 j", () => {
    const now = new Date("2026-09-03T12:00:00.000Z");
    const expires = computeDocumentShareExpiry({
      validUntil: "2026-09-10",
      now,
    });
    const max = new Date(now.getTime() + DOCUMENT_SHARE_TTL_MS);
    expect(expires.getTime()).toBeLessThanOrEqual(max.getTime());
    expect(expires.getTime()).toBeGreaterThan(now.getTime());
  });
});
