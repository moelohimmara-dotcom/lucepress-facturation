import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getDocumentById: vi.fn(),
    createClientActivity: vi.fn(async () => undefined),
  };
});

vi.mock("./db", () => mocks);

const sendMailMock = vi.fn(async () => ({ messageId: "reminder-1" }));
vi.mock("./_core/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isMailConfigured: () => true,
  getDefaultFrom: () => '"Lucepress" <test@example.com>',
  verifySmtp: async () => true,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDocumentById.mockResolvedValue({
    id: 44,
    kind: "facture",
    number: "FAC-2026-0044",
    status: "envoye",
    balanceDue: 2_500_000,
    clientId: 7,
    clientName: "Client Test",
    clientEmail: "client@example.com",
  });
});

describe("billing.assistant.sendReminderEmail", () => {
  it("envoie la relance SMTP et journalise (rôle cadre)", async () => {
    const caller = appRouter.createCaller(cadreCtx());
    const res = await caller.billing.assistant.sendReminderEmail({
      documentId: 44,
      subject: "Relance facture FAC-2026-0044",
      greeting: "Bonjour,",
      body: "Le solde de 2 500 000 GNF reste dû.",
      closing: "Cordialement,",
    });
    expect(res).toMatchObject({ success: true, emailed: true, to: "client@example.com" });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.com",
      subject: "Relance facture FAC-2026-0044",
    }));
    expect(mocks.createClientActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: "email_envoye",
      title: "Relance envoyée par e-mail",
    }));
  });
});
