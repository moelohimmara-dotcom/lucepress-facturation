import { describe, expect, it } from "vitest";
import { formatCompanyBankLine, formatCompanyLegalLine, formatCompanyRegistrationLine, LUCEPRES_PUBLIC_PROFILE } from "../shared/companyProfile";

describe("mentions entreprise dans les PDF", () => {
  const settings = { legalAddress: "Kaloum, Conakry", phone: "+224 600 00 00 00", email: "contact@lucepress.example", website: "lucepress.example", taxId: "NIF-123", registrationNumber: "RCCM-456", bankName: "Banque Guinée", accountName: "Lucepress SARL", accountNumber: "00123456", iban: "GN001", swift: "BGNQGN22" };

  it("compose les coordonnées légales et les identifiants à afficher", () => {
    expect(formatCompanyLegalLine(settings)).toContain("Kaloum, Conakry");
    expect(formatCompanyRegistrationLine(settings)).toBe("NIF : NIF-123 · RCCM : RCCM-456");
  });

  it("compose les coordonnées bancaires sans champs vides", () => {
    expect(formatCompanyBankLine(settings)).toBe("Banque Guinée · Lucepress SARL · Compte : 00123456 · IBAN : GN001 · SWIFT : BGNQGN22");
    expect(formatCompanyBankLine({ bankName: "Banque Guinée" })).toBe("Banque Guinée");
  });

  it("centralise les coordonnées publiques Lucepres sans données fiscales ou bancaires non vérifiées", () => {
    expect(LUCEPRES_PUBLIC_PROFILE).toMatchObject({ legalName: "Lucepres Sarl", location: "Conakry, Guinée", phone: "+224 624 19 06 20", email: "Lucepres@gmail.com" });
    expect(LUCEPRES_PUBLIC_PROFILE.documentFooter).toBe("Solutions durables pour les communautés.");
  });
});
