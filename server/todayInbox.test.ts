import { describe, expect, it } from "vitest";
import { buildTodayInbox, countTodayInboxByPriority } from "../shared/todayInbox";

const now = new Date(2026, 8, 3, 12, 0, 0);

describe("buildTodayInbox", () => {
  it("priorise SMTP, retards, puis devis à envoyer", () => {
    const items = buildTodayInbox({
      now,
      clientCount: 2,
      smtpConfigured: false,
      documents: [
        {
          id: 10,
          kind: "devis",
          number: "DEV-001",
          status: "brouillon",
          clientName: "Alpha",
          total: 1_000_000,
        },
      ],
      receivables: [
        {
          id: 20,
          number: "FAC-001",
          clientName: "Beta",
          balanceDue: 500_000,
          isOverdue: true,
        },
      ],
    });

    expect(items[0]?.id).toBe("smtp-down");
    expect(items.some(item => item.id === "overdue-20")).toBe(true);
    expect(items.some(item => item.id === "quote-send-10")).toBe(true);
    expect(countTodayInboxByPriority(items).urgent).toBeGreaterThanOrEqual(2);
  });

  it("propose la facturation d’un devis accepté sans facture liée", () => {
    const withoutInvoice = buildTodayInbox({
      now,
      clientCount: 1,
      smtpConfigured: true,
      documents: [
        {
          id: 11,
          kind: "devis",
          number: "DEV-011",
          status: "accepte",
          clientName: "Gamma",
          total: 2_000_000,
        },
      ],
    });
    expect(withoutInvoice.some(item => item.id === "quote-invoice-11")).toBe(true);

    const withInvoice = buildTodayInbox({
      now,
      clientCount: 1,
      smtpConfigured: true,
      documents: [
        {
          id: 11,
          kind: "devis",
          number: "DEV-011",
          status: "accepte",
          clientName: "Gamma",
          total: 2_000_000,
        },
        {
          id: 40,
          kind: "facture",
          number: "FAC-040",
          status: "envoye",
          clientName: "Gamma",
          total: 2_000_000,
          relatedDocumentId: 11,
          invoiceStage: "standard",
        },
      ],
    });
    expect(withInvoice.some(item => item.id === "quote-invoice-11")).toBe(false);
  });

  it("signale les rappels du jour et les promesses expirées", () => {
    const items = buildTodayInbox({
      now,
      clientCount: 1,
      smtpConfigured: true,
      documents: [],
      receivables: [
        {
          id: 30,
          number: "FAC-030",
          clientName: "Delta",
          balanceDue: 100_000,
          isOverdue: false,
          collectionReminderDate: new Date(2026, 8, 3, 8, 0, 0),
        },
        {
          id: 31,
          number: "FAC-031",
          clientName: "Epsilon",
          balanceDue: 200_000,
          isOverdue: false,
          paymentPromise: { promisedDate: new Date(2026, 8, 1) },
        },
      ],
    });

    expect(items.some(item => item.id === "reminder-30")).toBe(true);
    expect(items.some(item => item.id === "promise-31")).toBe(true);
  });

  it("reste vide quand il n’y a rien à décider", () => {
    expect(
      buildTodayInbox({
        now,
        clientCount: 1,
        smtpConfigured: true,
        documents: [],
        receivables: [],
      }),
    ).toEqual([]);
  });
});
