export type ClientActivityRecord = { id: number; clientId: number; documentId: number | null; type: "relance_preparee" | "note" | "statut_recouvrement" | "responsable_recouvrement"; title: string; description: string | null; createdAt: Date };
export type ClientDocumentRecord = { id: number; kind: "devis" | "facture"; number: string; total: number; status: string; createdAt: Date };
export type ClientPaymentRecord = { id: number; documentId: number; documentNumber: string; amount: number; method: string; reference: string | null; paidAt: Date; createdAt: Date };

export function buildClientActivityTimeline(clientId: number, documents: ClientDocumentRecord[], activities: ClientActivityRecord[], payments: ClientPaymentRecord[] = []) {
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
  const paymentEvents = payments.map(payment => ({
    id: `payment-${payment.id}`,
    clientId,
    documentId: payment.documentId,
    type: "paiement_enregistre" as const,
    title: `Paiement de ${payment.amount.toLocaleString("fr-GN")} GNF enregistré`,
    description: `Facture ${payment.documentNumber} · ${payment.method.replaceAll("_", " ")}${payment.reference ? ` · Réf. ${payment.reference}` : ""}`,
    createdAt: payment.paidAt ?? payment.createdAt,
  }));
  return [...documentEvents, ...reminderEvents, ...paymentEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
