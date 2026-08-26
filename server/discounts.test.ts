import { describe, expect, it } from "vitest";
import { calculateDocumentDiscount } from "../shared/discounts";

describe("remise de devis", () => {
  it("calcule une remise commerciale sur le total TTC sans modifier les lignes", () => {
    expect(calculateDocumentDiscount([{ description: "Prestation", quantity: 1, unit: "forfait", unitPrice: 100000, taxRate: 18 }], 15)).toEqual({ subtotal: 100000, taxTotal: 18000, total: 118000, discountPercent: 15, discountAmount: 17700, totalAfterDiscount: 100300 });
  });
});
