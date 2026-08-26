import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProcoreProjectAdapter, type IntegrationResult, type ProcoreConnection } from "../../lucepress-procore-adapter.example.js";

const baseConnection: ProcoreConnection = {
  id: 41,
  providerSlug: "procore",
  status: "active",
  grantedCapabilities: ["read_project", "sync_project_document", "create_daily_log"],
  config: {
    companyId: "company-9",
    oauthTokenUrl: "https://login.procore.test/oauth/token",
    clientIdRef: "procore/client-id",
    clientSecretRef: "procore/client-secret",
    accessTokenRef: "procore/access-token",
    refreshTokenRef: "procore/refresh-token",
    accessTokenExpiresAt: 2_000_000,
  },
};

function makeSut(overrides: Partial<{ connection: ProcoreConnection; completed: IntegrationResult | null; mappedProjectId: string | null; projectError: Error; tokenResponse: Response }> = {}) {
  const connection = overrides.connection ?? baseConnection;
  const client = {
    getCompany: vi.fn(async () => ({ id: "company-9", name: "Lucepres Procore" })),
    getProject: vi.fn(async () => ({ id: "project-7", name: "Forage Kamsar", updatedAt: "2026-08-26T12:00:00Z" })),
    createProjectDocument: vi.fn(async () => ({ id: "document-3", version: "v1" })),
    createDailyConstructionReportLog: vi.fn(async () => ({ id: "daily-log-5", version: "v1" })),
  };
  if (overrides.projectError) client.getProject.mockRejectedValue(overrides.projectError);

  const secrets = { get: vi.fn(async (ref: string) => ({ "procore/access-token": "access-live", "procore/client-id": "client", "procore/client-secret": "secret", "procore/refresh-token": "refresh" }[ref] ?? "")), put: vi.fn() };
  const connections = { getActive: vi.fn(async () => connection), updateTokenExpiry: vi.fn(), markDegraded: vi.fn() };
  const idempotency = { getCompleted: vi.fn(async () => overrides.completed ?? null), saveCompleted: vi.fn() };
  const mappings = { getProcoreProjectId: vi.fn(async () => overrides.mappedProjectId ?? null), saveProjectMapping: vi.fn() };
  const clientFactory = { create: vi.fn(() => client) };
  const httpFetch = vi.fn(async () => overrides.tokenResponse ?? new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }), { status: 200 }));
  const adapter = new ProcoreProjectAdapter(secrets, connections, idempotency, mappings, clientFactory, httpFetch, () => 1_000_000);
  return { adapter, client, secrets, connections, idempotency, mappings, clientFactory, httpFetch };
}

const readJob = { id: 1, connectionId: 41, operation: "read_project" as const, idempotencyKey: "procore:project:7:read:1", approvalId: null, payload: { lucepresProjectId: 8, procoreProjectId: "project-7" } };

describe("ProcoreProjectAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valide la santé de la connexion avec la société Procore", async () => {
    const { adapter, client, connections } = makeSut();
    await expect(adapter.healthCheck(41)).resolves.toEqual({ ok: true, externalCompanyId: "company-9" });
    expect(client.getCompany).toHaveBeenCalledWith({ companyId: "company-9" });
    expect(connections.markDegraded).not.toHaveBeenCalled();
  });

  it("renouvelle le jeton OAuth expiré et enregistre sa nouvelle expiration", async () => {
    const expiredConnection = { ...baseConnection, config: { ...baseConnection.config, accessTokenExpiresAt: 0 } };
    const { adapter, secrets, connections, clientFactory, httpFetch } = makeSut({ connection: expiredConnection });
    await adapter.execute(readJob);
    expect(httpFetch).toHaveBeenCalledOnce();
    expect(secrets.put).toHaveBeenCalledWith("procore/access-token", "new-access");
    expect(connections.updateTokenExpiry).toHaveBeenCalledWith(41, 4_600_000);
    expect(clientFactory.create).toHaveBeenCalledWith({ accessToken: "new-access" });
  });

  it("réutilise un résultat idempotent sans appeler Procore", async () => {
    const completed = { externalId: "project-7", status: "completed" as const, rawResponse: { cached: true } };
    const { adapter, clientFactory, idempotency } = makeSut({ completed });
    await expect(adapter.execute(readJob)).resolves.toEqual(completed);
    expect(clientFactory.create).not.toHaveBeenCalled();
    expect(idempotency.saveCompleted).not.toHaveBeenCalled();
  });

  it("bloque un conflit de mapping avant toute écriture externe", async () => {
    const writeJob = { ...readJob, operation: "sync_project_document" as const, approvalId: 14, payload: { ...readJob.payload, title: "PV réception", documentUrl: "https://files.lucepres.test/pv.pdf" } };
    const { adapter, clientFactory } = makeSut({ mappedProjectId: "another-project" });
    await expect(adapter.execute(writeJob)).rejects.toThrow("déjà associé");
    expect(clientFactory.create).not.toHaveBeenCalled();
  });

  it("dégrade la connexion lorsqu’une erreur fournisseur remonte pendant l’exécution", async () => {
    const { adapter, connections } = makeSut({ projectError: new Error("403 Procore") });
    await expect(adapter.execute(readJob)).rejects.toThrow("403 Procore");
    expect(connections.markDegraded).toHaveBeenCalledWith(41, "403 Procore");
  });
});
