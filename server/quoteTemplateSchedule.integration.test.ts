import { describe, expect, it, vi } from "vitest";
import { buildQuoteTemplateDraft } from "../shared/quoteTemplates";

const mocks = vi.hoisted(() => ({ createDocument: vi.fn(async () => ({ id: 44, number: "DEV-2026-0044", totals: { subtotal: 0, taxTotal: 0, total: 0 } })) }));
vi.mock("./db", () => ({ createDocument: mocks.createDocument }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 4, openId: "admin-template", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("modèle de devis avec échéancier", () => {
  it("enregistre les lignes personnalisables d’un modèle et les dates d’acompte et solde", async () => {
    const draft = buildQuoteTemplateDraft("hydraulique", [
      { id: 1, code: "HYD-ETU-001", name: "Étude hydraulique", unit: "forfait", defaultUnitPrice: 250000, defaultTaxRate: 0 },
      { id: 2, code: "HYD-ADD-001", name: "Pose de conduite", unit: "ml", defaultUnitPrice: 50000, defaultTaxRate: 0 },
      { id: 3, code: "HYD-EQP-001", name: "Équipement", unit: "unité", defaultUnitPrice: 700000, defaultTaxRate: 18 },
    ]);
    expect(draft).not.toBeNull();
    const lines = draft!.lines.map(line => ({ ...line, quantity: line.description === "Pose de conduite" ? 25 : line.quantity }));

    await appRouter.createCaller(adminContext).billing.documents.create({
      kind: "devis", clientId: 8, issueDate: "2026-08-26", validUntil: "2026-09-26", status: "brouillon",
      depositPercent: 30, depositDueDate: "2026-08-31", balanceDueDate: "2026-09-26", notes: draft!.template.notes, lines,
    });

    expect(mocks.createDocument).toHaveBeenCalledWith(expect.objectContaining({
      kind: "devis", depositPercent: 30, depositDueDate: "2026-08-31", balanceDueDate: "2026-09-26",
      lines: expect.arrayContaining([expect.objectContaining({ description: "Pose de conduite", quantity: 25, unitPrice: 50000 })]),
    }));
  });
});
