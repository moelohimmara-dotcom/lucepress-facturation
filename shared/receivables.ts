export type ReceivableDocument = {
  id: number;
  number: string;
  clientId: number;
  clientName: string;
  projectId: number | null;
  projectName: string | null;
  issueDate: Date | string;
  dueDate: Date | string | null;
  total: number;
  paidAmount: number;
  balanceDue: number;
  isOverdue: boolean;
  paymentPromise?: { id: number; documentId: number; promisedDate: Date | string; note: string | null; updatedAt: Date | string } | null;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function getDaysOverdue(dueDate: Date | string | null, now = new Date()) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(0, Math.floor((startOfDay(now) - startOfDay(due)) / 86_400_000));
}

export function isPaymentPromiseOverdue(promisedDate: Date | string | null | undefined, now = new Date()) {
  if (!promisedDate) return false;
  const promised = new Date(promisedDate);
  if (Number.isNaN(promised.getTime())) return false;
  return startOfDay(promised) < startOfDay(now);
}

export function summarizeReceivables(documents: ReceivableDocument[], now = new Date()) {
  const invoices = documents
    .filter(document => document.balanceDue > 0)
    .map(document => ({ ...document, daysOverdue: document.isOverdue ? getDaysOverdue(document.dueDate, now) : 0, isPaymentPromiseOverdue: isPaymentPromiseOverdue(document.paymentPromise?.promisedDate, now) }))
    .sort((left, right) => Number(right.isPaymentPromiseOverdue) - Number(left.isPaymentPromiseOverdue) || Number(right.isOverdue) - Number(left.isOverdue) || right.daysOverdue - left.daysOverdue || right.balanceDue - left.balanceDue);
  const overdue = invoices.filter(invoice => invoice.isOverdue);
  const current = invoices.filter(invoice => !invoice.isOverdue);
  const expiredPromises = invoices.filter(invoice => invoice.isPaymentPromiseOverdue);
  return {
    invoices,
    summary: {
      openCount: invoices.length,
      overdueCount: overdue.length,
      outstandingTotal: invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      overdueTotal: overdue.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      currentTotal: current.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      expiredPromiseCount: expiredPromises.length,
      expiredPromiseTotal: expiredPromises.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    },
  };
}
