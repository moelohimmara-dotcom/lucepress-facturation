import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getDocumentById: vi.fn(),
    createClientActivity: vi.fn(async () => undefined),
  };
});

vi.mock("./db", () => mocks);

const mailConfigured = vi.hoisted(() => ({ value: true }));
const sendMailMock = vi.fn(async () => ({ messageId: "batch-1" }));
vi.mock("./_core/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isMailConfigured: () => mailConfigured.value,
  getDefaultFrom: () => '"Lucepress" <test@example.com>',
  verifySmtp: async () => mailConfigured.value,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function cadreCtx(): TrpcContext {
  return {
    user: { openId: "cadre", email: "cadre@lucepress.com", role: "cadre", name: "Cadre", id: 2 } as any,
    tenantId: 1,
    req: { headers: {}, protocol: "https", get: () => undefined } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

function invoice(id: number, email: string | null = `client${id}@example.com`) {
  return {
    id,
    kind: "facture" as const,
    number: `FAC-${id}`,
    status: "envoye" as const,
    balanceDue: 1_000_000,
    clientId: id,
    clientName: `Client ${id}`,
    clientEmail: email,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mailConfigured.value = true;
  mocks.getDocumentById.mockImplementation(async (id: number) => {
    if (id === 2) return invoice(2, null);
    return invoice(id);
  });
});

describe("P1.1 — sendBatchReminderEmails", () => {
  it("envoie le lot et journalise chaque succès", async () => {
    const caller = appRouter.createCaller(cadreCtx());
    const res = await caller.billing.assistant.sendBatchReminderEmails({
      reminders: [
        { documentId: 1, subject: "Relance FAC-1", greeting: "Bonjour", body: "Solde dû.", closing: "Cordialement" },
        { documentId: 3, subject: "Relance FAC-3", greeting: "Bonjour", body: "Solde dû.", closing: "Cordialement" },
      ],
    });
    expect(res.sentCount).toBe(2);
    expect(res.failedCount).toBe(0);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(mocks.createClientActivity).toHaveBeenCalledTimes(2);
  });

  it("continue après un échec partiel (e-mail manquant)", async () => {
    const caller = appRouter.createCaller(cadreCtx());
    const res = await caller.billing.assistant.sendBatchReminderEmails({
      reminders: [
        { documentId: 1, subject: "Relance FAC-1", greeting: "Bonjour", body: "Solde dû.", closing: "Cordialement" },
        { documentId: 2, subject: "Relance FAC-2", greeting: "Bonjour", body: "Solde dû.", closing: "Cordialement" },
      ],
    });
    expect(res.sentCount).toBe(1);
    expect(res.failedCount).toBe(1);
    expect(res.failed[0]?.documentId).toBe(2);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("refuse le lot si SMTP est down", async () => {
    mailConfigured.value = false;
    const caller = appRouter.createCaller(cadreCtx());
    await expect(caller.billing.assistant.sendBatchReminderEmails({
      reminders: [
        { documentId: 1, subject: "Relance FAC-1", greeting: "Bonjour", body: "Solde dû.", closing: "Cordialement" },
      ],
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
