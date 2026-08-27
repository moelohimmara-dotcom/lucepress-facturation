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
});
