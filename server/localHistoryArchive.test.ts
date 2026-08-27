import { describe, expect, it } from "vitest";
import { createLocalHistoryArchive, formatLocalArchiveFilename, parseLocalHistoryArchive } from "../client/src/lib/localHistoryArchive";

const archivedDecision = {
  id: "archive-1",
  providerName: "Google Workspace",
  operation: "Préparer une échéance chantier",
  payloadHash: "archive-hash-001",
  createdAt: new Date("2026-08-01T08:00:00.000Z"),
  decidedAt: new Date("2026-08-02T09:30:00.000Z"),
  decision: "approve" as const,
};

describe("archive CSV de l’historique local", () => {
  it("produit une archive horodatée puis restaure uniquement les décisions locales valides", () => {
    const generatedAt = new Date("2026-08-27T10:05:07");
    expect(formatLocalArchiveFilename(generatedAt)).toBe("lucepress-archive-historique-local-20260827-100507.csv");
    const archive = createLocalHistoryArchive([archivedDecision], generatedAt);
    expect(archive).toContain("Archive Lucepres — historique local des simulations");
    expect(archive).toContain("Générée le");
    expect(parseLocalHistoryArchive(archive)).toMatchObject([{ providerName: "Google Workspace", decision: "approve", payloadHash: "archive-hash-001" }]);
  });

  it("refuse une archive qui prétend provenir d’une autre portée", () => {
    const archive = createLocalHistoryArchive([archivedDecision]).replace("Simulation locale · archive complète", "Source externe");
    expect(() => parseLocalHistoryArchive(archive)).toThrow("simulation locale valide");
  });
});
