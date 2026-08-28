import { describe, expect, it } from "vitest";
import { buildQuoteTemplateDraft, QUOTE_TEMPLATES } from "../shared/quoteTemplates";

describe("modèles de devis multi-services", () => {
  const services = [
    { id: 1, code: "HYD-ETU-001", name: "Étude hydraulique", unit: "forfait", defaultUnitPrice: 250000, defaultTaxRate: 0 },
    { id: 2, code: "HYD-ADD-001", name: "Pose de conduite", unit: "ml", defaultUnitPrice: 50000, defaultTaxRate: 18 },
    { id: 3, code: "HYD-EQP-001", name: "Équipement", unit: "unité", defaultUnitPrice: 700000, defaultTaxRate: 18 },
  ];

  it("propose des modèles BTP et multi-services clairement regroupés", () => {
    expect(QUOTE_TEMPLATES.filter(template => template.sector === "btp").map(template => template.id)).toEqual(["btp_gros_oeuvre", "btp_renovation", "btp_amenagement"]);
    expect(QUOTE_TEMPLATES.filter(template => template.sector === "multiservices").map(template => template.id)).toEqual(["hydraulique", "hygiene", "maintenance"]);
  });

  it("reprend les tarifs configurés du catalogue tout en laissant le brouillon modifiable", () => {
    const draft = buildQuoteTemplateDraft("hydraulique", services);
    expect(draft?.lines).toHaveLength(3);
    expect(draft?.lines[1]).toMatchObject({ description: "Pose de conduite", unit: "ml", unitPrice: 50000, taxRate: 18, serviceId: 2 });
    expect(draft?.notes).toBeUndefined();
  });

  it("préremplit un modèle BTP avec les tarifs validés du catalogue", () => {
    const draft = buildQuoteTemplateDraft("btp_gros_oeuvre", [
      { id: 21, code: "BTP-PRE-001", name: "Préparation et installation de chantier", unit: "forfait", defaultUnitPrice: 125000, defaultTaxRate: 0 },
      { id: 22, code: "BTP-FON-001", name: "Fondations et terrassement préparatoire", unit: "m³", defaultUnitPrice: 275000, defaultTaxRate: 0 },
    ]);
    expect(draft?.lines[0]).toMatchObject({ description: "Préparation et installation de chantier", unitPrice: 125000, serviceId: 21 });
    expect(draft?.lines[1]).toMatchObject({ description: "Fondations et terrassement préparatoire", unitPrice: 275000, serviceId: 22 });
    expect(draft?.lines[2]).toMatchObject({ description: "BTP-ELV-001", unitPrice: 0 });
  });
});
