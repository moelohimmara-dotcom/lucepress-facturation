export type IntegrationCategory = "communication" | "collaboration" | "chantier" | "comptabilite";
export type IntegrationTransport = "api" | "mcp";
export type IntegrationAuthType = "oauth2" | "api_key" | "none";
export type IntegrationCapabilityDirection = "lecture" | "ecriture" | "bidirectionnel";
export type IntegrationRiskLevel = "faible" | "moyen" | "eleve";

export type DefaultIntegrationProvider = {
  slug: string;
  name: string;
  category: IntegrationCategory;
  transport: IntegrationTransport;
  documentationUrl: string;
  authType: IntegrationAuthType;
  isSupported: "oui" | "non";
  sortOrder: number;
  capabilities: Array<{
    code: string;
    label: string;
    direction: IntegrationCapabilityDirection;
    riskLevel: IntegrationRiskLevel;
    requiresApproval: "oui" | "non";
  }>;
};

/**
 * Liste blanche initiale. La page d’administration ne peut préparer qu’un
 * fournisseur déclaré ici ; aucun endpoint ni serveur MCP arbitraire n’est accepté.
 */
export const DEFAULT_INTEGRATION_PROVIDERS: DefaultIntegrationProvider[] = [
  {
    slug: "whatsapp-business",
    name: "WhatsApp Business",
    category: "communication",
    transport: "api",
    documentationUrl: "https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 10,
    capabilities: [
      { code: "send_message", label: "Préparer et envoyer un message approuvé", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
      { code: "read_delivery_status", label: "Lire les statuts de livraison", direction: "lecture", riskLevel: "faible", requiresApproval: "non" },
    ],
  },
  {
    slug: "google-workspace",
    name: "Google Workspace",
    category: "collaboration",
    transport: "api",
    documentationUrl: "https://developers.google.com/workspace/calendar/api/guides/overview",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 20,
    capabilities: [
      { code: "archive_document", label: "Archiver un document dans Drive", direction: "ecriture", riskLevel: "moyen", requiresApproval: "oui" },
      { code: "create_calendar_event", label: "Créer une échéance de chantier", direction: "ecriture", riskLevel: "moyen", requiresApproval: "oui" },
      { code: "read_calendar", label: "Lire les échéances autorisées", direction: "lecture", riskLevel: "faible", requiresApproval: "non" },
    ],
  },
  {
    slug: "procore",
    name: "Procore",
    category: "chantier",
    transport: "api",
    documentationUrl: "https://developers.procore.com/documentation/introduction",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 30,
    capabilities: [
      { code: "read_project", label: "Lire un projet de chantier", direction: "lecture", riskLevel: "faible", requiresApproval: "non" },
      { code: "sync_project_document", label: "Synchroniser un document de chantier", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
      { code: "create_daily_log", label: "Créer un rapport journalier", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
    ],
  },
  {
    slug: "quickbooks-online",
    name: "QuickBooks Online",
    category: "comptabilite",
    transport: "api",
    documentationUrl: "https://developer.intuit.com/app/developer/qbo/docs/get-started",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 40,
    capabilities: [
      { code: "read_company", label: "Vérifier la société comptable", direction: "lecture", riskLevel: "faible", requiresApproval: "non" },
      { code: "sync_customer", label: "Synchroniser un client", direction: "ecriture", riskLevel: "moyen", requiresApproval: "oui" },
      { code: "create_invoice", label: "Créer une facture comptable", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
      { code: "record_payment", label: "Enregistrer un paiement comptable", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
    ],
  },
  {
    slug: "workspace-mcp",
    name: "Workspace via MCP",
    category: "collaboration",
    transport: "mcp",
    documentationUrl: "https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture",
    authType: "oauth2",
    isSupported: "non",
    sortOrder: 50,
    capabilities: [
      { code: "discover_tools", label: "Découvrir les outils MCP autorisés", direction: "lecture", riskLevel: "moyen", requiresApproval: "non" },
      { code: "read_context", label: "Lire un contexte de travail autorisé", direction: "lecture", riskLevel: "moyen", requiresApproval: "non" },
    ],
  },
];

export function parseGrantedScopes(serialized: string | null) {
  if (!serialized) return [] as string[];
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) && parsed.every(scope => typeof scope === "string") ? parsed : [];
  } catch {
    return [];
  }
}
