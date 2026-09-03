import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchWorkspace: vi.fn(async () => [{ id: 7, kind: "devis", title: "DEV-007", subtitle: "Devis · Bati Guinée", href: "/documents/7" }]),
}));

vi.mock("./db", () => ({ searchWorkspace: mocks.searchWorkspace }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const createContext = (role: "admin" | "cadre") => ({
  user: { id: 3, openId: `workspace-${role}`, name: "Responsable", email: "responsable@lucepress.example", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  tenantId: 1,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
}) as TrpcContext;

describe("billing.workspaceSearch", () => {
  beforeEach(() => mocks.searchWorkspace.mockClear());

  it("réserve la recherche globale au back-office administrateur et transmet une requête normalisée", async () => {
    const result = await appRouter.createCaller(createContext("admin")).billing.workspaceSearch({ query: "  bati  " });

    expect(mocks.searchWorkspace).toHaveBeenCalledWith({ query: "bati", filters: undefined });
    expect(result).toMatchObject([{ id: 7, kind: "devis", href: "/documents/7" }]);
    await expect(appRouter.createCaller(createContext("cadre")).billing.workspaceSearch({ query: "bati" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuse les requêtes dépassant 80 caractères avant tout accès aux données", async () => {
    await expect(appRouter.createCaller(createContext("admin")).billing.workspaceSearch({ query: "a".repeat(81) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.searchWorkspace).toHaveBeenCalledTimes(0);
  });
});
