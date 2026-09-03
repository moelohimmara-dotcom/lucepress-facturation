import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getClientById: vi.fn(),
    getUserByEmail: vi.fn(),
    listInvitations: vi.fn(async () => []),
    revokeInvitation: vi.fn(async () => undefined),
    createInvitation: vi.fn(async () => ({ id: 1 })),
    createClientActivity: vi.fn(async () => ({ id: 1 })),
    renderEmailTemplate: vi.fn(async () => ({ subject: "Invitation", html: "<p>x</p>", text: "x" })),
    getClientPortalOverview: vi.fn(async (email: string) => ({
      client: email === "client@bati.example" ? { id: 3, companyName: "Bati" } : null,
      invoices: email === "client@bati.example" ? [{ id: 10, number: "FAC-1", clientId: 3, kind: "facture", balanceDue: 1000 }] : [],
      quotes: [],
    })),
    listDocuments: vi.fn(async () => []),
    INVITATION_TTL_MS: 72 * 60 * 60 * 1000,
  };
});

vi.mock("./db", () => mocks);

const sendMailMock = vi.fn(async () => ({ messageId: "inv-1" }));
vi.mock("./_core/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isMailConfigured: () => true,
  getDefaultFrom: () => '"Lucepress" <test@example.com>',
  verifySmtp: async () => true,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(role: "admin" | "directeur" | "cadre" | "client", email = `${role}@lucepress.com`, id = 2): TrpcContext {
  return {
    user: { openId: role, email, role, name: role, id } as any,
    tenantId: 1,
    req: { headers: {}, protocol: "https", get: (name: string) => (name === "host" ? "lucepress.example" : undefined) } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClientById.mockResolvedValue({ id: 3, companyName: "Bati", email: "client@bati.example" });
  mocks.getUserByEmail.mockResolvedValue(undefined);
});

describe("P0.2 — invitation portail", () => {
  it("un cadre invite le client par e-mail (rôle client)", async () => {
    const caller = appRouter.createCaller(ctxFor("cadre"));
    const res = await caller.billing.clients.invitePortal({ clientId: 3 });
    expect(res.success).toBe(true);
    expect(res.alreadyHasAccess).toBe(false);
    expect(res.email).toBe("client@bati.example");
    expect(mocks.createInvitation).toHaveBeenCalledWith(expect.objectContaining({ role: "client", email: "client@bati.example" }));
    expect(sendMailMock).toHaveBeenCalled();
    expect(mocks.createClientActivity).toHaveBeenCalledWith(expect.objectContaining({ title: "Invitation portail client", type: "email_envoye" }));
  });

  it("refuse sans e-mail sur la fiche", async () => {
    mocks.getClientById.mockResolvedValueOnce({ id: 3, companyName: "Bati", email: null });
    const caller = appRouter.createCaller(ctxFor("cadre"));
    await expect(caller.billing.clients.invitePortal({ clientId: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("l’admin ne crée pas un compte portail via users.invite", async () => {
    const caller = appRouter.createCaller(ctxFor("admin", "admin@lucepress.com", 1));
    await expect(caller.users.invite({ email: "x@y.com", role: "client" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("P0.2 — un compte client n’a pas les APIs staff", () => {
  it("FORBIDDEN sur devis/factures, OK sur aperçu portail", async () => {
    const caller = appRouter.createCaller(ctxFor("client", "client@bati.example", 9));
    await expect(caller.billing.documents.list({ kind: "facture" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const overview = await caller.billing.clientPortal.overview();
    expect(overview.client).toMatchObject({ id: 3, companyName: "Bati" });
    expect(overview.invoices).toHaveLength(1);
  });
});
