export type CalendarEventKind = "devis" | "relance";

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

export function calendarDateKey(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildCalendarEvents(quotes: QuoteSource[], campaigns: CampaignSource[]): CalendarEvent[] {
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

  return [...quoteEvents, ...campaignEvents].sort((left, right) => left.date.getTime() - right.date.getTime());
}
