import { describe, expect, it, vi } from "vitest";
import { integrationAuditLogs, integrationCapabilities, integrationConnections, integrationProviders } from "../drizzle/schema";

const state = vi.hoisted(() => {
  process.env.DATABASE_URL = "mysql://lucepress-integrations-test";
  return {
    providers: [{ id: 4, slug: "quickbooks-online", name: "QuickBooks Online", category: "comptabilite", transport: "api", documentationUrl: null, authType: "oauth2", isSupported: "oui", sortOrder: 40 }],
    connections: [] as Array<Record<string, unknown>>,
    audit: [] as Array<Record<string, unknown>>,
  };
});

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => {
    const fakeDb: any = {
      select: (projection?: Record<string, unknown>) => ({
        from: (table: unknown) => {
          if (table === integrationProviders && projection && "slug" in projection) return Promise.resolve(state.providers);
          const rows = table === integrationProviders ? state.providers : table === integrationConnections ? state.connections : [];
          return {
            where: () => ({ limit: async () => rows.slice(0, 1) }),
            orderBy: async () => rows,
          };
        },
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          if (table === integrationConnections) {
            state.connections.push({ id: state.connections.length + 1, ...values });
            return Promise.resolve([{ insertId: state.connections.length }]);
          }
          if (table === integrationAuditLogs) {
            state.audit.push(values);
            return Promise.resolve([{ insertId: state.audit.length }]);
          }
          return { onDuplicateKeyUpdate: async () => undefined };
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            if (table === integrationConnections && state.connections[0]) Object.assign(state.connections[0], values);
          },
        }),
      }),
      transaction: async (callback: (tx: any) => Promise<unknown>) => callback(fakeDb),
    };
    return fakeDb;
  },
}));

vi.mock("./integrations/adapterRegistry", () => ({ resolveIntegrationAdapter: () => ({ describe: () => ({ providerSlug: "quickbooks-online" }) }) }));

import { activateIntegrationConnection, prepareIntegrationConnection } from "./db";

describe("persistance des connexions d’intégration", () => {
  it("prépare une connexion avec secretRef nulle et sans secret brut", async () => {
    state.connections = [];
    state.audit = [];
    await expect(prepareIntegrationConnection("quickbooks-online", 9)).resolves.toMatchObject({ id: 1, status: "credentials_pending" });
    expect(state.connections[0]).toMatchObject({ status: "credentials_pending", secretRef: null, enabledById: 9 });
    expect(JSON.stringify(state.connections[0])).not.toContain("Bearer");
    expect(JSON.stringify(state.connections[0])).not.toContain("refreshToken");
    expect(state.audit[0]).toMatchObject({ action: "connection_prepared" });
  });

  it("rejette une référence non opaque puis ne persiste qu’une référence conforme", async () => {
    state.connections = [{ id: 1, providerId: 4, status: "credentials_pending", secretRef: null }];
    await expect(activateIntegrationConnection({ connectionId: 1, secretRef: "raw-refresh-token", grantedScopes: ["accounting"], userId: 9 })).rejects.toThrow("référence de secret opaque");
    expect(state.connections[0]).toMatchObject({ status: "credentials_pending", secretRef: null });

    await expect(activateIntegrationConnection({ connectionId: 1, secretRef: "integrations/quickbooks/connection-1", grantedScopes: ["accounting"], userId: 9 })).resolves.toEqual({ success: true });
    expect(state.connections[0]).toMatchObject({ status: "testing", secretRef: "integrations/quickbooks/connection-1", grantedScopes: '["accounting"]' });
  });
});
