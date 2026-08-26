import { describe, expect, it } from "vitest";
import { calculateDocumentTotals, calculatePaymentBalance, formatDocumentNumber, formatGnf, initialDocumentStatus, invoicePaymentStatus, isInvoiceOverdue, summarizeDashboard } from "../shared/billing";

describe("calculateDocumentTotals", () => {
  it("calcule le sous-total, les taxes et le total TTC sur des lignes en GNF", () => {
    const totals = calculateDocumentTotals([
      { description: "Forage", quantity: 80, unit: "m", unitPrice: 150000, taxRate: 0 },
      { description: "Mobilisation", quantity: 1, unit: "forfait", unitPrice: 2500000, taxRate: 18 },
    ]);

    expect(totals).toEqual({
      subtotal: 14500000,
      taxTotal: 450000,
      total: 14950000,
    });
  });

  it("arrondit les montants intermédiaires en francs entiers", () => {
    const totals = calculateDocumentTotals([
      { description: "Étude", quantity: 2.5, unit: "jour", unitPrice: 12345, taxRate: 7 },
    ]);

    expect(totals).toEqual({ subtotal: 30863, taxTotal: 2160, total: 33023 });
  });
});

describe("formatGnf", () => {
  it("présente un montant en francs guinéens sans décimales", () => {
    expect(formatGnf(14950000)).toMatch(/14[\s\u00a0\u202f]?950[\s\u00a0\u202f]?000/);
    expect(formatGnf(14950000)).toContain("GNF");
  });
});

describe("règles de document", () => {
  it("numérote séparément les devis et factures avec un compteur sur quatre chiffres", () => {
    expect(formatDocumentNumber("devis", 2026, 7)).toBe("DEV-2026-0007");
    expect(formatDocumentNumber("facture", 2026, 128)).toBe("FAC-2026-0128");
  });

  it("force tout devis issu de l’IA au statut brouillon avant relecture humaine", () => {
    expect(initialDocumentStatus("a_envoyer", true)).toBe("brouillon");
    expect(initialDocumentStatus("a_envoyer", false)).toBe("a_envoyer");
  });
});

describe("summarizeDashboard", () => {
  it("distingue les documents à traiter, envoyés, acceptés, payés et en retard", () => {
    const now = new Date("2026-08-26T12:00:00.000Z");
    const metrics = summarizeDashboard([
      { kind: "devis", status: "brouillon", total: 500000, dueDate: null },
      { kind: "devis", status: "envoye", total: 750000, dueDate: null },
      { kind: "devis", status: "accepte", total: 1000000, dueDate: null },
      { kind: "facture", status: "paye", total: 2500000, dueDate: new Date("2026-08-20T00:00:00.000Z") },
      { kind: "facture", status: "envoye", total: 4000000, dueDate: new Date("2026-08-25T00:00:00.000Z") },
    ], now);

    expect(metrics).toMatchObject({ toProcess: 1, sent: 2, accepted: 1, paidCount: 1, paidTotal: 2500000, overdue: 1, invoicesToFollow: 1 });
  });
});

describe("règlements et alertes facture", () => {
  const overdueDate = new Date("2026-08-20T00:00:00.000Z");
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("calcule le solde d’une facture après un paiement partiel", () => {
    expect(calculatePaymentBalance(12000000, 4500000)).toEqual({ paidAmount: 4500000, balanceDue: 7500000, isPaid: false });
    expect(calculatePaymentBalance(12000000, 12000000)).toEqual({ paidAmount: 12000000, balanceDue: 0, isPaid: true });
  });

  it("passe une facture en paiement partiel ou payé selon le montant encaissé", () => {
    expect(invoicePaymentStatus(1000000, 300000, overdueDate, "envoye", now)).toBe("partiellement_paye");
    expect(invoicePaymentStatus(1000000, 1000000, overdueDate, "envoye", now)).toBe("paye");
  });

  it("déclenche une alerte seulement pour une facture active dont l’échéance est dépassée", () => {
    expect(isInvoiceOverdue("envoye", overdueDate, now)).toBe(true);
    expect(isInvoiceOverdue("paye", overdueDate, now)).toBe(false);
    expect(isInvoiceOverdue("brouillon", overdueDate, now)).toBe(false);
  });
});
