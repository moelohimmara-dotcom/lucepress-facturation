import { describe, expect, it } from "vitest";
import { buildQuoteTemplateDraft, QUOTE_TEMPLATES } from "../shared/quoteTemplates";

describe("modèles de devis multi-services", () => {
  const services = [
    { id: 1, code: "HYD-ETU-001", name: "Étude hydraulique", unit: "forfait", defaultUnitPrice: 250000, defaultTaxRate: 0 },
    { id: 2, code: "HYD-ADD-001", name: "Pose de conduite", unit: "ml", defaultUnitPrice: 50000, defaultTaxRate: 18 },
    { id: 3, code: "HYD-EQP-001", name: "Équipement", unit: "unité", defaultUnitPrice: 700000, defaultTaxRate: 18 },
  ];

  it("propose un modèle par pôle de services", () => {
    expect(QUOTE_TEMPLATES.map(template => template.id)).toEqual(["hydraulique", "hygiene", "maintenance"]);
  });

  it("reprend les tarifs configurés du catalogue tout en laissant le brouillon modifiable", () => {
    const draft = buildQuoteTemplateDraft("hydraulique", services);
    expect(draft?.lines).toHaveLength(3);
    expect(draft?.lines[1]).toMatchObject({ description: "Pose de conduite", unit: "ml", unitPrice: 50000, taxRate: 18, serviceId: 2 });
    expect(draft?.notes).toBeUndefined();
  });
});
