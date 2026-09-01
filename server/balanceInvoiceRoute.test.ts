import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createBalanceInvoiceFromDeposit: vi.fn(async () => ({ id: 31, number: "FAC-2026-0031", existing: false })) }));
vi.mock("./db", () => ({ createBalanceInvoiceFromDeposit: mocks.createBalanceInvoiceFromDeposit }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 3, openId: "admin-balance", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("billing.documents.createBalanceInvoice", () => {
  it("transmet la facture d’acompte et l’auteur connecté au flux sécurisé", async () => {
    const result = await appRouter.createCaller(adminContext).billing.documents.createBalanceInvoice({ depositInvoiceId: 21 });
    expect(mocks.createBalanceInvoiceFromDeposit).toHaveBeenCalledWith(21, 3);
    expect(result).toMatchObject({ id: 31, number: "FAC-2026-0031", existing: false });
  });
});
