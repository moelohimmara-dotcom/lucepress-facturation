export type QuoteTemplateCategory = "hydraulique" | "hygiene" | "maintenance" | "btp_gros_oeuvre" | "btp_renovation" | "btp_amenagement";
export type QuoteTemplateSector = "btp" | "multiservices";

export type QuoteTemplate = {
  id: QuoteTemplateCategory;
  sector: QuoteTemplateSector;
  label: string;
  summary: string;
  notes: string;
  serviceCodes: readonly string[];
};

export type QuoteTemplateService = { code: string; name: string; unit: string; defaultUnitPrice: number; defaultTaxRate: number; id?: number };

export const QUOTE_TEMPLATES: readonly QuoteTemplate[] = [
  { id: "btp_gros_oeuvre", sector: "btp", label: "Gros œuvre", summary: "Une trame pour préparer, chiffrer et valider les étapes structurelles du chantier.", notes: "Objet : Travaux de gros œuvre\n\nCette trame doit être ajustée après métrés, visite de site et validation technique. Les quantités, prix unitaires, délais, matériaux et conditions restent à valider avant envoi.", serviceCodes: ["BTP-PRE-001", "BTP-FON-001", "BTP-ELV-001", "BTP-GOE-001"] },
  { id: "btp_renovation", sector: "btp", label: "Rénovation", summary: "Un parcours clair de diagnostic, dépose, réhabilitation et réception.", notes: "Objet : Travaux de rénovation\n\nLe périmètre, les métrés, les reprises imprévues, les matériaux et les délais doivent être confirmés avant envoi.", serviceCodes: ["BTP-DIA-001", "BTP-DEP-001", "BTP-REN-001", "BTP-FIN-001"] },
  { id: "btp_amenagement", sector: "btp", label: "Aménagement de site", summary: "Une base pour les accès, réseaux, assainissement et finitions extérieures.", notes: "Objet : Aménagement de site\n\nLes accès, niveaux, évacuations, matériaux et contraintes de chantier sont à confirmer avant envoi.", serviceCodes: ["BTP-IMP-001", "BTP-ASS-001", "BTP-ACC-001", "BTP-EXT-001"] },
  { id: "hydraulique", sector: "multiservices", label: "Hydraulique", summary: "Diagnostic, adduction et équipements à adapter au site.", notes: "Objet : Intervention hydraulique\n\nPérimètre à confirmer après visite ou validation technique. Les quantités, prix unitaires, délais et conditions restent à valider avant envoi.", serviceCodes: ["HYD-ETU-001", "HYD-ADD-001", "HYD-EQP-001"] },
  { id: "hygiene", sector: "multiservices", label: "Hygiène", summary: "Nettoyage, assainissement et entretien périodique de site.", notes: "Objet : Prestation d’hygiène et d’entretien\n\nLa fréquence, le périmètre, les produits, l’accès au site et les conditions d’intervention restent à valider avant envoi.", serviceCodes: ["HYG-NET-001", "HYG-ASS-001", "HYG-ENT-001"] },
  { id: "maintenance", sector: "multiservices", label: "Maintenance", summary: "Diagnostic, maintenance préventive et réhabilitation d’installation.", notes: "Objet : Intervention de maintenance\n\nLe diagnostic, les pièces éventuelles, le délai d’intervention et les conditions de réception restent à valider avant envoi.", serviceCodes: ["MNT-DIA-001", "MNT-PRE-001", "MNT-REP-001"] },
];

export function buildQuoteTemplateDraft(templateId: QuoteTemplateCategory, services: readonly QuoteTemplateService[]) {
  const template = QUOTE_TEMPLATES.find(item => item.id === templateId);
  if (!template) return null;
  const serviceByCode = new Map(services.map(service => [service.code, service]));
  return {
    template,
    lines: template.serviceCodes.map(code => {
      const service = serviceByCode.get(code);
      return {
        description: service?.name || code,
        quantity: 1,
        unit: service?.unit || "unité",
        unitPrice: service?.defaultUnitPrice || 0,
        taxRate: service?.defaultTaxRate || 0,
        serviceId: service?.id,
      };
    }),
  };
}
