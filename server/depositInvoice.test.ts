import { describe, expect, it } from "vitest";
import { calculateDepositInvoiceAmount } from "../shared/depositInvoice";

describe("facture d’acompte", () => {
  it("calcule l’acompte à partir du total TTC remisé du devis", () => {
    expect(calculateDepositInvoiceAmount(10_030_000, 30)).toBe(3_009_000);
  });

  it("refuse un devis sans échéancier d’acompte exploitable", () => {
    expect(() => calculateDepositInvoiceAmount(1_000_000, null)).toThrow("acompte valide");
  });
});
