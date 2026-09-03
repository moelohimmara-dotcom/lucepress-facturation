import { describe, expect, it } from "vitest";
import { validateCompanyFinancialDetails } from "../shared/companySettingsValidation";

describe("validation des coordonnées fiscales et bancaires", () => {
  it("accepte des coordonnées complètes et un identifiant fiscal correctement saisi", () => {
    expect(validateCompanyFinancialDetails({ taxId: "NIF-GN-2026-01", registrationNumber: "RCCM/2026/001", bankName: "Banque Guinée", accountName: "Lucepres Sarl", accountNumber: "0012345678", iban: "GN12ABCD345678901234", swift: "BGNQGN22" })).toEqual({});
    expect(validateCompanyFinancialDetails({ taxId: "en cours", registrationNumber: "" })).toEqual({});
    expect(validateCompanyFinancialDetails({ taxId: "", registrationNumber: "" })).toEqual({});
  });

  it("refuse un bloc bancaire incomplet et des formats de contrôle manifestement invalides", () => {
    const errors = validateCompanyFinancialDetails({ taxId: "!", bankName: "", accountName: "L", accountNumber: "12", iban: "GN12", swift: "INVALID" });
    expect(errors.taxId).toBeTruthy();
    expect(errors.bankName).toBeTruthy();
    expect(errors.accountName).toBeTruthy();
    expect(errors.accountNumber).toBeTruthy();
    expect(errors.iban).toBeTruthy();
    expect(errors.swift).toBeTruthy();
  });
});
