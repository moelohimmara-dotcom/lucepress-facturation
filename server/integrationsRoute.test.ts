import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepareIntegrationConnection: vi.fn(async () => ({ id: 29, status: "credentials_pending", reused: false })),
}));

vi.mock("./db", () => ({ prepareIntegrationConnection: mocks.prepareIntegrationConnection }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = {
  user: { id: 6, openId: "admin-integrations", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} as TrpcContext;

describe("billing.integrations.prepareConnection", () => {
  it("ne transmet au serveur que le fournisseur sélectionné et l’administrateur, jamais un secret brut", async () => {
    const inputWithUnsafeExtra = { providerSlug: "quickbooks-online", rawSecret: "Bearer eyJhbGciOiJIUzI1NiJ9", refreshToken: "do-not-persist" };
    await expect(appRouter.createCaller(adminContext).billing.integrations.prepareConnection(inputWithUnsafeExtra)).resolves.toMatchObject({ id: 29, status: "credentials_pending" });
    expect(mocks.prepareIntegrationConnection).toHaveBeenCalledWith("quickbooks-online", 6);
    expect(mocks.prepareIntegrationConnection.mock.calls[0]).toHaveLength(2);
    expect(JSON.stringify(mocks.prepareIntegrationConnection.mock.calls[0])).not.toContain("Bearer");
    expect(JSON.stringify(mocks.prepareIntegrationConnection.mock.calls[0])).not.toContain("refreshToken");
  });
});
