export const BATCH_REMINDER_LIMIT = 20;

export type ReminderTone = "courtois" | "ferme";

export function normalizeBatchReminderDocumentIds(documentIds: number[]) {
  const uniqueIds = documentIds.filter((documentId, index) => documentIds.indexOf(documentId) === index);
  if (!uniqueIds.length) throw new Error("Sélectionnez au moins une facture à relancer.");
  if (uniqueIds.length > BATCH_REMINDER_LIMIT) throw new Error(`La préparation groupée est limitée à ${BATCH_REMINDER_LIMIT} factures à la fois.`);
  return uniqueIds;
}

export function normalizeBatchReminderInstruction(value?: string) {
  const instruction = value?.trim();
  return instruction ? instruction : undefined;
}
