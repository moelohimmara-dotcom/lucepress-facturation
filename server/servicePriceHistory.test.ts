import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listServicePriceRevisions: vi.fn(async () => [{ id: 7, previousUnitPrice: 200000, nextUnitPrice: 250000, previousTaxRate: 0, nextTaxRate: 18, changedByName: "Responsable Lucepres", createdAt: new Date("2026-08-26") }]) }));
vi.mock("./db", () => ({ listServicePriceRevisions: mocks.listServicePriceRevisions }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 1, openId: "admin-history", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("billing.services.priceHistory", () => {
  it("renvoie les révisions tarifaires de la prestation demandée", async () => {
    const revisions = await appRouter.createCaller(adminContext).billing.services.priceHistory({ serviceId: 9 });
    expect(mocks.listServicePriceRevisions).toHaveBeenCalledWith(9);
    expect(revisions[0]).toMatchObject({ previousUnitPrice: 200000, nextUnitPrice: 250000, nextTaxRate: 18 });
  });
});
