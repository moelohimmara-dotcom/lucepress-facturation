import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocumentById: vi.fn(async () => ({ id: 4, clientId: 3, kind: "facture", number: "FAC-2026-0004", clientName: "Bati Guinée", contactName: "Mamadou Diallo", clientEmail: "contact@bati.example", issueDate: "2026-08-01", dueDate: "2026-08-15", balanceDue: 350000 })),
  createClientActivity: vi.fn(async () => ({ id: 1 })),
}));
vi.mock("./db", () => ({ getDocumentById: mocks.getDocumentById, createClientActivity: mocks.createClientActivity }));
vi.mock("./_core/llm", () => ({
  listLLMModels: async () => ({ data: [{ id: "gpt-5-mini" }] }),
  invokeLLM: async () => ({ choices: [{ message: { content: JSON.stringify({ subject: "Relance facture FAC-2026-0004", greeting: "Bonjour Mamadou,", body: "Sauf erreur, un solde de 350 000 GNF reste dû.", closing: "Cordialement,\nLucepress", tone: "courtois" }) } }] }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("assistant.generateReminder", () => {
  it("prépare un modèle de relance à relire sans envoyer d’e-mail", async () => {
    const ctx = { user: { id: 1, openId: "admin-reminder", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const result = await appRouter.createCaller(ctx).billing.assistant.generateReminder({ documentId: 4, tone: "courtois" });
    expect(result.requiresReview).toBe(true);
    expect(result.reminder.subject).toContain("FAC-2026-0004");
    expect(mocks.getDocumentById).toHaveBeenCalledWith(4);
    expect(mocks.createClientActivity).toHaveBeenCalledWith(expect.objectContaining({ clientId: 3, documentId: 4, type: "relance_preparee" }));
  });
});
