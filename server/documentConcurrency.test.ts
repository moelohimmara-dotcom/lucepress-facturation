import { describe, expect, it } from "vitest";
import { isConcurrentDocumentUpdate } from "../shared/documentConcurrency";

describe("isConcurrentDocumentUpdate", () => {
  it("détecte un updatedAt différent", () => {
    expect(isConcurrentDocumentUpdate("2026-09-03T10:00:00.000Z", "2026-09-03T09:00:00.000Z")).toBe(true);
    expect(isConcurrentDocumentUpdate("2026-09-03T10:00:00.000Z", "2026-09-03T10:00:00.000Z")).toBe(false);
  });

  it("n’impose pas le verrou si l’attendu est absent (clients anciens)", () => {
    expect(isConcurrentDocumentUpdate("2026-09-03T10:00:00.000Z", undefined)).toBe(false);
  });
});
