export type QuoteTemplateCategory = "hydraulique" | "hygiene" | "maintenance";

export type QuoteTemplate = {
  id: QuoteTemplateCategory;
  label: string;
  summary: string;
  notes: string;
  serviceCodes: readonly string[];
};

export type QuoteTemplateService = { code: string; name: string; unit: string; defaultUnitPrice: number; defaultTaxRate: number; id?: number };

export const QUOTE_TEMPLATES: readonly QuoteTemplate[] = [
  { id: "hydraulique", label: "Hydraulique", summary: "Diagnostic, adduction et équipements à adapter au site.", notes: "Objet : Intervention hydraulique\n\nPérimètre à confirmer après visite ou validation technique. Les quantités, prix unitaires, délais et conditions restent à valider avant envoi.", serviceCodes: ["HYD-ETU-001", "HYD-ADD-001", "HYD-EQP-001"] },
  { id: "hygiene", label: "Hygiène", summary: "Nettoyage, assainissement et entretien périodique de site.", notes: "Objet : Prestation d’hygiène et d’entretien\n\nLa fréquence, le périmètre, les produits, l’accès au site et les conditions d’intervention restent à valider avant envoi.", serviceCodes: ["HYG-NET-001", "HYG-ASS-001", "HYG-ENT-001"] },
  { id: "maintenance", label: "Maintenance", summary: "Diagnostic, maintenance préventive et réhabilitation d’installation.", notes: "Objet : Intervention de maintenance\n\nLe diagnostic, les pièces éventuelles, le délai d’intervention et les conditions de réception restent à valider avant envoi.", serviceCodes: ["MNT-DIA-001", "MNT-PRE-001", "MNT-REP-001"] },
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
