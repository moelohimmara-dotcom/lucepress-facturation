import type { CollectionFollowUpStatus } from "./collectionFollowUp";

type ReminderInvoice = { collectionStatus?: CollectionFollowUpStatus | null; collectionReminderDate?: Date | string | null; collectionOwnerId?: number | null };
type ReminderAssignee = { id: number; name?: string | null; email?: string | null };

export type CollectionReminderLoad = { ownerId: number | null; ownerName: string; reminderCount: number };

export function buildCollectionReminderLoad(invoices: ReminderInvoice[], assignees: ReminderAssignee[]): CollectionReminderLoad[] {
  const counts = new Map<number | null, number>();
  for (const invoice of invoices) {
    if (invoice.collectionStatus !== "a_rappeler" || !invoice.collectionReminderDate) continue;
    counts.set(invoice.collectionOwnerId ?? null, (counts.get(invoice.collectionOwnerId ?? null) ?? 0) + 1);
  }
  const namedAssignees: CollectionReminderLoad[] = assignees.map(assignee => ({ ownerId: assignee.id, ownerName: assignee.name || assignee.email || `Utilisateur ${assignee.id}`, reminderCount: counts.get(assignee.id) ?? 0 }));
  const unassignedCount = counts.get(null) ?? 0;
  if (unassignedCount) namedAssignees.push({ ownerId: null, ownerName: "Sans responsable", reminderCount: unassignedCount });
  return namedAssignees.sort((left, right) => right.reminderCount - left.reminderCount || left.ownerName.localeCompare(right.ownerName, "fr"));
}
