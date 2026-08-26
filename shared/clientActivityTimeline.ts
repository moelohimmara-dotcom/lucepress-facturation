export type ClientActivityRecord = { id: number; clientId: number; documentId: number | null; type: "relance_preparee" | "note"; title: string; description: string | null; createdAt: Date };
export type ClientDocumentRecord = { id: number; kind: "devis" | "facture"; number: string; total: number; status: string; createdAt: Date };

export function buildClientActivityTimeline(clientId: number, documents: ClientDocumentRecord[], activities: ClientActivityRecord[]) {
  const documentEvents = documents.map(document => ({
    id: `document-${document.id}`,
    clientId,
    documentId: document.id,
    type: "document_genere" as const,
    title: `${document.kind === "facture" ? "Facture" : "Devis"} ${document.number} généré`,
    description: `Document ${document.status.replaceAll("_", " ")} · ${document.total.toLocaleString("fr-GN")} GNF`,
    createdAt: document.createdAt,
  }));
  const reminderEvents = activities.map(activity => ({ ...activity, id: `activity-${activity.id}` }));
  return [...documentEvents, ...reminderEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
