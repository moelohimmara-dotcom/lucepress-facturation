import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  process.env.DATABASE_URL = "mysql://lucepres-test";
  return { catalog: [{ id: 12, code: "HYD-ETU-001", name: "Étude hydraulique", category: "hydraulique", description: null, unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0, isActive: "oui" }] as Array<Record<string, unknown>> };
});

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: (projection?: Record<string, unknown>) => ({
      from: () => projection && "code" in projection ? Promise.resolve(state.catalog.map(service => ({ code: service.code }))) : ({ orderBy: async () => state.catalog }),
    }),
    insert: () => ({ values: async (values: Array<Record<string, unknown>>) => { state.catalog.push(...values); } }),
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { Object.assign(state.catalog[0], values); } }) }),
  }),
}));

import { listServices, updateServiceTariff } from "./db";

describe("persistance des tarifs de prestations", () => {
  it("relit dans le catalogue le prix et la taxe après leur mise à jour", async () => {
    await updateServiceTariff({ id: 12, defaultUnitPrice: 450000, defaultTaxRate: 18 });
    const services = await listServices();
    expect(services.find(service => service.id === 12)).toMatchObject({ defaultUnitPrice: 450000, defaultTaxRate: 18 });
  });
});
