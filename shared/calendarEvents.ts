export type CalendarEventKind = "devis" | "facture" | "relance" | "rappel";

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  date: Date;
  title: string;
  detail: string;
  status: string;
  href: string;
};

type QuoteSource = {
  id: number;
  number: string;
  clientName: string;
  projectName?: string | null;
  validUntil?: Date | string | null;
  depositDueDate?: Date | string | null;
  balanceDueDate?: Date | string | null;
  status: string;
};

type InvoiceSource = {
  id: number;
  number: string;
  clientName: string;
  projectName?: string | null;
  dueDate?: Date | string | null;
  status: string;
  balanceDue?: number;
};

type CampaignSource = {
  id: number;
  name: string;
  nextExecutionAt?: Date | string | null;
  scheduleTimeZone?: string | null;
  status: string;
  eligibleCount?: number;
};

type ReminderSource = {
  id: number;
  number: string;
  clientName: string;
  projectName?: string | null;
  collectionReminderDate?: Date | string | null;
  collectionStatus?: string | null;
};

export function calendarDateKey(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function clientDetail(clientName: string, projectName?: string | null) {
  return `${clientName}${projectName ? ` · ${projectName}` : ""}`;
}

/**
 * Calendrier commercial : validité devis, acompte/solde, échéance facture, rappels, simulations.
 */
export function buildCalendarEvents(
  quotes: QuoteSource[],
  campaigns: CampaignSource[],
  receivables: ReminderSource[] = [],
  invoices: InvoiceSource[] = [],
): CalendarEvent[] {
  const quoteEvents: CalendarEvent[] = quotes.flatMap(quote => {
    if (["refuse", "annule"].includes(quote.status)) return [];
    const events: CalendarEvent[] = [];
    if (quote.validUntil) {
      events.push({
        id: `quote-${quote.id}`,
        kind: "devis",
        date: new Date(quote.validUntil),
        title: `Validité ${quote.number}`,
        detail: clientDetail(quote.clientName, quote.projectName),
        status: quote.status,
        href: `/documents/${quote.id}`,
      });
    }
    if (quote.depositDueDate) {
      events.push({
        id: `quote-deposit-${quote.id}`,
        kind: "devis",
        date: new Date(quote.depositDueDate),
        title: `Acompte ${quote.number}`,
        detail: clientDetail(quote.clientName, quote.projectName),
        status: quote.status,
        href: `/documents/${quote.id}`,
      });
    }
    if (quote.balanceDueDate) {
      events.push({
        id: `quote-balance-${quote.id}`,
        kind: "devis",
        date: new Date(quote.balanceDueDate),
        title: `Solde ${quote.number}`,
        detail: clientDetail(quote.clientName, quote.projectName),
        status: quote.status,
        href: `/documents/${quote.id}`,
      });
    }
    return events;
  });

  const invoiceEvents: CalendarEvent[] = invoices
    .filter(invoice => invoice.dueDate && !["paye", "annule", "refuse"].includes(invoice.status) && (invoice.balanceDue === undefined || invoice.balanceDue > 0))
    .map(invoice => ({
      id: `invoice-${invoice.id}`,
      kind: "facture" as const,
      date: new Date(invoice.dueDate!),
      title: `Échéance ${invoice.number}`,
      detail: clientDetail(invoice.clientName, invoice.projectName),
      status: invoice.status,
      href: `/documents/${invoice.id}`,
    }));

  const campaignEvents: CalendarEvent[] = campaigns
    .filter(campaign => campaign.nextExecutionAt && !["suspendue", "archivee"].includes(campaign.status))
    .map(campaign => ({
      id: `campaign-${campaign.id}`,
      kind: "relance" as const,
      date: new Date(campaign.nextExecutionAt!),
      title: campaign.name,
      detail: `${campaign.eligibleCount ?? 0} brouillon(s) · ${campaign.scheduleTimeZone || "Conakry"}`,
      status: campaign.status,
      href: "/agent-ia/planification",
    }));

  const reminderEvents: CalendarEvent[] = receivables
    .filter(invoice => invoice.collectionStatus === "a_rappeler" && invoice.collectionReminderDate)
    .map(invoice => ({
      id: `reminder-${invoice.id}`,
      kind: "rappel" as const,
      date: new Date(invoice.collectionReminderDate!),
      title: `Rappel ${invoice.number}`,
      detail: clientDetail(invoice.clientName, invoice.projectName),
      status: invoice.collectionStatus ?? "a_rappeler",
      href: `/creances?facture=${invoice.id}`,
    }));

  return [...quoteEvents, ...invoiceEvents, ...campaignEvents, ...reminderEvents].sort((left, right) => left.date.getTime() - right.date.getTime());
}
