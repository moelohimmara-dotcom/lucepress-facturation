import { describe, expect, it } from "vitest";
import { getDaysOverdue, summarizeReceivables } from "../shared/receivables";

const now = new Date("2026-08-27T12:00:00Z");
const invoice = (overrides: Partial<any>) => ({ id: 1, number: "FAC-001", clientId: 1, clientName: "Client", projectId: 1, projectName: "Chantier", issueDate: "2026-08-01", dueDate: "2026-08-15", total: 300_000, paidAmount: 0, balanceDue: 300_000, isOverdue: true, ...overrides });

describe("tableau de créances", () => {
  it("priorise les retards et sépare l’encours à échéance", () => {
    const result = summarizeReceivables([
      invoice({ id: 2, number: "FAC-002", balanceDue: 80_000, isOverdue: false, dueDate: "2026-09-10" }),
      invoice({ id: 3, number: "FAC-003", balanceDue: 0, isOverdue: false }),
      invoice({ id: 1, number: "FAC-001", balanceDue: 300_000, isOverdue: true, dueDate: "2026-08-15" }),
    ], now);
    expect(result.summary).toEqual({ openCount: 2, overdueCount: 1, outstandingTotal: 380_000, overdueTotal: 300_000, currentTotal: 80_000 });
    expect(result.invoices.map(item => item.number)).toEqual(["FAC-001", "FAC-002"]);
    expect(result.invoices[0]?.daysOverdue).toBe(12);
  });

  it("évite de calculer un retard sans échéance renseignée", () => {
    expect(getDaysOverdue(null, now)).toBe(0);
  });
});
