import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createDepositInvoiceFromQuote: vi.fn(async () => ({ id: 21, number: "FAC-2026-0021", existing: false })) }));
vi.mock("./db", () => ({ createDepositInvoiceFromQuote: mocks.createDepositInvoiceFromQuote }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 3, openId: "admin-deposit", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("billing.documents.createDepositInvoice", () => {
  it("demande une facture d’acompte pour un devis avec l’auteur connecté", async () => {
    const result = await appRouter.createCaller(adminContext).billing.documents.createDepositInvoice({ quoteId: 15 });
    expect(mocks.createDepositInvoiceFromQuote).toHaveBeenCalledWith(15, 3);
    expect(result).toMatchObject({ id: 21, number: "FAC-2026-0021", existing: false });
  });
});
