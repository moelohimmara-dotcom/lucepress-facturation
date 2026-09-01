import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClientActivity: vi.fn(async () => ({ id: 8 })),
  getClientById: vi.fn(async () => ({ id: 2, companyName: "Bati Guinée", contactName: "Mamadou" })),
  listClientActivities: vi.fn(async () => [{ id: "payment-3", clientId: 2, documentId: 5, type: "paiement_enregistre", title: "Paiement de 120 000 GNF enregistré", description: "Facture FAC-2026-0005", createdAt: new Date("2026-08-26") }]),
}));
vi.mock("./db", () => ({ createClientActivity: mocks.createClientActivity, getClientById: mocks.getClientById, listClientActivities: mocks.listClientActivities }));
vi.mock("./_core/llm", () => ({
  listLLMModels: async () => ({ data: [{ id: "gpt-5-mini" }] }),
  invokeLLM: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: "Un paiement partiel a été reçu ; le suivi de facture reste nécessaire.", attentionPoints: ["Solde à vérifier"], nextSteps: ["Préparer un point avec le client"] }) } }] }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx = { user: { id: 1, openId: "admin-history-plus", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("historique client enrichi", () => {
  it("enregistre une note d’appel dans l’historique", async () => {
    await appRouter.createCaller(ctx).billing.clients.activities.createNote({ clientId: 2, title: "Note d’appel", description: "Le client demande un point sur le règlement vendredi." });
    expect(mocks.createClientActivity).toHaveBeenCalledWith(expect.objectContaining({ clientId: 2, type: "note", createdById: 1 }));
  });

  it("prépare une synthèse IA à partir des activités incluant les paiements", async () => {
    const result = await appRouter.createCaller(ctx).billing.assistant.summarizeClientHistory({ clientId: 2 });
    expect(mocks.listClientActivities).toHaveBeenCalledWith(2);
    expect(result.requiresReview).toBe(true);
    expect(result.summary.summary).toContain("paiement partiel");
  });
});
