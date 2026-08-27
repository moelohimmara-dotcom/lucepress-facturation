import { sanitizeClientAttachmentName } from "./clientAttachments";

export const MAX_PROJECT_COST_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const ALLOWED_PROJECT_COST_ATTACHMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function sanitizeProjectCostAttachmentName(value: string) {
  return sanitizeClientAttachmentName(value);
}

export function validateProjectCostAttachmentMetadata(contentType: string, size: number) {
  if (!Number.isInteger(size) || size <= 0) return "Aucun fichier reçu.";
  if (size > MAX_PROJECT_COST_ATTACHMENT_SIZE) return "Le justificatif dépasse la limite de 10 Mo.";
  if (!ALLOWED_PROJECT_COST_ATTACHMENT_TYPES.has(contentType)) return "Seuls les fichiers PDF, JPEG, PNG et WebP sont autorisés.";
  return null;
}
