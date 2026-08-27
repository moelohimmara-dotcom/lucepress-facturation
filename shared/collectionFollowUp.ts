export const COLLECTION_FOLLOW_UP_STATUSES = ["a_traiter", "contacte", "a_rappeler"] as const;
export type CollectionFollowUpStatus = (typeof COLLECTION_FOLLOW_UP_STATUSES)[number];

export const collectionFollowUpLabels: Record<CollectionFollowUpStatus, string> = {
  a_traiter: "À traiter",
  contacte: "Contacté",
  a_rappeler: "À rappeler",
};

export type CollectionStatusSlice = { status: CollectionFollowUpStatus; count: number; percentage: number };

export function getCollectionStatusDistribution(statusCounts: Record<CollectionFollowUpStatus, number>): CollectionStatusSlice[] {
  const total = COLLECTION_FOLLOW_UP_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0);
  return COLLECTION_FOLLOW_UP_STATUSES.map(status => ({ status, count: statusCounts[status], percentage: total ? Math.round((statusCounts[status] / total) * 100) : 0 }));
}

export function isCollectionFollowUpStatus(value: string): value is CollectionFollowUpStatus {
  return (COLLECTION_FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

export function normalizeCollectionReminderDate(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) throw new Error("La date de rappel est invalide.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("La date de rappel est invalide.");
  return date;
}

export function validateCollectionReminder(status: CollectionFollowUpStatus, reminderDate: Date | null, now = new Date()) {
  if (status !== "a_rappeler") return null;
  if (!reminderDate) return "Choisissez une date de rappel pour ce statut.";
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (reminderDate < today) return "La date de rappel doit être aujourd’hui ou ultérieure.";
  return null;
}

export function isCollectionReportMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function collectionMonthBounds(value: string) {
  if (!isCollectionReportMonth(value)) throw new Error("Le mois du rapport est invalide.");
  const [year, month] = value.split("-").map(Number);
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}
