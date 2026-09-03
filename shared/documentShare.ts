import { createHash, randomBytes } from "node:crypto";

/** Durée max d’un lien de consultation guest (90 jours). */
export const DOCUMENT_SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Longueur du jeton brut (32 octets → 64 hex). */
export const DOCUMENT_SHARE_TOKEN_BYTES = 32;

export function createDocumentShareToken(): string {
  return randomBytes(DOCUMENT_SHARE_TOKEN_BYTES).toString("hex");
}

/** Empreinte SHA-256 pour lookup O(1) (le jeton brut n’est jamais stocké). */
export function hashDocumentShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleDocumentShareToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token.trim());
}

export const GUEST_DOCUMENT_INVALID_MESSAGE =
  "Ce lien est invalide, expiré ou n’est plus disponible. Demandez un nouvel envoi à Lucepres.";

export function computeDocumentShareExpiry(input: {
  validUntil?: Date | string | null;
  dueDate?: Date | string | null;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();
  const maxExpiry = new Date(now.getTime() + DOCUMENT_SHARE_TTL_MS);
  const candidates: number[] = [maxExpiry.getTime()];
  if (input.validUntil) {
    const validUntil = new Date(input.validUntil);
    if (!Number.isNaN(validUntil.getTime())) {
      // 14 jours après la fin de validité du devis, plafonné à 90 j.
      candidates.push(Math.min(maxExpiry.getTime(), validUntil.getTime() + 14 * 86_400_000));
    }
  }
  if (input.dueDate) {
    const dueDate = new Date(input.dueDate);
    if (!Number.isNaN(dueDate.getTime())) {
      candidates.push(Math.min(maxExpiry.getTime(), dueDate.getTime() + 60 * 86_400_000));
    }
  }
  return new Date(Math.max(...candidates.filter(value => value >= now.getTime()), now.getTime() + 14 * 86_400_000));
}
