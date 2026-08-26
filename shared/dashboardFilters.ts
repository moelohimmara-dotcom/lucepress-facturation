import type { DocumentKind, DocumentStatus } from "./billing";

export type DashboardQuickFilter = "overdue" | "pending_quotes";

export type FilterableDashboardDocument = {
  kind: DocumentKind;
  status: DocumentStatus;
  isOverdue: boolean;
};

export function selectDashboardDocuments<T extends FilterableDashboardDocument>(documents: T[], filter: DashboardQuickFilter) {
  if (filter === "overdue") return documents.filter(document => document.kind === "facture" && document.isOverdue);
  return documents.filter(document => document.kind === "devis" && ["brouillon", "a_envoyer"].includes(document.status));
}
