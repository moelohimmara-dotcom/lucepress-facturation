import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildCalendarEvents, calendarDateKey, type CalendarEvent, type CalendarEventKind } from "@shared/calendarEvents";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, Loader2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const weekdayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const filterLabels: Record<"all" | CalendarEventKind, string> = { all: "Toutes", devis: "Devis", relance: "Relances", rappel: "Rappels" };

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function formatMonth(date: Date) { return new Intl.DateTimeFormat("fr-GN", { month: "long", year: "numeric" }).format(date); }
function formatDay(date: Date) { return new Intl.DateTimeFormat("fr-GN", { weekday: "long", day: "numeric", month: "long" }).format(date); }
function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [filter, setFilter] = useState<"all" | CalendarEventKind>("all");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const { data: quotes = [], isLoading: loadingQuotes } = trpc.billing.documents.list.useQuery({ kind: "devis" });
  const { data: center, isLoading: loadingCampaigns } = trpc.billing.agent.center.useQuery();
  const { data: receivables, isLoading: loadingReceivables } = trpc.billing.receivables.useQuery();
  const events = useMemo(() => buildCalendarEvents(quotes, center?.campaigns ?? [], receivables?.invoices ?? []), [quotes, center?.campaigns, receivables?.invoices]);
  const filteredEvents = useMemo(() => filter === "all" ? events : events.filter(event => event.kind === filter), [events, filter]);
  const days = useMemo(() => calendarDays(month), [month]);
  const selectedEvents = useMemo(() => filteredEvents.filter(event => calendarDateKey(event.date) === calendarDateKey(selectedDate)), [filteredEvents, selectedDate]);
  const monthEvents = useMemo(() => filteredEvents.filter(event => event.date.getFullYear() === month.getFullYear() && event.date.getMonth() === month.getMonth()), [filteredEvents, month]);
  const isLoading = loadingQuotes || loadingCampaigns || loadingReceivables;
  const todayKey = calendarDateKey(new Date());

  function shiftMonth(offset: number) {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return <DashboardLayout><main className="mx-auto max-w-7xl pb-10"><header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="lucepress-kicker">Pilotage commercial · Agenda</p><h1 className="font-editorial mt-3 text-3xl font-semibold">Calendrier des échéances</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Visualisez les dates de validité de vos devis, les simulations de relance et les rappels de créances, puis ouvrez chaque élément pour le gérer.</p></div><div className="lucepress-panel flex items-center gap-3 rounded-xl px-4 py-3 text-xs"><CalendarDays className="h-4 w-4 text-primary" /><span><strong>{monthEvents.length}</strong> échéance{monthEvents.length > 1 ? "s" : ""} ce mois</span></div></header>
    <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]"><article className="lucepress-panel overflow-hidden rounded-[1.35rem]"><div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-card" onClick={() => shiftMonth(-1)} aria-label="Mois précédent"><ChevronLeft className="h-4 w-4" /></Button><h2 className="font-editorial min-w-44 text-center text-xl font-semibold capitalize">{formatMonth(month)}</h2><Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-card" onClick={() => shiftMonth(1)} aria-label="Mois suivant"><ChevronRight className="h-4 w-4" /></Button></div><div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer le calendrier">{(["all", "devis", "relance", "rappel"] as const).map(value => <button type="button" key={value} onClick={() => setFilter(value)} className={`h-8 rounded-lg border px-3 text-[11px] font-extrabold transition-colors ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>{filterLabels[value]}</button>)}</div></div>
      {isLoading ? <div className="flex min-h-[28rem] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : <div className="p-3 sm:p-5"><div className="grid grid-cols-7 gap-1 text-center">{weekdayLabels.map(label => <div key={label} className="pb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>)}{days.map(day => { const key = calendarDateKey(day); const dayEvents = filteredEvents.filter(event => calendarDateKey(event.date) === key); const inMonth = day.getMonth() === month.getMonth(); const selected = key === calendarDateKey(selectedDate); return <button type="button" key={key} onClick={() => setSelectedDate(startOfDay(day))} className={`group min-h-22 rounded-xl border p-2 text-left transition-colors sm:min-h-26 ${selected ? "border-primary bg-primary/[0.08] ring-1 ring-primary/20" : inMonth ? "border-border/75 bg-card/45 hover:border-primary/35 hover:bg-primary/[0.025]" : "border-transparent bg-muted/25 text-muted-foreground/55"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${key === todayKey ? "bg-primary text-primary-foreground" : ""}`}>{day.getDate()}</span><div className="mt-1.5 space-y-1">{dayEvents.slice(0, 2).map(event => <span title={event.title} key={event.id} className={`block truncate rounded-md px-1.5 py-1 text-[9px] font-bold leading-none ${event.kind === "devis" ? "bg-[#e4edf7] text-[#315e7c] dark:bg-sky-950/70 dark:text-sky-200" : event.kind === "rappel" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200" : "bg-[#e3efe7] text-[#1e6051] dark:bg-emerald-950/70 dark:text-emerald-200"}`}>{event.kind === "devis" ? "Devis" : event.kind === "rappel" ? "Rappel" : "Relance"}</span>)}{dayEvents.length > 2 && <span className="block text-[9px] font-bold text-muted-foreground">+{dayEvents.length - 2}</span>}</div></button>; })}</div></div>}</article>
      <aside className="space-y-4"><section className="lucepress-panel rounded-[1.35rem] p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Clock3 className="h-5 w-5" /></div><div><p className="lucepress-kicker">Jour sélectionné</p><h2 className="font-editorial mt-2 text-xl font-semibold capitalize">{formatDay(selectedDate)}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedEvents.length ? `${selectedEvents.length} élément${selectedEvents.length > 1 ? "s" : ""} à suivre.` : "Aucune échéance ne correspond à ce jour."}</p></div></div><div className="mt-5 space-y-3">{selectedEvents.map(event => <CalendarEventCard key={event.id} event={event} onOpen={() => setLocation(event.href)} />)}{!selectedEvents.length && <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs leading-5 text-muted-foreground">Choisissez un jour portant une pastille ou explorez un autre mois pour suivre les prochaines actions.</div>}</div></section>
      <section className="lucepress-panel rounded-[1.35rem] p-5"><p className="lucepress-kicker">Repères</p><div className="mt-4 space-y-3 text-xs"><p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#4d7798] dark:bg-sky-300" /><span><strong>Devis</strong> · date de validité commerciale</span></p><p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#277058] dark:bg-emerald-300" /><span><strong>Relances</strong> · prochaine simulation e-mail</span></p><p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500 dark:bg-rose-300" /><span><strong>Rappels</strong> · suivi d’une créance à traiter</span></p></div><p className="mt-4 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">Les relances restent internes et de test. Ouvrez un rappel pour accéder directement à la créance et mettre son suivi à jour.</p></section></aside></section></main></DashboardLayout>;
}

function CalendarEventCard({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const isQuote = event.kind === "devis";
  const isReminder = event.kind === "rappel";
  return <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.025]"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isQuote ? "bg-[#e4edf7] text-[#315e7c] dark:bg-sky-950/70 dark:text-sky-200" : isReminder ? "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200" : "bg-[#e3efe7] text-[#1e6051] dark:bg-emerald-950/70 dark:text-emerald-200"}`}>{isQuote ? <FileText className="h-4 w-4" /> : isReminder ? <CalendarDays className="h-4 w-4" /> : <Send className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-xs font-extrabold">{event.title}</p><Badge variant="outline" className="shrink-0 border-primary/15 bg-primary/[0.035] text-[9px] text-primary">{isQuote ? "Devis" : isReminder ? "Rappel" : "Relance"}</Badge></div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{event.detail}</p></div></button>;
}
