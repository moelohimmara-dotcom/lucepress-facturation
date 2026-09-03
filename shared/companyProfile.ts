import { formatIdentityRegistrationLine } from "./identityPaperwork";

export type CompanyDocumentProfile = {
  legalAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  identityKind?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
};

export const LUCEPRES_PUBLIC_PROFILE = {
  displayName: "Lucepres",
  legalName: "Lucepres Sarl",
  location: "Conakry, Guinée",
  phone: "+224 624 19 06 20",
  email: "Lucepres@gmail.com",
  positioning: "Solutions durables",
  documentFooter: "Solutions durables pour les communautés.",
} as const;

export function formatCompanyDocumentFooter(customFooter?: string | null) {
  const footer = customFooter?.trim();
  if (!footer) return LUCEPRES_PUBLIC_PROFILE.documentFooter;
  if (footer.includes(LUCEPRES_PUBLIC_PROFILE.documentFooter)) return footer;
  return `${LUCEPRES_PUBLIC_PROFILE.documentFooter} · ${footer}`;
}

function joinPresent(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim())).join(" · ");
}

export function formatCompanyLegalLine(settings: CompanyDocumentProfile) {
  return joinPresent([settings.legalAddress, settings.phone, settings.email, settings.website]);
}

export function formatCompanyRegistrationLine(settings: CompanyDocumentProfile) {
  return formatIdentityRegistrationLine(settings);
}

export function formatCompanyBankLine(settings: CompanyDocumentProfile) {
  return joinPresent([settings.bankName, settings.accountName, settings.accountNumber ? `Compte : ${settings.accountNumber}` : "", settings.iban ? `IBAN : ${settings.iban}` : "", settings.swift ? `SWIFT : ${settings.swift}` : ""]);
}
