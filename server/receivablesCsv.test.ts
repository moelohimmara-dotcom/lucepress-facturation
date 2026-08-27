import { describe, expect, it } from "vitest";
import { createReceivablesCsv } from "../shared/receivablesCsv";

describe("export CSV des créances filtrées", () => {
  it("préserve les priorités, montants et caractères spéciaux de la file visible", () => {
    const csv = createReceivablesCsv([{
      number: "FAC-2026-0042",
      clientName: "Bâti; Guinée",
      projectName: "Forage \"Kankan\"",
      dueDate: "2026-08-10",
      total: 900_000,
      paidAmount: 125_000,
      balanceDue: 775_000,
      isOverdue: true,
      daysOverdue: 17,
      isPaymentPromiseOverdue: true,
      paymentPromise: { promisedDate: "2026-08-20", note: "Règlement après validation\ninterne" },
    }]);
    expect(csv).toContain("Priorité;Facture;Client");
    expect(csv).toContain("Promesse dépassée;FAC-2026-0042;\"Bâti; Guinée\";\"Forage \"\"Kankan\"\"\"");
    expect(csv).toContain("17;2026-08-20;\"Règlement après validation\ninterne\";900000;125000;775000");
  });
});
