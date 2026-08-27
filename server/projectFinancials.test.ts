import { describe, expect, it } from "vitest";
import { calculateProjectMargin } from "../shared/projectFinancials";

describe("marge de chantier", () => {
  it("calcule la marge réalisée uniquement à partir des encaissements et coûts", () => {
    expect(calculateProjectMargin({ revenueCollected: 2_000_000, costTotal: 1_250_000 })).toMatchObject({ revenueCollected: 2_000_000, costTotal: 1_250_000, margin: 750_000, marginRate: 37.5, plannedMargin: null });
  });

  it("ne produit pas un taux artificiel lorsqu’aucun encaissement n’existe", () => {
    expect(calculateProjectMargin({ revenueCollected: 0, costTotal: 150_000 })).toMatchObject({ margin: -150_000, marginRate: null });
  });

  it("compare la marge réalisée à la marge prévue quand un budget et un devis accepté existent", () => {
    expect(calculateProjectMargin({ revenueCollected: 800_000, costTotal: 500_000, plannedRevenue: 1_000_000, plannedBudget: 600_000 })).toMatchObject({ plannedMargin: 400_000, plannedMarginRate: 40, margin: 300_000, marginVariance: -100_000 });
  });
});
