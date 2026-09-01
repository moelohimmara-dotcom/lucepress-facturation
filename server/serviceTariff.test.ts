import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateServiceTariff: vi.fn(async () => ({ success: true })) }));
vi.mock("./db", () => ({ updateServiceTariff: mocks.updateServiceTariff }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 1, openId: "admin-tariff", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("billing.services.updateTariff", () => {
  it("transmet le prix unitaire et la taxe personnalisés au service sécurisé", async () => {
    await appRouter.createCaller(adminContext).billing.services.updateTariff({ id: 12, defaultUnitPrice: 450000, defaultTaxRate: 18 });
    expect(mocks.updateServiceTariff).toHaveBeenCalledWith({ id: 12, defaultUnitPrice: 450000, defaultTaxRate: 18, changedById: 1 });
  });
});
