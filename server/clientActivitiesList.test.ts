import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listClientActivities: vi.fn(async () => [{ id: "document-5", clientId: 3, documentId: 5, type: "document_genere", title: "Devis DEV-2026-0005 généré", description: "Document brouillon · 500 000 GNF", createdAt: new Date("2026-08-26") }]) }));
vi.mock("./db", () => ({ listClientActivities: mocks.listClientActivities }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("billing.clients.activities.list", () => {
  it("retourne l’historique filtré par fiche client", async () => {
    const ctx = { user: { id: 1, openId: "admin-history", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const activities = await appRouter.createCaller(ctx).billing.clients.activities.list({ clientId: 3 });
    expect(mocks.listClientActivities).toHaveBeenCalledWith(3);
    expect(activities[0]).toMatchObject({ clientId: 3, documentId: 5, type: "document_genere" });
  });
});
