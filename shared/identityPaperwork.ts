export const IDENTITY_KINDS = [
  "immatriculee",
  "en_immatriculation",
  "personne_physique",
  "sans_immatriculation",
  "autre",
] as const;

export type IdentityKind = (typeof IDENTITY_KINDS)[number];

export const IDENTITY_KIND_LABELS: Record<IdentityKind, string> = {
  immatriculee: "Société immatriculée (NIF / RCCM si connus)",
  en_immatriculation: "Immatriculation en cours",
  personne_physique: "Personne physique / particulier",
  sans_immatriculation: "Activité sans NIF ni RCCM",
  autre: "Autre (préciser en note)",
};

export function isIdentityKind(value: string | null | undefined): value is IdentityKind {
  return (IDENTITY_KINDS as readonly string[]).includes(value ?? "");
}

export function normalizeIdentityKind(value: string | null | undefined): IdentityKind {
  return isIdentityKind(value) ? value : "immatriculee";
}

function joinPresent(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim())).join(" · ");
}

/** Ligne PDF / aperçu : n’affiche que ce qui existe, sinon une mention souple. */
export function formatIdentityRegistrationLine(input: {
  identityKind?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
}) {
  const ids = joinPresent([
    input.taxId?.trim() ? `NIF : ${input.taxId.trim()}` : "",
    input.registrationNumber?.trim() ? `RCCM : ${input.registrationNumber.trim()}` : "",
  ]);
  if (ids) return ids;
  const kind = normalizeIdentityKind(input.identityKind);
  if (kind === "en_immatriculation") return "Immatriculation en cours";
  if (kind === "personne_physique") return "Personne physique";
  if (kind === "sans_immatriculation") return "Activité non immatriculée";
  if (kind === "autre") return "Identifiants à compléter";
  return "";
}

export function isPaperworkMissingField(field: string) {
  return /taxid|nif|rccm|immatricul|registration/i.test(field.replace(/\s/g, ""));
}

export function omitOptionalPaperworkMissingFields(fields: string[]) {
  return fields.filter(field => !isPaperworkMissingField(field));
}
