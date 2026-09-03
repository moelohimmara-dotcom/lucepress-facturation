import { formatGnf } from "./billing";

export type TodayInboxPriority = "urgent" | "action" | "info";

export type TodayInboxItem = {
  id: string;
  priority: TodayInboxPriority;
  title: string;
  detail: string;
  amountLabel?: string;
  cta: string;
  href: string;
};

export type TodayInboxDocument = {
  id: number;
  kind: "devis" | "facture";
  number: string;
  status: string;
  clientName: string;
  total: number;
  balanceDue?: number;
  isOverdue?: boolean;
  relatedDocumentId?: number | null;
  invoiceStage?: string | null;
};

export type TodayInboxReceivable = {
  id: number;
  number: string;
  clientName: string;
  balanceDue: number;
  isOverdue: boolean;
  collectionReminderDate?: Date | string | null;
  paymentPromise?: { promisedDate: Date | string } | null;
};

export type TodayInboxInput = {
  documents: TodayInboxDocument[];
  receivables?: TodayInboxReceivable[];
  smtpConfigured?: boolean;
  clientCount: number;
  now?: Date;
};

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isReminderToday(value: Date | string | null | undefined, now: Date) {
  if (!value) return false;
  const reminder = startOfDay(new Date(value));
  return reminder.getTime() === startOfDay(now).getTime();
}

function isPromiseExpired(value: Date | string | null | undefined, now: Date) {
  if (!value) return false;
  return startOfDay(new Date(value)).getTime() < startOfDay(now).getTime();
}

/**
 * Construit la file « Aujourd’hui » : décisions humaines prioritaires, max 12 cartes.
 * Ordre : SMTP / démarrage → retards → promesses → rappels → devis à envoyer → devis acceptés → devis en attente client.
 */
export function buildTodayInbox(input: TodayInboxInput): TodayInboxItem[] {
  const now = input.now ?? new Date();
  const items: TodayInboxItem[] = [];
  const documents = input.documents;
  const receivables = input.receivables ?? [];

  if (input.smtpConfigured === false) {
    items.push({
      id: "smtp-down",
      priority: "urgent",
      title: "E-mail indisponible",
      detail: "Configurez SMTP pour envoyer devis, factures et relances pendant le test.",
      cta: "Voir les paramètres",
      href: "/parametres",
    });
  }

  if (input.clientCount === 0) {
    items.push({
      id: "first-client",
      priority: "action",
      title: "Ajoutez votre premier client",
      detail: "Sans fiche client, aucun devis ni portail n’est possible.",
      cta: "Ouvrir les clients",
      href: "/clients",
    });
  }

  const overdue = receivables.filter(invoice => invoice.isOverdue && invoice.balanceDue > 0);
  for (const invoice of overdue.slice(0, 5)) {
    items.push({
      id: `overdue-${invoice.id}`,
      priority: "urgent",
      title: `Relancer ${invoice.clientName}`,
      detail: `${invoice.number} · échéance dépassée`,
      amountLabel: formatGnf(invoice.balanceDue),
      cta: "Préparer la relance",
      href: `/creances?facture=${invoice.id}`,
    });
  }

  const expiredPromises = receivables.filter(
    invoice => invoice.balanceDue > 0 && isPromiseExpired(invoice.paymentPromise?.promisedDate, now),
  );
  for (const invoice of expiredPromises.slice(0, 3)) {
    if (items.some(item => item.id === `overdue-${invoice.id}`)) continue;
    items.push({
      id: `promise-${invoice.id}`,
      priority: "urgent",
      title: `Promesse dépassée · ${invoice.clientName}`,
      detail: `${invoice.number} · date annoncée non honorée`,
      amountLabel: formatGnf(invoice.balanceDue),
      cta: "Ouvrir la créance",
      href: `/creances?facture=${invoice.id}`,
    });
  }

  const remindersToday = receivables.filter(
    invoice => invoice.balanceDue > 0 && isReminderToday(invoice.collectionReminderDate, now),
  );
  for (const invoice of remindersToday.slice(0, 3)) {
    if (items.some(item => item.id === `overdue-${invoice.id}` || item.id === `promise-${invoice.id}`)) continue;
    items.push({
      id: `reminder-${invoice.id}`,
      priority: "action",
      title: `Rappel du jour · ${invoice.clientName}`,
      detail: `${invoice.number} · suivi interne à traiter`,
      amountLabel: formatGnf(invoice.balanceDue),
      cta: "Marquer le suivi",
      href: `/creances?facture=${invoice.id}`,
    });
  }

  const quotesToSend = documents.filter(
    document => document.kind === "devis" && ["brouillon", "a_envoyer"].includes(document.status),
  );
  for (const quote of quotesToSend.slice(0, 4)) {
    items.push({
      id: `quote-send-${quote.id}`,
      priority: "action",
      title: `Envoyer le devis ${quote.number}`,
      detail: `${quote.clientName} · brouillon prêt à partir`,
      amountLabel: formatGnf(quote.total),
      cta: "Ouvrir le devis",
      href: `/documents/${quote.id}`,
    });
  }

  const acceptedQuotes = documents.filter(document => document.kind === "devis" && document.status === "accepte");
  const invoicesFromQuotes = new Set(
    documents
      .filter(document => document.kind === "facture" && document.relatedDocumentId)
      .map(document => document.relatedDocumentId),
  );
  for (const quote of acceptedQuotes.slice(0, 3)) {
    if (invoicesFromQuotes.has(quote.id)) continue;
    items.push({
      id: `quote-invoice-${quote.id}`,
      title: `Facturer ${quote.clientName}`,
      priority: "action",
      detail: `${quote.number} accepté · générez l’acompte ou la facture`,
      amountLabel: formatGnf(quote.total),
      cta: "Convertir",
      href: `/documents/${quote.id}`,
    });
  }

  const waitingQuotes = documents.filter(document => document.kind === "devis" && document.status === "envoye");
  for (const quote of waitingQuotes.slice(0, 3)) {
    items.push({
      id: `quote-wait-${quote.id}`,
      priority: "info",
      title: `En attente client · ${quote.number}`,
      detail: `${quote.clientName} · devis envoyé, réponse portail possible`,
      amountLabel: formatGnf(quote.total),
      cta: "Voir le devis",
      href: `/documents/${quote.id}`,
    });
  }

  return items.slice(0, 12);
}

export function countTodayInboxByPriority(items: TodayInboxItem[]) {
  return items.reduce(
    (summary, item) => {
      summary[item.priority] += 1;
      summary.total += 1;
      return summary;
    },
    { urgent: 0, action: 0, info: 0, total: 0 },
  );
}
