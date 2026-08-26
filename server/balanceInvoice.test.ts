import { describe, expect, it } from "vitest";
import { assertDepositInvoiceIsFullyPaid, calculateBalanceInvoiceAmount, reuseExistingGeneratedInvoice } from "../shared/balanceInvoice";

describe("facture de solde", () => {
  it("déduit l’acompte TTC du total du devis", () => {
    expect(calculateBalanceInvoiceAmount(10_030_000, 3_009_000)).toBe(7_021_000);
  });

  it("refuse un solde nul ou négatif", () => {
    expect(() => calculateBalanceInvoiceAmount(1_000_000, 1_000_000)).toThrow("solde");
  });

  it("refuse la création avant le règlement complet de l’acompte", () => {
    expect(() => assertDepositInvoiceIsFullyPaid(3_000_000, 2_999_999)).toThrow("intégralement réglée");
    expect(() => assertDepositInvoiceIsFullyPaid(3_000_000, 3_000_000)).not.toThrow();
  });

  it("réutilise la facture de solde existante au lieu de créer un doublon", () => {
    expect(reuseExistingGeneratedInvoice({ id: 32, number: "FAC-2026-0032" })).toEqual({ id: 32, number: "FAC-2026-0032", existing: true });
    expect(reuseExistingGeneratedInvoice(undefined)).toBeNull();
  });
});
