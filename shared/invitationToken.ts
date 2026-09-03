import { createHash, randomBytes } from "node:crypto";

/** Jeton brut d’invitation (32 octets → 64 hex). */
export const INVITATION_TOKEN_BYTES = 32;

export function createInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("hex");
}

/** Empreinte SHA-256 pour lookup O(1) — le jeton brut n’est jamais stocké. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token.trim().toLowerCase(), "utf8").digest("hex");
}

export function isPlausibleInvitationToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token.trim());
}
