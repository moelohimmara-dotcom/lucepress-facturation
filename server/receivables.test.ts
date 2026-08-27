import { describe, expect, it } from "vitest";
import { getDaysOverdue, isPaymentPromiseDueSoon, isPaymentPromiseOverdue, summarizeReceivables } from "../shared/receivables";

const now = new Date("2026-08-27T12:00:00Z");
const invoice = (overrides: Partial<any>) => ({ id: 1, number: "FAC-001", clientId: 1, clientName: "Client", projectId: 1, projectName: "Chantier", issueDate: "2026-08-01", dueDate: "2026-08-15", total: 300_000, paidAmount: 0, balanceDue: 300_000, isOverdue: true, ...overrides });

describe("tableau de créances", () => {
  it("priorise les retards et sépare l’encours à échéance", () => {
    const result = summarizeReceivables([
      invoice({ id: 2, number: "FAC-002", balanceDue: 80_000, isOverdue: false, dueDate: "2026-09-10" }),
      invoice({ id: 3, number: "FAC-003", balanceDue: 0, isOverdue: false }),
      invoice({ id: 1, number: "FAC-001", balanceDue: 300_000, isOverdue: true, dueDate: "2026-08-15" }),
    ], now);
    expect(result.summary).toEqual({ openCount: 2, overdueCount: 1, outstandingTotal: 380_000, overdueTotal: 300_000, currentTotal: 80_000, expiredPromiseCount: 0, expiredPromiseTotal: 0, upcomingPromiseCount: 0, upcomingPromiseTotal: 0 });
    expect(result.invoices.map(item => item.number)).toEqual(["FAC-001", "FAC-002"]);
    expect(result.invoices[0]?.daysOverdue).toBe(12);
  });

  it("évite de calculer un retard sans échéance renseignée", () => {
    expect(getDaysOverdue(null, now)).toBe(0);
  });

  it("signale et priorise les promesses de paiement qui sont dépassées", () => {
    const result = summarizeReceivables([
      invoice({ id: 1, number: "FAC-001", paymentPromise: { id: 9, documentId: 1, promisedDate: "2026-08-20", note: null, updatedAt: now } }),
      invoice({ id: 2, number: "FAC-002", dueDate: "2026-08-10", paymentPromise: { id: 10, documentId: 2, promisedDate: "2026-08-29", note: null, updatedAt: now } }),
    ], now);
    expect(isPaymentPromiseOverdue("2026-08-20", now)).toBe(true);
    expect(result.summary).toMatchObject({ expiredPromiseCount: 1, expiredPromiseTotal: 300_000 });
    expect(result.invoices[0]).toMatchObject({ number: "FAC-001", isPaymentPromiseOverdue: true });
  });

  it("isole et classe les promesses attendues dans les sept jours", () => {
    const result = summarizeReceivables([
      invoice({ id: 1, number: "FAC-001", paymentPromise: { id: 9, documentId: 1, promisedDate: "2026-09-03", note: null, updatedAt: now } }),
      invoice({ id: 2, number: "FAC-002", paymentPromise: { id: 10, documentId: 2, promisedDate: "2026-08-28", note: null, updatedAt: now } }),
      invoice({ id: 3, number: "FAC-003", paymentPromise: { id: 11, documentId: 3, promisedDate: "2026-09-04", note: null, updatedAt: now } }),
    ], now);
    expect(isPaymentPromiseDueSoon("2026-09-03", now)).toBe(true);
    expect(isPaymentPromiseDueSoon("2026-09-04", now)).toBe(false);
    expect(result.summary).toMatchObject({ upcomingPromiseCount: 2, upcomingPromiseTotal: 600_000 });
    expect(result.upcomingPromises.map(item => item.number)).toEqual(["FAC-002", "FAC-001"]);
  });
});
