export type ReceivablesCsvRow = {
  number: string;
  clientName: string;
  projectName: string | null;
  dueDate: Date | string | null;
  total: number;
  paidAmount: number;
  balanceDue: number;
  isOverdue: boolean;
  daysOverdue?: number;
  paymentPromise?: { promisedDate: Date | string; note: string | null } | null;
  isPaymentPromiseOverdue?: boolean;
};

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function priorityOf(row: ReceivablesCsvRow) {
  if (row.isPaymentPromiseOverdue) return "Promesse dépassée";
  if (row.isOverdue) return "En retard";
  return "À échéance";
}

export function createReceivablesCsv(rows: ReceivablesCsvRow[]) {
  const header = ["Priorité", "Facture", "Client", "Chantier", "Échéance", "Retard (jours)", "Promesse de paiement", "Note de promesse", "Total (GNF)", "Encaissé (GNF)", "Solde à encaisser (GNF)"];
  const lines = rows.map(row => [
    priorityOf(row),
    row.number,
    row.clientName,
    row.projectName,
    formatDate(row.dueDate),
    row.isOverdue ? row.daysOverdue ?? 0 : 0,
    formatDate(row.paymentPromise?.promisedDate),
    row.paymentPromise?.note,
    row.total,
    row.paidAmount,
    row.balanceDue,
  ].map(escapeCsv).join(";"));
  return [header.map(escapeCsv).join(";"), ...lines].join("\r\n");
}
