export type ComparableClient = {
  id: number;
  companyName: string;
  email?: string | null;
  phone?: string | null;
};

export type ClientDuplicateCandidate = Omit<ComparableClient, "id">;

function normalizeText(value?: string | null) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.startsWith("224") && digits.length > 9 ? digits.slice(3) : digits;
}

export function findPotentialClientDuplicates<T extends ComparableClient>(clients: T[], candidate: ClientDuplicateCandidate, excludedId?: number) {
  const candidateName = normalizeText(candidate.companyName);
  const candidateEmail = normalizeText(candidate.email);
  const candidatePhone = normalizePhone(candidate.phone);
  return clients.flatMap(client => {
    if (client.id === excludedId) return [];
    const reasons: string[] = [];
    if (candidateName.length > 2 && candidateName === normalizeText(client.companyName)) reasons.push("raison sociale identique");
    if (candidateEmail.length > 3 && candidateEmail === normalizeText(client.email)) reasons.push("e-mail identique");
    if (candidatePhone.length >= 6 && candidatePhone === normalizePhone(client.phone)) reasons.push("téléphone identique");
    return reasons.length ? [{ client, reasons }] : [];
  });
}
