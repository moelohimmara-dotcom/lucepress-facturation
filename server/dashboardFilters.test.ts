import { describe, expect, it } from "vitest";
import { selectDashboardDocuments } from "../shared/dashboardFilters";

describe("selectDashboardDocuments", () => {
  const documents = [
    { id: 1, kind: "facture" as const, status: "en_retard" as const, isOverdue: true },
    { id: 2, kind: "facture" as const, status: "envoye" as const, isOverdue: false },
    { id: 3, kind: "devis" as const, status: "brouillon" as const, isOverdue: false },
    { id: 4, kind: "devis" as const, status: "a_envoyer" as const, isOverdue: false },
    { id: 5, kind: "devis" as const, status: "envoye" as const, isOverdue: false },
  ];

  it("isole uniquement les factures échues", () => {
    expect(selectDashboardDocuments(documents, "overdue").map(document => document.id)).toEqual([1]);
  });

  it("isole uniquement les devis qui restent à préparer ou envoyer", () => {
    expect(selectDashboardDocuments(documents, "pending_quotes").map(document => document.id)).toEqual([3, 4]);
  });
});
