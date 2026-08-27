import { describe, expect, it } from "vitest";
import { createProjectMarginCsv } from "../shared/projectMarginExport";

describe("export du comparatif de marges", () => {
  it("produit un CSV échappable contenant les prévisions, le réel et le seuil", () => {
    const csv = createProjectMarginCsv([{
      name: "Forage, Kankan", reference: "CH-01", clientName: "Client A", plannedRevenue: 1_000_000, plannedBudget: 600_000,
      plannedMargin: 400_000, plannedMarginRate: 40, revenueCollected: 800_000, costTotal: 650_000, margin: 150_000, marginRate: 18.8,
      marginVariance: -250_000, minimumMarginRate: 20, isMarginBelowTarget: true,
    }]);
    expect(csv).toContain('"Forage, Kankan"');
    expect(csv).toContain('"20"');
    expect(csv).toContain('"Oui"');
  });
});
