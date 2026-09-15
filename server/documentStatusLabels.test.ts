import { describe, expect, it } from "vitest";
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_LABELS, documentStatusLabel, summarizeDashboard } from "../shared/billing";
import { buildClientActivityTimeline } from "../shared/clientActivityTimeline";

describe("libellés des statuts de document", () => {
  it("affiche les accents français attendus", () => {
    expect(documentStatusLabel("brouillon")).toBe("Brouillon");
    expect(documentStatusLabel("a_envoyer")).toBe("À envoyer");
    expect(documentStatusLabel("envoye")).toBe("Envoyé");
    expect(documentStatusLabel("accepte")).toBe("Accepté");
    expect(documentStatusLabel("refuse")).toBe("Refusé");
    expect(documentStatusLabel("partiellement_paye")).toBe("Partiellement payé");
    expect(documentStatusLabel("paye")).toBe("Payé");
    expect(documentStatusLabel("en_retard")).toBe("En retard");
    expect(documentStatusLabel("annule")).toBe("Annulé");
  });

  it("couvre exactement les statuts persistés, sans en inventer", () => {
    expect([...DOCUMENT_STATUSES].sort()).toEqual(Object.keys(DOCUMENT_STATUS_LABELS).sort());
  });

  it("ne modifie aucune valeur de statut persistée", () => {
    expect(DOCUMENT_STATUSES).toEqual([
      "brouillon",
      "a_envoyer",
      "envoye",
      "accepte",
      "refuse",
      "partiellement_paye",
      "paye",
      "en_retard",
      "annule",
    ]);
  });

  it("retombe sur le code lisible pour un statut inconnu", () => {
    expect(documentStatusLabel("statut_herite")).toBe("statut herite");
  });

  it("affiche la liste complète et exacte des libellés", () => {
    expect(DOCUMENT_STATUSES.map(documentStatusLabel)).toEqual([
      "Brouillon",
      "À envoyer",
      "Envoyé",
      "Accepté",
      "Refusé",
      "Partiellement payé",
      "Payé",
      "En retard",
      "Annulé",
    ]);
  });

  it("affiche le statut accentué dans la frise d'activité client", () => {
    const timeline = buildClientActivityTimeline(2, [
      { id: 9, kind: "devis", number: "DEV-2026-0009", total: 450000, status: "envoye", createdAt: new Date("2026-08-10") },
    ], []);
    expect(timeline[0]?.description).toBe(`Document envoyé · ${(450000).toLocaleString("fr-GN")} GNF`);
  });

  it("conserve les codes utilisés par le pilotage", () => {
    const summary = summarizeDashboard([
      { kind: "devis", status: "a_envoyer", total: 1000, dueDate: null },
      { kind: "devis", status: "accepte", total: 2000, dueDate: null },
    ]);
    expect(summary.toProcess).toBe(1);
    expect(summary.accepted).toBe(1);
  });
});
