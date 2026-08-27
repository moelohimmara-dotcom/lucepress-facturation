export type CalendarEventKind = "devis" | "relance" | "rappel";

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
  status: string;
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

export function buildCalendarEvents(quotes: QuoteSource[], campaigns: CampaignSource[], receivables: ReminderSource[] = []): CalendarEvent[] {
  const quoteEvents: CalendarEvent[] = quotes
    .filter(quote => quote.validUntil && !["refuse", "annule"].includes(quote.status))
    .map(quote => ({
      id: `quote-${quote.id}`,
      kind: "devis" as const,
      date: new Date(quote.validUntil!),
      title: `Échéance ${quote.number}`,
      detail: `${quote.clientName}${quote.projectName ? ` · ${quote.projectName}` : ""}`,
      status: quote.status,
      href: `/documents/${quote.id}`,
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
      detail: `${invoice.clientName}${invoice.projectName ? ` · ${invoice.projectName}` : ""}`,
      status: invoice.collectionStatus ?? "a_rappeler",
      href: `/creances?facture=${invoice.id}`,
    }));

  return [...quoteEvents, ...campaignEvents, ...reminderEvents].sort((left, right) => left.date.getTime() - right.date.getTime());
}
