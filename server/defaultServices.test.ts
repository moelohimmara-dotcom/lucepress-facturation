import { describe, expect, it } from "vitest";
import { getMissingDefaultServices, LUCEPRES_DEFAULT_SERVICES } from "../shared/defaultServices";

describe("catalogue de prestations Lucepres", () => {
  it("propose neuf prestations réparties entre Hydraulique, Hygiène et Maintenance", () => {
    expect(LUCEPRES_DEFAULT_SERVICES).toHaveLength(9);
    expect(new Set(LUCEPRES_DEFAULT_SERVICES.map(service => service.category))).toEqual(new Set(["hydraulique", "hygiene", "maintenance"]));
    expect(LUCEPRES_DEFAULT_SERVICES.every(service => service.defaultUnitPrice === 0 && service.defaultTaxRate === 0)).toBe(true);
  });

  it("ne retourne que les prestations absentes lors d’un nouveau chargement", () => {
    const existingCodes = ["HYD-ETU-001", "HYG-NET-001"];
    const missing = getMissingDefaultServices(existingCodes);
    expect(missing).toHaveLength(7);
    expect(missing.some(service => existingCodes.includes(service.code))).toBe(false);
  });
});
