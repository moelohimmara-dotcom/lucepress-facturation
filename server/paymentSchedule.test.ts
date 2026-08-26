import { describe, expect, it } from "vitest";
import { calculateQuotePaymentSchedule, validateQuotePaymentSchedule } from "../shared/paymentSchedule";

describe("échéancier acompte et solde", () => {
  it("répartit le total d’un devis entre acompte et solde sans perte d’arrondi", () => {
    expect(calculateQuotePaymentSchedule(1_000_001, 30)).toEqual({ depositPercent: 30, depositAmount: 300000, balancePercent: 70, balanceAmount: 700001 });
  });

  it("valide les pourcentages et l’ordre des échéances", () => {
    expect(validateQuotePaymentSchedule({ depositPercent: 30, depositDueDate: "2026-09-10", balanceDueDate: "2026-10-10" })).toEqual({});
    expect(validateQuotePaymentSchedule({ depositPercent: 100, depositDueDate: "2026-10-10", balanceDueDate: "2026-09-10" })).toMatchObject({ depositPercent: expect.any(String), balanceDueDate: expect.any(String) });
  });
});
