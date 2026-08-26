export const DOCUMENT_KINDS = ["devis", "facture"] as const;
export const DOCUMENT_STATUSES = [
  "brouillon",
  "a_envoyer",
  "envoye",
  "accepte",
  "refuse",
  "partiellement_paye",
  "paye",
  "en_retard",
  "annule",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

type DashboardDocument = {
  kind: DocumentKind;
  status: DocumentStatus;
  total: number;
  dueDate: Date | null;
};

export type EditableDocumentLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  serviceId?: number;
};

export function calculateDocumentTotals(lines: EditableDocumentLine[]) {
  return lines.reduce(
    (totals, line) => {
      const base = Math.round(line.quantity * line.unitPrice);
      const tax = Math.round((base * line.taxRate) / 100);
      return {
        subtotal: totals.subtotal + base,
        taxTotal: totals.taxTotal + tax,
        total: totals.total + base + tax,
      };
    },
    { subtotal: 0, taxTotal: 0, total: 0 },
  );
}

/** Une proposition issue de l’IA est toujours persistée en brouillon, donc soumise à relecture humaine. */
export function initialDocumentStatus(status: DocumentStatus | undefined, isAiDraft: boolean): DocumentStatus {
  return isAiDraft ? "brouillon" : (status ?? "brouillon");
}

export function formatDocumentNumber(kind: DocumentKind, year: number, value: number) {
  const prefix = kind === "devis" ? "DEV" : "FAC";
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

export function summarizeDashboard(documents: DashboardDocument[], now = new Date()) {
  const isLate = (document: DashboardDocument) => document.kind === "facture" && Boolean(document.dueDate && document.dueDate < now && !["paye", "annule"].includes(document.status));
  const paid = documents.filter(document => document.kind === "facture" && document.status === "paye");
  return {
    toProcess: documents.filter(document => ["brouillon", "a_envoyer"].includes(document.status)).length,
    sent: documents.filter(document => document.status === "envoye").length,
    accepted: documents.filter(document => document.status === "accepte").length,
    paidCount: paid.length,
    paidTotal: paid.reduce((sum, document) => sum + document.total, 0),
    overdue: documents.filter(isLate).length,
    invoicesToFollow: documents.filter(document => document.kind === "facture" && ["envoye", "partiellement_paye", "en_retard"].includes(document.status)).length,
  };
}

export function formatGnf(value: number) {
  return `${new Intl.NumberFormat("fr-GN", {
    maximumFractionDigits: 0,
  }).format(value)} GNF`;
}
