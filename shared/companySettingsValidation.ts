export type CompanyFinancialDetails = {
  taxId?: string | null;
  registrationNumber?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
};

export type CompanyFinancialField = keyof CompanyFinancialDetails;
export type CompanyFinancialErrors = Partial<Record<CompanyFinancialField, string>>;

function valueOf(value?: string | null) {
  return value?.trim() ?? "";
}

export function validateCompanyFinancialDetails(input: CompanyFinancialDetails): CompanyFinancialErrors {
  const taxId = valueOf(input.taxId);
  const registrationNumber = valueOf(input.registrationNumber);
  const bankName = valueOf(input.bankName);
  const accountName = valueOf(input.accountName);
  const accountNumber = valueOf(input.accountNumber);
  const iban = valueOf(input.iban).replaceAll(" ", "");
  const swift = valueOf(input.swift).toUpperCase();
  const errors: CompanyFinancialErrors = {};

  if (taxId && taxId.length < 2) errors.taxId = "Saisissez au moins 2 caractères, ou laissez le champ vide.";
  if (registrationNumber && registrationNumber.length < 2) errors.registrationNumber = "Saisissez au moins 2 caractères, ou laissez le champ vide.";

  const hasBankDetails = Boolean(bankName || accountName || accountNumber || iban || swift);
  if (hasBankDetails && bankName.length < 2) errors.bankName = "Indiquez le nom de la banque si des coordonnées de règlement sont saisies.";
  if (hasBankDetails && accountName.length < 2) errors.accountName = "Indiquez le titulaire du compte si des coordonnées de règlement sont saisies.";
  if (hasBankDetails && accountNumber.length < 4) errors.accountNumber = "Indiquez un numéro de compte d’au moins 4 caractères.";
  if (iban && !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban.toUpperCase())) errors.iban = "L’IBAN doit contenir 15 à 34 caractères sans espace.";
  if (swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) errors.swift = "Le code SWIFT / BIC doit contenir 8 ou 11 caractères.";

  return errors;
}

export function hasCompanyFinancialErrors(input: CompanyFinancialDetails) {
  return Object.keys(validateCompanyFinancialDetails(input)).length > 0;
}
