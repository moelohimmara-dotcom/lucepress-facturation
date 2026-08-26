export type IntegrationAdapterPreparation = {
  providerSlug: string;
  mode: "api" | "mcp";
  activationChecklist: string[];
  executionPolicy: "validation_humaine" | "lecture_seulement";
  readyForExternalExecution: false;
};

/**
 * Contrats préparatoires utilisés par le centre d’intégrations. Ils décrivent le
 * prérequis d’activation sans contenir de jeton, endpoint libre ou action externe.
 */
export const INTEGRATION_ADAPTER_PREPARATIONS: IntegrationAdapterPreparation[] = [
  {
    providerSlug: "whatsapp-business",
    mode: "api",
    activationChecklist: ["Compte WhatsApp Business vérifié", "Modèles de messages validés", "Secret webhook configuré côté serveur"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false,
  },
  {
    providerSlug: "google-workspace",
    mode: "api",
    activationChecklist: ["Application OAuth enregistrée", "Scopes Drive et Calendar minimisés", "Compte administrateur autorisé"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false,
  },
  {
    providerSlug: "procore",
    mode: "api",
    activationChecklist: ["Application Procore approuvée", "Société et projets mappés", "Droits d’écriture chantier confirmés"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false,
  },
  {
    providerSlug: "quickbooks-online",
    mode: "api",
    activationChecklist: ["Application Intuit autorisée", "Société comptable sélectionnée", "Règles de rapprochement validées"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false,
  },
  {
    providerSlug: "workspace-mcp",
    mode: "mcp",
    activationChecklist: ["Serveur MCP inscrit sur liste blanche", "Capacités découvertes et approuvées", "Politique lecture seule confirmée"],
    executionPolicy: "lecture_seulement",
    readyForExternalExecution: false,
  },
];

export function getIntegrationAdapterPreparation(providerSlug: string) {
  return INTEGRATION_ADAPTER_PREPARATIONS.find(item => item.providerSlug === providerSlug) ?? null;
}
