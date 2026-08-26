import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  process.env.DATABASE_URL = "mysql://lucepres-test";
  return { catalog: [{ id: 12, code: "HYD-ETU-001", name: "Étude hydraulique", category: "hydraulique", description: null, unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0, isActive: "oui" }] as Array<Record<string, unknown>>, revisions: [] as Array<Record<string, unknown>> };
});

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => {
    const fakeDb = {
      select: (projection?: Record<string, unknown>) => ({
        from: () => projection && "code" in projection ? Promise.resolve(state.catalog.map(service => ({ code: service.code }))) : ({ where: () => ({ limit: async () => state.catalog.map(service => ({ ...service })) }), orderBy: async () => state.catalog }),
      }),
      insert: () => ({ values: async (values: Array<Record<string, unknown>> | Record<string, unknown>) => { if (Array.isArray(values)) state.catalog.push(...values); else state.revisions.push(values); } }),
      update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { Object.assign(state.catalog[0], values); } }) }),
      transaction: async (callback: (tx: typeof fakeDb) => Promise<unknown>) => callback(fakeDb),
    };
    return fakeDb;
  },
}));

import { listServices, updateServiceTariff } from "./db";

describe("persistance des tarifs de prestations", () => {
  it("relit dans le catalogue le prix et la taxe après leur mise à jour", async () => {
    await updateServiceTariff({ id: 12, defaultUnitPrice: 450000, defaultTaxRate: 18, changedById: 1 });
    const services = await listServices();
    expect(services.find(service => service.id === 12)).toMatchObject({ defaultUnitPrice: 450000, defaultTaxRate: 18 });
    expect(state.revisions).toContainEqual(expect.objectContaining({ serviceId: 12, previousUnitPrice: 0, nextUnitPrice: 450000 }));
  });
});
