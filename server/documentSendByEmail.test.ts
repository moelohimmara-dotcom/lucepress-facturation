import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getDocumentById: vi.fn(),
    getCompanySettings: vi.fn(async () => ({
      legalName: "Lucepres Sarl",
      email: "Lucepres@gmail.com",
    })),
    updateDocumentStatus: vi.fn(async () => undefined),
    createClientActivity: vi.fn(async () => undefined),
    renderEmailTemplate: vi.fn(async (_slug: string, vars: Record<string, string>) => ({
      subject: `Document ${vars.documentNumber}`,
      html: `<p>${vars.clientName}</p>`,
      text: vars.clientName,
    })),
  };
});

vi.mock("./db", () => mocks);

const sendMailMock = vi.fn(async () => ({ messageId: "doc-mail-1" }));
vi.mock("./_core/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isMailConfigured: () => true,
  getDefaultFrom: () => '"Lucepress" <test@example.com>',
  verifySmtp: async () => true,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function adminCtx(): TrpcContext {
  return {
    user: { openId: "admin", email: "admin@lucepress.com", role: "admin", name: "Admin", id: 1 } as any,
    tenantId: 1,
    req: {
      headers: {},
      protocol: "https",
      get: (name: string) => (name === "host" ? "lucepress.example" : undefined),
    } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDocumentById.mockResolvedValue({
    id: 12,
    kind: "devis",
    number: "DEV-2026-0012",
    status: "a_envoyer",
    total: 1_500_000,
    dueDate: null,
    validUntil: "2026-09-30",
    clientId: 3,
    clientName: "Bati Guinée",
    contactName: "Mamadou",
    clientEmail: "client@bati.example",
  });
});

describe("billing.documents.sendByEmail", () => {
  it("envoie le devis, passe le statut à envoye et journalise l’activité", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const res = await caller.billing.documents.sendByEmail({ id: 12 });
    expect(res).toMatchObject({ success: true, emailed: true, to: "client@bati.example", status: "envoye" });
    expect(mocks.renderEmailTemplate).toHaveBeenCalledWith("quote-sent", expect.objectContaining({
      documentNumber: "DEV-2026-0012",
      clientName: "Mamadou",
    }));
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "client@bati.example" }));
    expect(mocks.updateDocumentStatus).toHaveBeenCalledWith(12, "envoye");
    expect(mocks.createClientActivity).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 3,
      documentId: 12,
      type: "note",
    }));
  });

  it("refuse sans e-mail client", async () => {
    mocks.getDocumentById.mockResolvedValueOnce({
      id: 12,
      kind: "facture",
      number: "FAC-1",
      status: "brouillon",
      total: 100,
      clientId: 3,
      clientName: "X",
      contactName: null,
      clientEmail: null,
    });
    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.billing.documents.sendByEmail({ id: 12 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
