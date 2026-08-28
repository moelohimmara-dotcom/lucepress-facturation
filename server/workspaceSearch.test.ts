import { buildWorkspaceSearchResults } from "../shared/workspaceSearch";
import { describe, expect, it } from "vitest";

describe("recherche globale Lucepress", () => {
  it("trouve sans tenir compte des accents et renvoie des destinations spécifiques", () => {
    const results = buildWorkspaceSearchResults({
      query: "batiment",
      clients: [{ id: 1, companyName: "Bâtiment Guinée", contactName: "Mme Camara" }],
      documents: [{ id: 4, kind: "devis", number: "DEV-004", clientName: "Bâtiment Guinée", status: "Brouillon" }],
      receivables: [],
    });
    expect(results.map(result => result.href)).toEqual(["/clients?clientId=1", "/documents/4"]);
  });

  it("ignore les recherches trop courtes et rend les créances directement actionnables", () => {
    expect(buildWorkspaceSearchResults({ query: "a", clients: [], documents: [], receivables: [] })).toEqual([]);
    const [result] = buildWorkspaceSearchResults({ query: "fac", clients: [], documents: [], receivables: [{ id: 7, number: "FAC-007", clientName: "Kankan BTP", balanceDue: 250000, collectionStatus: "a_rappeler" }] });
    expect(result).toMatchObject({ kind: "creance", href: "/creances?facture=7" });
  });

  it("filtre par période, statut et montant puis trie les documents", () => {
    const results = buildWorkspaceSearchResults({
      query: "dev",
      clients: [],
      documents: [
        { id: 1, kind: "devis", number: "DEV-001", clientName: "BTP Conakry", status: "envoye", issueDate: "2026-08-12", total: 900000 },
        { id: 2, kind: "devis", number: "DEV-002", clientName: "BTP Conakry", status: "brouillon", issueDate: "2026-08-15", total: 1400000 },
        { id: 3, kind: "devis", number: "DEV-003", clientName: "BTP Conakry", status: "envoye", issueDate: "2026-07-30", total: 1800000 },
      ],
      receivables: [],
      filters: { kind: "devis", dateFrom: "2026-08-01", dateTo: "2026-08-31", status: "envoye", amountMin: 500000, amountMax: 1000000, sortBy: "amount", sortDirection: "desc" },
    });
    expect(results.map(result => result.id)).toEqual([1]);
  });

  it("exclut les clients d’un filtre montant et trie les résultats par date", () => {
    const results = buildWorkspaceSearchResults({
      query: "bati",
      clients: [{ id: 8, companyName: "Bati Guinée", updatedAt: "2026-08-20" }],
      documents: [{ id: 9, kind: "devis", number: "DEV-009", clientName: "Bati Guinée", status: "envoye", issueDate: "2026-08-22", total: 600000 }],
      receivables: [],
      filters: { dateFrom: "2026-08-01", sortBy: "date", sortDirection: "desc" },
    });
    expect(results.map(result => result.id)).toEqual([9, 8]);
    expect(buildWorkspaceSearchResults({ query: "bati", clients: [{ id: 8, companyName: "Bati Guinée" }], documents: [], receivables: [], filters: { amountMin: 1 } })).toEqual([]);
  });
});
