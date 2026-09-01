import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listAllServicePriceRevisions: vi.fn(async () => [{ id: 7, serviceCode: "HYD-001", serviceName: "Étude hydraulique", previousUnitPrice: 200000, nextUnitPrice: 250000, previousTaxRate: 0, nextTaxRate: 18, changedByName: "Responsable Lucepres", createdAt: new Date("2026-08-26") }]) }));
vi.mock("./db", () => ({ listAllServicePriceRevisions: mocks.listAllServicePriceRevisions }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 1, openId: "admin-history-export", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("billing.services.priceHistoryExport", () => {
  it("retourne les révisions de l’ensemble du catalogue à un administrateur", async () => {
    const revisions = await appRouter.createCaller(adminContext).billing.services.priceHistoryExport();
    expect(mocks.listAllServicePriceRevisions).toHaveBeenCalledOnce();
    expect(revisions[0]).toMatchObject({ serviceCode: "HYD-001", serviceName: "Étude hydraulique", nextUnitPrice: 250000 });
  });
});
