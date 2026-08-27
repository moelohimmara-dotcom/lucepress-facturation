export const COLLECTION_FOLLOW_UP_STATUSES = ["a_traiter", "contacte", "a_rappeler"] as const;
export type CollectionFollowUpStatus = (typeof COLLECTION_FOLLOW_UP_STATUSES)[number];

export const collectionFollowUpLabels: Record<CollectionFollowUpStatus, string> = {
  a_traiter: "À traiter",
  contacte: "Contacté",
  a_rappeler: "À rappeler",
};

export function isCollectionFollowUpStatus(value: string): value is CollectionFollowUpStatus {
  return (COLLECTION_FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

export function isCollectionReportMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function collectionMonthBounds(value: string) {
  if (!isCollectionReportMonth(value)) throw new Error("Le mois du rapport est invalide.");
  const [year, month] = value.split("-").map(Number);
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}
