import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startGoogleWorkspaceOAuth: vi.fn(async () => ({ sessionId: 8, authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=checked", expiresAt: new Date() })),
  decideIntegrationApproval: vi.fn(async () => ({ success: true, status: "approved" })),
}));

vi.mock("./db", () => ({
  startGoogleWorkspaceOAuth: mocks.startGoogleWorkspaceOAuth,
  decideIntegrationApproval: mocks.decideIntegrationApproval,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = { user: { id: 12, openId: "admin-operations", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, tenantId: 1, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("procédures OAuth et approbations d’intégration", () => {
  it("démarre OAuth Google avec les seuls paramètres autorisés et l’administrateur courant", async () => {
    await expect(appRouter.createCaller(adminContext).billing.integrations.startGoogleOauth({ clientId: "client.apps.googleusercontent.com", redirectUri: "https://lucepress.example/callback/google", scopes: ["https://www.googleapis.com/auth/calendar.readonly"] })).resolves.toMatchObject({ sessionId: 8 });
    expect(mocks.startGoogleWorkspaceOAuth).toHaveBeenCalledWith({ clientId: "client.apps.googleusercontent.com", redirectUri: "https://lucepress.example/callback/google", scopes: ["https://www.googleapis.com/auth/calendar.readonly"], userId: 12 });
  });

  it("enregistre une décision d’approbation avec l’administrateur courant", async () => {
    await expect(appRouter.createCaller(adminContext).billing.integrations.decideApproval({ jobId: 31, decision: "approve", note: "Bon à synchroniser" })).resolves.toEqual({ success: true, status: "approved" });
    expect(mocks.decideIntegrationApproval).toHaveBeenCalledWith({ jobId: 31, decision: "approve", note: "Bon à synchroniser", userId: 12 });
  });
});
