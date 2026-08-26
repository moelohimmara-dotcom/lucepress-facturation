import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as unknown[][], insert: vi.fn(), select: vi.fn() }));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      select: state.select,
      insert: state.insert,
    }),
  }),
}));

import { createBalanceInvoiceFromDeposit } from "./db";

describe("persistance de facture de solde", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://lucepress-test";
    state.rows = [];
    state.insert.mockReset();
    state.select.mockImplementation(() => ({ from: () => ({ where: () => { const result = state.rows.shift() ?? []; return { limit: async () => result, then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve) }; } }) }));
  });

  it("réutilise une facture de solde existante sans insérer de doublon", async () => {
    state.rows = [
      [{ id: 21, kind: "facture", invoiceStage: "acompte", relatedDocumentId: 15, total: 3_000_000 }],
      [{ id: 15, kind: "devis", status: "accepte", total: 10_000_000 }],
      [{ amount: 3_000_000 }],
      [{ id: 32, number: "FAC-2026-0032" }],
    ];
    const result = await createBalanceInvoiceFromDeposit(21, 3);
    expect(result).toEqual({ id: 32, number: "FAC-2026-0032", existing: true });
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("conserve la rétro-migration qui classe les acomptes historiques pour le flux de solde", () => {
    const migration = readFileSync("drizzle/0011_backfill_invoice_stages.sql", "utf8");
    expect(migration).toContain("SET `invoiceStage` = 'acompte'");
    expect(migration).toContain("`notes` LIKE 'Facture d’acompte%'");
  });

  it("accepte un acompte historique une fois reclassé pour générer ou réutiliser son solde", async () => {
    const historicalDeposit = { id: 21, kind: "facture", invoiceStage: "standard", relatedDocumentId: 15, total: 3_000_000, notes: "Facture d’acompte de 30% générée à partir du devis DEV-2026-0015." };
    const reclassifiedDeposit = { ...historicalDeposit, invoiceStage: "acompte" as const };
    state.rows = [
      [reclassifiedDeposit],
      [{ id: 15, kind: "devis", status: "accepte", total: 10_000_000 }],
      [{ amount: 3_000_000 }],
      [{ id: 32, number: "FAC-2026-0032" }],
    ];
    const result = await createBalanceInvoiceFromDeposit(reclassifiedDeposit.id, 3);
    expect(result).toEqual({ id: 32, number: "FAC-2026-0032", existing: true });
    expect(state.insert).not.toHaveBeenCalled();
  });
});
