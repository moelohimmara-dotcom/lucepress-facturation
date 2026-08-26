import { describe, expect, it } from "vitest";
import { createServicePriceRevisionCsv } from "../shared/servicePriceRevisionCsv";

describe("export CSV des révisions tarifaires", () => {
  it("crée des colonnes françaises et échappe les séparateurs et guillemets", () => {
    const csv = createServicePriceRevisionCsv([{ createdAt: new Date("2026-08-26T10:00:00.000Z"), serviceCode: "HYD;01", serviceName: "Forage \"test\"", previousUnitPrice: 200000, nextUnitPrice: 250000, previousTaxRate: 0, nextTaxRate: 18, changedByName: "Awa Diallo" }]);
    expect(csv).toContain("Date;Code prestation;Prestation");
    expect(csv).toContain('"HYD;01";"Forage ""test""";200000;250000;0;18;Awa Diallo');
  });
});
