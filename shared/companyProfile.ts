export type CompanyDocumentProfile = {
  legalAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
};

function joinPresent(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim())).join(" · ");
}

export function formatCompanyLegalLine(settings: CompanyDocumentProfile) {
  return joinPresent([settings.legalAddress, settings.phone, settings.email, settings.website]);
}

export function formatCompanyRegistrationLine(settings: CompanyDocumentProfile) {
  return joinPresent([settings.taxId ? `NIF : ${settings.taxId}` : "", settings.registrationNumber ? `RCCM : ${settings.registrationNumber}` : ""]);
}

export function formatCompanyBankLine(settings: CompanyDocumentProfile) {
  return joinPresent([settings.bankName, settings.accountName, settings.accountNumber ? `Compte : ${settings.accountNumber}` : "", settings.iban ? `IBAN : ${settings.iban}` : "", settings.swift ? `SWIFT : ${settings.swift}` : ""]);
}
