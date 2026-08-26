import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ catalog: [{ id: 12, code: "HYD-ETU-001", name: "Étude hydraulique", category: "hydraulique", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 }] }));
const mocks = vi.hoisted(() => ({
  updateServiceTariff: vi.fn(async ({ id, defaultUnitPrice, defaultTaxRate }: { id: number; defaultUnitPrice: number; defaultTaxRate: number }) => {
    Object.assign(state.catalog.find(service => service.id === id)!, { defaultUnitPrice, defaultTaxRate });
    return { success: true };
  }),
  listServices: vi.fn(async () => state.catalog),
}));
vi.mock("./db", () => ({ updateServiceTariff: mocks.updateServiceTariff, listServices: mocks.listServices }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 1, openId: "admin-tariff-read", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("tarif personnalisé du catalogue", () => {
  it("met à jour puis relit le même tarif via les procédures tRPC", async () => {
    const caller = appRouter.createCaller(adminContext);
    await caller.billing.services.updateTariff({ id: 12, defaultUnitPrice: 450000, defaultTaxRate: 18 });
    const catalog = await caller.billing.services.list();
    expect(catalog).toEqual([expect.objectContaining({ id: 12, defaultUnitPrice: 450000, defaultTaxRate: 18 })]);
  });
});
