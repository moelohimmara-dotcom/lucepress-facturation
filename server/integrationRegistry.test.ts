import { describe, expect, it } from "vitest";
import { DEFAULT_INTEGRATION_PROVIDERS, parseGrantedScopes } from "../shared/integrationRegistry";
import { getIntegrationAdapterPreparation } from "../shared/integrationAdapterPreparation";

describe("registre initial d’intégrations", () => {
  it("n’autorise que les fournisseurs explicitement déclarés", () => {
    expect(DEFAULT_INTEGRATION_PROVIDERS.map(provider => provider.slug)).toEqual([
      "whatsapp-business",
      "google-workspace",
      "procore",
      "quickbooks-online",
      "workspace-mcp",
    ]);
  });

  it("marque les écritures comptables et de messagerie comme soumises à validation", () => {
    const writeCapabilities = DEFAULT_INTEGRATION_PROVIDERS.flatMap(provider => provider.capabilities).filter(capability => capability.direction !== "lecture");
    expect(writeCapabilities.every(capability => capability.requiresApproval === "oui")).toBe(true);
  });

  it("lit seulement un tableau de scopes valide", () => {
    expect(parseGrantedScopes('["calendar.readonly","drive.file"]')).toEqual(["calendar.readonly", "drive.file"]);
    expect(parseGrantedScopes('{"scope":"calendar"}')).toEqual([]);
    expect(parseGrantedScopes("invalide")).toEqual([]);
  });

  it("prépare les adaptateurs sans autoriser d’exécution externe prématurée", () => {
    const quickBooks = getIntegrationAdapterPreparation("quickbooks-online");
    expect(quickBooks?.executionPolicy).toBe("validation_humaine");
    expect(quickBooks?.readyForExternalExecution).toBe(false);
    expect(getIntegrationAdapterPreparation("fournisseur-inconnu")).toBeNull();
  });
});
