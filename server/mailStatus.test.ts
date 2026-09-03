import { beforeEach, describe, expect, it, vi } from "vitest";

const mailConfigured = vi.hoisted(() => ({ value: false }));

vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
});

vi.mock("./db", () => ({
  getDocumentById: vi.fn(async () => ({
    id: 12,
    kind: "devis",
    number: "DEV-1",
    status: "a_envoyer",
    total: 100,
    clientId: 3,
    clientEmail: "a@b.com",
    clientName: "X",
    contactName: "X",
    dueDate: null,
    validUntil: null,
  })),
  getCompanySettings: vi.fn(async () => ({ legalName: "Lucepres", email: "a@b.com" })),
  renderEmailTemplate: vi.fn(async () => ({ subject: "s", html: "<p>x</p>", text: "x" })),
  updateDocumentStatus: vi.fn(),
  createClientActivity: vi.fn(),
}));

const sendMailMock = vi.fn(async () => ({ messageId: "1" }));
vi.mock("./_core/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isMailConfigured: () => mailConfigured.value,
  getDefaultFrom: () => "from@example.com",
  verifySmtp: async () => mailConfigured.value,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function adminCtx(): TrpcContext {
  return {
    user: { openId: "admin", email: "admin@lucepress.com", role: "admin", name: "Admin", id: 1 } as any,
    tenantId: 1,
    req: { headers: {}, protocol: "https", get: () => undefined } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

describe("P0.3 — statut SMTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose smtpConfigured=false et refuse l’envoi", async () => {
    mailConfigured.value = false;
    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.billing.mailStatus()).resolves.toEqual({ smtpConfigured: false });
    await expect(caller.billing.documents.sendByEmail({ id: 12 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(caller.billing.assistant.sendReminderEmail({
      documentId: 12,
      subject: "Relance",
      greeting: "Bonjour",
      body: "Solde dû.",
      closing: "Cordialement",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("expose smtpConfigured=true quand le mailer est prêt", async () => {
    mailConfigured.value = true;
    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.billing.mailStatus()).resolves.toEqual({ smtpConfigured: true });
  });
});
