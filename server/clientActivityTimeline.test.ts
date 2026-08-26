import { describe, expect, it } from "vitest";
import { buildClientActivityTimeline } from "../shared/clientActivityTimeline";

describe("buildClientActivityTimeline", () => {
  it("fusionne documents et relances dans un ordre chronologique décroissant avec les liens document", () => {
    const timeline = buildClientActivityTimeline(2, [{ id: 9, kind: "devis", number: "DEV-2026-0009", total: 450000, status: "brouillon", createdAt: new Date("2026-08-10") }], [{ id: 3, clientId: 2, documentId: 9, type: "relance_preparee", title: "Relance courtois préparée", description: "Objet", createdById: 1, createdAt: new Date("2026-08-15") }], [{ id: 4, documentId: 9, documentNumber: "DEV-2026-0009", amount: 125000, method: "virement", reference: "VIR-42", paidAt: new Date("2026-08-20"), createdAt: new Date("2026-08-20") }]);
    expect(timeline.map(event => event.id)).toEqual(["payment-4", "activity-3", "document-9"]);
    expect(timeline[0]).toMatchObject({ documentId: 9, type: "paiement_enregistre", title: "Paiement de 125 000 GNF enregistré", description: "Facture DEV-2026-0009 · virement · Réf. VIR-42" });
    expect(timeline[2]).toMatchObject({ documentId: 9, type: "document_genere", title: "Devis DEV-2026-0009 généré" });
  });
});
