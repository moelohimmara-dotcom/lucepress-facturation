import { describe, expect, it } from "vitest";
import { calculateProjectMargin } from "../shared/projectFinancials";

describe("marge de chantier", () => {
  it("calcule la marge réalisée uniquement à partir des encaissements et coûts", () => {
    expect(calculateProjectMargin({ revenueCollected: 2_000_000, costTotal: 1_250_000 })).toEqual({ revenueCollected: 2_000_000, costTotal: 1_250_000, margin: 750_000, marginRate: 37.5 });
  });

  it("ne produit pas un taux artificiel lorsqu’aucun encaissement n’existe", () => {
    expect(calculateProjectMargin({ revenueCollected: 0, costTotal: 150_000 })).toMatchObject({ margin: -150_000, marginRate: null });
  });
});
