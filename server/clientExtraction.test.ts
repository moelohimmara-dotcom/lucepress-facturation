import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  listLLMModels: async () => ({ data: [{ id: "gpt-5-mini" }] }),
  invokeLLM: async () => ({ choices: [{ message: { content: JSON.stringify({ companyName: "Bati Guinée", contactName: "Mamadou Diallo", email: "contact@batiguinee.example", phone: "+224 600 11 22 33", address: "Conakry, Ratoma", taxId: "NIF-2026", notes: "Projet de forage à étudier", missingFields: [] }) } }] }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("assistant.extractClient", () => {
  it("retourne une fiche client structurée qui reste à relire avant enregistrement", async () => {
    const ctx = { user: { id: 1, openId: "admin-test", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const result = await appRouter.createCaller(ctx).billing.assistant.extractClient({ text: "Bati Guinée, contact Mamadou Diallo, +224 600 11 22 33, projet de forage à Conakry." });
    expect(result.requiresReview).toBe(true);
    expect(result.client).toMatchObject({ companyName: "Bati Guinée", contactName: "Mamadou Diallo", taxId: "NIF-2026" });
  });
});
