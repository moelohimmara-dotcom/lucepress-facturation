import { describe, expect, it, vi } from "vitest";
import { IntegrationExecutionBlockedError, listIntegrationAdapters, resolveIntegrationAdapter } from "./integrations/adapterRegistry";

const baseRequest = {
  connectionId: 7,
  providerSlug: "quickbooks-online" as const,
  connectionStatus: "active" as const,
  secretRef: "integrations/quickbooks/connection-7",
  operation: "create_invoice",
  explicitActivation: true,
  approvalId: 18,
};

describe("registre applicatif des adaptateurs", () => {
  it("résout les quatre adaptateurs prioritaires et les maintient désactivés par défaut", () => {
    for (const slug of ["whatsapp-business", "google-workspace", "procore", "quickbooks-online"]) {
      expect(resolveIntegrationAdapter(slug)?.descriptor.executionEnabledByDefault).toBe(false);
    }
    expect(listIntegrationAdapters()).toHaveLength(5);
  });

  it("ne déclenche aucun appel quand la connexion n’est pas explicitement activée", async () => {
    const adapter = resolveIntegrationAdapter("quickbooks-online");
    const dispatch = vi.fn(async () => ({ id: "external-invoice" }));
    await expect(adapter?.execute({ ...baseRequest, explicitActivation: false }, dispatch)).rejects.toBeInstanceOf(IntegrationExecutionBlockedError);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("bloque une connexion non active avant toute exécution externe", async () => {
    const adapter = resolveIntegrationAdapter("procore");
    const dispatch = vi.fn(async () => ({ id: "external-project" }));
    await expect(adapter?.execute({ ...baseRequest, providerSlug: "procore", operation: "sync_project_document", connectionStatus: "credentials_pending" }, dispatch)).rejects.toThrow("activation explicite");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("refuse toute valeur de secret qui n’est pas une référence opaque", async () => {
    const adapter = resolveIntegrationAdapter("whatsapp-business");
    const dispatch = vi.fn(async () => ({ id: "message" }));
    await expect(adapter?.execute({ ...baseRequest, providerSlug: "whatsapp-business", operation: "send_message", secretRef: "EAA-not-a-secret-reference" }, dispatch)).rejects.toThrow("référence de secret opaque");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("exige une approbation humaine avant une écriture métier", async () => {
    const adapter = resolveIntegrationAdapter("google-workspace");
    const dispatch = vi.fn(async () => ({ id: "event" }));
    await expect(adapter?.execute({ ...baseRequest, providerSlug: "google-workspace", operation: "create_calendar_event", approvalId: null }, dispatch)).rejects.toThrow("approbation métier");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("transmet uniquement le contexte autorisé à un exécuteur explicitement activé", async () => {
    const adapter = resolveIntegrationAdapter("quickbooks-online");
    const dispatch = vi.fn(async context => ({ id: `remote-${context.connectionId}` }));
    await expect(adapter?.execute(baseRequest, dispatch)).resolves.toEqual({ id: "remote-7" });
    expect(dispatch).toHaveBeenCalledWith({ connectionId: 7, providerSlug: "quickbooks-online", operation: "create_invoice", secretRef: "integrations/quickbooks/connection-7" });
  });
});
