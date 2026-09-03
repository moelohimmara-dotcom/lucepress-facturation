import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    respondToClientPortalQuote: vi.fn(),
    getClientPortalOverview: vi.fn(async () => ({ client: { id: 9, companyName: "Client" }, invoices: [], quotes: [] })),
    getClientPortalQuote: vi.fn(async () => null),
    getClientPortalInvoice: vi.fn(async () => null),
    createClientPaymentPromise: vi.fn(async () => ({ success: true })),
  };
});

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function clientCtx(): TrpcContext {
  return {
    user: { openId: "client-1", email: "client@example.com", role: "client", name: "Client", id: 9 } as any,
    tenantId: 1,
    req: { headers: {}, protocol: "https", get: () => undefined } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.respondToClientPortalQuote.mockResolvedValue({ success: true, status: "accepte", number: "DEV-55" });
});

describe("P1.3 — acceptation devis portail", () => {
  it("transmet la décision du client authentifié", async () => {
    const caller = appRouter.createCaller(clientCtx());
    await expect(caller.billing.clientPortal.respondToQuote({ documentId: 55, decision: "accepte" })).resolves.toMatchObject({
      success: true,
      status: "accepte",
    });
    expect(mocks.respondToClientPortalQuote).toHaveBeenCalledWith({
      email: "client@example.com",
      documentId: 55,
      decision: "accepte",
      createdById: 9,
    });
  });

  it("remonte une erreur métier en BAD_REQUEST", async () => {
    mocks.respondToClientPortalQuote.mockRejectedValueOnce(new Error("Ce devis n’est plus en attente de votre réponse."));
    const caller = appRouter.createCaller(clientCtx());
    await expect(caller.billing.clientPortal.respondToQuote({ documentId: 55, decision: "refuse" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Ce devis n’est plus en attente de votre réponse.",
    });
  });
});
