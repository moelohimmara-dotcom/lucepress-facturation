import { describe, expect, it } from "vitest";
import { assertOpaqueIntegrationSecretReference, createPreparedIntegrationConnectionValues } from "./integrations/connectionSecurity";

describe("persistance sécurisée des connexions d’intégration", () => {
  it("crée une demande de connexion sans aucune valeur de secret persistable", () => {
    const values = createPreparedIntegrationConnectionValues(14);
    expect(values).toEqual({
      status: "credentials_pending",
      grantedScopes: null,
      secretRef: null,
      lastError: null,
      lastHealthCheckAt: null,
      enabledById: 14,
      connectedAt: null,
    });
    expect(values.secretRef).toBeNull();
    expect(Object.values(values)).not.toContain("Bearer eyJhbGciOiJIUzI1NiJ9");
    expect(Object.values(values)).not.toContain("do-not-persist");
  });

  it("n’accepte qu’une référence opaque venant du coffre de secrets", () => {
    expect(assertOpaqueIntegrationSecretReference("integrations/quickbooks/connection-14")).toBe("integrations/quickbooks/connection-14");
    expect(() => assertOpaqueIntegrationSecretReference("Bearer eyJhbGciOiJIUzI1NiJ9")).toThrow("référence de secret opaque");
  });
});
