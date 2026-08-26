import { describe, expect, it } from "vitest";
import { buildClientActivityTimeline } from "../shared/clientActivityTimeline";

describe("buildClientActivityTimeline", () => {
  it("fusionne documents et relances dans un ordre chronologique décroissant avec les liens document", () => {
    const timeline = buildClientActivityTimeline(2, [{ id: 9, kind: "devis", number: "DEV-2026-0009", total: 450000, status: "brouillon", createdAt: new Date("2026-08-10") }], [{ id: 3, clientId: 2, documentId: 9, type: "relance_preparee", title: "Relance courtois préparée", description: "Objet", createdById: 1, createdAt: new Date("2026-08-15") }]);
    expect(timeline.map(event => event.id)).toEqual(["activity-3", "document-9"]);
    expect(timeline[1]).toMatchObject({ documentId: 9, type: "document_genere", title: "Devis DEV-2026-0009 généré" });
  });
});
