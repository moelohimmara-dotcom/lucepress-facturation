import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocumentById: vi.fn(async (id: number) => ({ id, clientId: id + 10, kind: "facture", number: `FAC-2026-00${id}`, clientName: `Client ${id}`, contactName: "Mamadou Diallo", dueDate: "2026-08-15", issueDate: "2026-08-01", balanceDue: 350000 })),
  createClientActivity: vi.fn(async () => ({ id: 1 })),
}));
vi.mock("./db", () => ({ getDocumentById: mocks.getDocumentById, createClientActivity: mocks.createClientActivity }));
vi.mock("./_core/llm", () => ({
  listLLMModels: async () => ({ data: [{ id: "gpt-5-mini" }] }),
  invokeLLM: async () => ({ choices: [{ message: { content: JSON.stringify({ reminders: [
    { documentId: 4, subject: "Relance FAC-2026-004", greeting: "Bonjour Mamadou,", body: "Le solde de 350 000 GNF reste dû.", closing: "Cordialement,\nLucepress", tone: "courtois" },
    { documentId: 8, subject: "Relance FAC-2026-008", greeting: "Bonjour Mamadou,", body: "Le solde de 350 000 GNF reste dû.", closing: "Cordialement,\nLucepress", tone: "courtois" },
  ] }) } }] }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("assistant.prepareBatchReminders", () => {
  it("prépare des brouillons personnalisés et enregistre seulement leur trace d’activité", async () => {
    const ctx = { user: { id: 1, openId: "admin-batch-reminders", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const result = await appRouter.createCaller(ctx).billing.assistant.prepareBatchReminders({ documentIds: [4, 8, 4], tone: "courtois", instruction: "  rappeler le point de contact  " });
    expect(result).toMatchObject({ requiresReview: true, delivery: "brouillons_uniquement" });
    expect(result.reminders.map(reminder => reminder.documentId)).toEqual([4, 8]);
    expect(mocks.getDocumentById).toHaveBeenCalledTimes(2);
    expect(mocks.createClientActivity).toHaveBeenCalledWith(expect.objectContaining({ clientId: 14, documentId: 4, type: "relance_preparee" }));
    expect(mocks.createClientActivity).toHaveBeenCalledWith(expect.objectContaining({ clientId: 18, documentId: 8, type: "relance_preparee" }));
  });
});
