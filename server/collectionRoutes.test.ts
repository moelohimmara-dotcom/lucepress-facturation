import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCollectionAssignees: vi.fn(async () => [{ id: 7, name: "Awa Camara", email: "awa@example.com", role: "admin" }]),
  updateCollectionFollowUp: vi.fn(async () => ({ success: true, collectionStatus: "contacte", collectionOwnerId: 7 })),
  reassignCollectionFollowUps: vi.fn(async () => ({ success: true, updatedCount: 2, unchangedCount: 0, collectionOwnerId: 7 })),
  getCollectionMonthlyReport: vi.fn(async (month: string) => ({ month, summary: { activityCount: 3 }, invoices: [], activities: [] })),
}));
vi.mock("./db", () => ({
  listCollectionAssignees: mocks.listCollectionAssignees,
  updateCollectionFollowUp: mocks.updateCollectionFollowUp,
  reassignCollectionFollowUps: mocks.reassignCollectionFollowUps,
  getCollectionMonthlyReport: mocks.getCollectionMonthlyReport,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(role: "admin" | "directeur" | "cadre"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `user-${role}`,
      name: role,
      email: `${role}@example.com`,
      loginMethod: "local",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    tenantId: 1,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("routes de supervision des créances", () => {
  it("renvoie les responsables et transmet une mise à jour de suivi avec l’auteur", async () => {
    const caller = appRouter.createCaller(ctxFor("cadre"));
    await expect(caller.billing.collection.assignees()).resolves.toHaveLength(1);
    await expect(caller.billing.collection.updateFollowUp({ documentId: 12, collectionStatus: "contacte", collectionOwnerId: 7 })).resolves.toMatchObject({ success: true });
    expect(mocks.updateCollectionFollowUp).toHaveBeenCalledWith({ documentId: 12, collectionStatus: "contacte", collectionOwnerId: 7, updatedById: 1 });
  });

  it("produit un rapport pour un mois valide et bloque un format erroné", async () => {
    const caller = appRouter.createCaller(ctxFor("directeur"));
    await expect(caller.billing.collection.monthlyReport({ month: "2026-08" })).resolves.toMatchObject({ month: "2026-08" });
    expect(mocks.getCollectionMonthlyReport).toHaveBeenCalledWith("2026-08");
    await expect(caller.billing.collection.monthlyReport({ month: "08-2026" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("réattribue un lot borné de créances avec l’auteur authentifié", async () => {
    const caller = appRouter.createCaller(ctxFor("directeur"));
    await expect(caller.billing.collection.reassign({ documentIds: [12, 14], collectionOwnerId: 7 })).resolves.toMatchObject({ success: true, updatedCount: 2 });
    expect(mocks.reassignCollectionFollowUps).toHaveBeenCalledWith({ documentIds: [12, 14], collectionOwnerId: 7, updatedById: 1 });
    await expect(caller.billing.collection.reassign({ documentIds: [12, 12], collectionOwnerId: 7 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("P1.2 — directionProcedure sur le pilotage", () => {
  it("refuse réattribution et rapport au cadre", async () => {
    const caller = appRouter.createCaller(ctxFor("cadre"));
    await expect(caller.billing.collection.reassign({ documentIds: [12], collectionOwnerId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.billing.collection.monthlyReport({ month: "2026-08" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("autorise le directeur sur le pilotage tout en laissant le suivi au cadre", async () => {
    const directeur = appRouter.createCaller(ctxFor("directeur"));
    await expect(directeur.billing.collection.reassign({ documentIds: [12], collectionOwnerId: 7 })).resolves.toMatchObject({ success: true });
    const cadre = appRouter.createCaller(ctxFor("cadre"));
    await expect(cadre.billing.collection.updateFollowUp({ documentId: 12, collectionStatus: "a_traiter" })).resolves.toMatchObject({ success: true });
  });
});
