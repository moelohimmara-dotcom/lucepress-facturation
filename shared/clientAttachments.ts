export const MAX_CLIENT_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const ALLOWED_CLIENT_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export function sanitizeClientAttachmentName(value: string) {
  const name = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return (name || "piece-jointe").slice(0, 180);
}

export function validateClientAttachmentMetadata(contentType: string, size: number) {
  if (!Number.isInteger(size) || size <= 0) return "Aucun fichier reçu.";
  if (size > MAX_CLIENT_ATTACHMENT_SIZE) return "Le fichier dépasse la limite de 20 Mo.";
  if (!ALLOWED_CLIENT_ATTACHMENT_TYPES.has(contentType)) return "Type de fichier non autorisé.";
  return null;
}
