import { assertOpaqueIntegrationSecretReference } from "./connectionSecurity";

export type ManagedProviderSlug = "whatsapp-business" | "google-workspace" | "procore" | "quickbooks-online" | "workspace-mcp";
export type ManagedConnectionStatus = "eligible" | "credentials_pending" | "testing" | "active" | "degraded" | "revoked" | "disabled";

export type AdapterExecutionRequest = {
  connectionId: number;
  providerSlug: ManagedProviderSlug;
  connectionStatus: ManagedConnectionStatus;
  /** Référence opaque au coffre de secrets. Une valeur de secret n’est jamais acceptée ici. */
  secretRef: string | null;
  operation: string;
  explicitActivation: boolean;
  approvalId: number | null;
};

export type AdapterDescriptor = {
  providerSlug: ManagedProviderSlug;
  displayName: string;
  transport: "api" | "mcp";
  supportedOperations: readonly string[];
  requiresHumanApproval: boolean;
  executionEnabledByDefault: false;
};

export class IntegrationExecutionBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationExecutionBlockedError";
  }
}

export interface ManagedIntegrationAdapter {
  readonly descriptor: AdapterDescriptor;
  describe(): AdapterDescriptor;
  execute<T>(request: AdapterExecutionRequest, dispatch: (context: { connectionId: number; providerSlug: ManagedProviderSlug; operation: string; secretRef: string }) => Promise<T>): Promise<T>;
}

function createAdapter(descriptor: AdapterDescriptor): ManagedIntegrationAdapter {
  return {
    descriptor,
    describe: () => descriptor,
    async execute<T>(request: AdapterExecutionRequest, dispatch: (context: { connectionId: number; providerSlug: ManagedProviderSlug; operation: string; secretRef: string }) => Promise<T>): Promise<T> {
      if (request.providerSlug !== descriptor.providerSlug) throw new IntegrationExecutionBlockedError("L’adaptateur sélectionné ne correspond pas à cette connexion.");
      if (!descriptor.supportedOperations.includes(request.operation)) throw new IntegrationExecutionBlockedError("Cette opération n’est pas autorisée par l’adaptateur.");
      if (!request.explicitActivation || request.connectionStatus !== "active") throw new IntegrationExecutionBlockedError("Aucun appel externe n’est permis avant l’activation explicite de la connexion.");
      try {
        if (!request.secretRef) throw new Error();
        assertOpaqueIntegrationSecretReference(request.secretRef);
      } catch {
        throw new IntegrationExecutionBlockedError("Une référence de secret opaque est requise avant toute exécution externe.");
      }
      if (descriptor.requiresHumanApproval && !request.approvalId) throw new IntegrationExecutionBlockedError("Une approbation métier est requise avant cette opération externe.");
      return dispatch({ connectionId: request.connectionId, providerSlug: request.providerSlug, operation: request.operation, secretRef: request.secretRef });
    },
  };
}

const adapters = [
  createAdapter({ providerSlug: "whatsapp-business", displayName: "WhatsApp Business", transport: "api", supportedOperations: ["send_message", "read_delivery_status"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "google-workspace", displayName: "Google Workspace", transport: "api", supportedOperations: ["archive_document", "create_calendar_event", "read_calendar"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "procore", displayName: "Procore", transport: "api", supportedOperations: ["read_project", "sync_project_document", "create_daily_log"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "quickbooks-online", displayName: "QuickBooks Online", transport: "api", supportedOperations: ["read_company", "sync_customer", "create_invoice", "record_payment"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "workspace-mcp", displayName: "Workspace via MCP", transport: "mcp", supportedOperations: ["discover_tools", "read_context"], requiresHumanApproval: false, executionEnabledByDefault: false }),
] as const;

const adaptersBySlug = new Map(adapters.map(adapter => [adapter.descriptor.providerSlug, adapter]));

export function resolveIntegrationAdapter(providerSlug: string): ManagedIntegrationAdapter | null {
  return adaptersBySlug.get(providerSlug as ManagedProviderSlug) ?? null;
}

export function listIntegrationAdapters() {
  return adapters.map(adapter => adapter.describe());
}
