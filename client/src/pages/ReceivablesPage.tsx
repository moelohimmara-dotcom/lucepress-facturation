import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatGnf } from "@shared/billing";
import { isReceivableDueInPeriod, type ReceivablesPeriod } from "@shared/receivablesPeriod";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, CircleDollarSign, ExternalLink, Loader2, Search, ShieldAlert, WalletCards } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";

type Period = ReceivablesPeriod;

const periods: { value: Period; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
];

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("fr-GN", { day: "2-digit", month: "short", year: "numeric" }) : "Échéance non renseignée";
}

export default function ReceivablesPage() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.billing.receivables.useQuery();
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [period, setPeriod] = useState<Period>("all");

  const visibleInvoices = useMemo(() => (data?.invoices ?? []).filter(invoice => {
    const match = `${invoice.number} ${invoice.clientName} ${invoice.projectName ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    const periodMatch = invoice.isOverdue ? isReceivableDueInPeriod(invoice.dueDate, period) : period === "all";
    return match && periodMatch && (!overdueOnly || invoice.isOverdue);
  }), [data, search, overdueOnly, period]);

  const summary = data?.summary;
  const periodLabel = period === "all" ? "toutes les échéances" : `les retards des ${period} derniers jours`;
  const hasExpiredPromises = (summary?.expiredPromiseCount ?? 0) > 0;

  return <DashboardLayout><main className="mx-auto max-w-7xl pb-10">
    <header className="relative overflow-hidden rounded-[1.45rem] border border-primary/15 bg-primary/[0.035] px-5 py-6 sm:px-7 sm:py-7">
      <div className="absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="lucepress-kicker">Suivi commercial · Recouvrement</p>
          <h1 className="font-editorial mt-3 text-3xl font-semibold sm:text-4xl">Créances & priorités</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Transformez les factures impayées en actions claires : identifiez l’encours, les retards et les engagements clients à sécuriser.</p>
        </div>
        <div className="flex max-w-sm items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/45 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <span><strong className="block">Supervision humaine</strong> Les relances restent à préparer et valider avant tout envoi.</span>
        </div>
      </div>
    </header>

    {isLoading ? <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : <>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric icon={CircleDollarSign} label="Encours total" value={formatGnf(summary?.outstandingTotal ?? 0)} detail="Factures non réglées" />
        <Metric icon={AlertTriangle} label="À prioriser" value={formatGnf(summary?.overdueTotal ?? 0)} detail={`${summary?.overdueCount ?? 0} facture${(summary?.overdueCount ?? 0) > 1 ? "s" : ""} en retard`} tone="danger" />
        <Metric icon={WalletCards} label="Échéances ouvertes" value={formatGnf(summary?.currentTotal ?? 0)} detail={`${summary?.openCount ?? 0} impayé${(summary?.openCount ?? 0) > 1 ? "s" : ""} suivi${(summary?.openCount ?? 0) > 1 ? "s" : ""}`} tone="neutral" />
      </section>

      {hasExpiredPromises && <section className="mt-5 flex flex-col gap-4 rounded-[1.35rem] border border-red-400/80 bg-red-50 px-5 py-4 text-red-950 shadow-[0_18px_38px_-30px_rgba(185,28,28,.8)] dark:border-red-600/70 dark:bg-red-950/45 dark:text-red-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-200"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-sm font-extrabold">Promesse de paiement dépassée</p><p className="mt-1 text-xs leading-5 text-red-800 dark:text-red-200">{summary?.expiredPromiseCount} facture{(summary?.expiredPromiseCount ?? 0) > 1 ? "s" : ""} concernée{(summary?.expiredPromiseCount ?? 0) > 1 ? "s" : ""} · <strong>{formatGnf(summary?.expiredPromiseTotal ?? 0)}</strong> à traiter en priorité.</p></div></div>
        <Button onClick={() => { setOverdueOnly(true); }} className="h-10 shrink-0 rounded-xl bg-red-700 text-xs font-extrabold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"><ArrowUpRight className="mr-2 h-4 w-4" />Voir les retards</Button>
      </section>}

      <section className="lucepress-panel mt-6 overflow-hidden rounded-[1.4rem]">
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div><p className="lucepress-kicker">File de traitement</p><h2 className="font-editorial mt-2 text-2xl font-semibold">Factures à encaisser</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Les promesses dépassées et les retards sont affichés avant les autres échéances.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Rechercher une créance" value={search} onChange={event => setSearch(event.target.value)} className="lucepress-field h-10 w-full rounded-xl py-2 pr-3 pl-9 text-xs sm:w-64" placeholder="Facture, client, chantier…" /></label><Button variant={overdueOnly ? "default" : "outline"} onClick={() => setOverdueOnly(value => !value)} className="h-10 rounded-xl text-xs font-extrabold"><AlertTriangle className="mr-2 h-3.5 w-3.5" />{overdueOnly ? "Retards affichés" : "Prioriser les retards"}</Button></div>
          </div>
          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center"><p className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Période de retard</p><div className="flex flex-wrap gap-2" role="group" aria-label="Période des créances">{periods.map(item => <button type="button" key={item.value} onClick={() => setPeriod(item.value)} className={`h-8 rounded-lg border px-3 text-[11px] font-extrabold transition-colors ${period === item.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/[0.03]"}`}>{item.label}</button>)}</div></div>
        </div>
        {visibleInvoices.length ? <div className="divide-y divide-border">{visibleInvoices.map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} onOpen={() => setLocation(`/documents/${invoice.id}`)} />)}</div> : <EmptyState detail={`Filtre actif : ${periodLabel}. Les factures réglées intégralement ne figurent pas dans cette liste.`} />}
      </section>
    </>}
  </main></DashboardLayout>;
}

function Metric({ icon: Icon, label, value, detail, tone = "primary" }: { icon: React.ElementType; label: string; value: string; detail: string; tone?: "primary" | "danger" | "neutral" }) {
  const styles = { primary: "bg-secondary text-primary", danger: "bg-red-100 text-red-700 dark:bg-red-950/65 dark:text-red-200", neutral: "bg-sky-100 text-sky-700 dark:bg-sky-950/65 dark:text-sky-200" }[tone];
  const valueTone = tone === "danger" ? "text-red-700 dark:text-red-300" : "text-foreground";
  return <article className="lucepress-panel rounded-[1.35rem] p-5"><div className="flex items-start justify-between gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles}`}><Icon className="h-5 w-5" /></div><CheckCircle2 className="h-4 w-4 text-primary/55" /></div><p className={`lucepress-value mt-6 text-2xl ${valueTone}`}>{value}</p><p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></article>;
}

function InvoiceCard({ invoice, onOpen }: { invoice: any; onOpen: () => void }) {
  const priority = invoice.isPaymentPromiseOverdue ? "promise" : invoice.isOverdue ? "overdue" : "current";
  const status = priority === "promise" ? { label: "Promesse dépassée", badge: "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200", row: "bg-red-50/70 dark:bg-red-950/20" } : priority === "overdue" ? { label: `Retard · ${invoice.daysOverdue} j`, badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/65 dark:text-amber-200", row: "bg-amber-50/45 dark:bg-amber-950/15" } : { label: "À échéance", badge: "bg-primary/[0.08] text-primary", row: "" };
  return <article className={`group flex flex-col gap-4 px-5 py-5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-6 ${status.row}`}>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-extrabold text-primary">{invoice.number}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.badge}`}>{status.label}</span></div><p className="mt-3 text-sm font-extrabold">{invoice.clientName}</p><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{invoice.projectName ?? "Sans chantier rattaché"}</span><span className="hidden sm:inline">·</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Échéance {formatDate(invoice.dueDate)}</span></p>{invoice.paymentPromise && <p className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${invoice.isPaymentPromiseOverdue ? "bg-red-200 text-red-950 dark:bg-red-900/65 dark:text-red-100" : "bg-primary/[0.07] text-primary"}`}><CalendarClock className="h-3.5 w-3.5" />Promesse déclarée : {formatDate(invoice.paymentPromise.promisedDate)}</p>}</div>
    <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className={`font-mono text-lg font-extrabold ${priority === "promise" ? "text-red-700 dark:text-red-300" : priority === "overdue" ? "text-amber-800 dark:text-amber-200" : "text-primary"}`}>{formatGnf(invoice.balanceDue)}</p><p className="mt-1 text-[11px] text-muted-foreground">sur {formatGnf(invoice.total)} · encaissé {formatGnf(invoice.paidAmount)}</p></div><Button aria-label={`Ouvrir la facture ${invoice.number}`} variant="outline" size="icon" onClick={onOpen} className="h-10 w-10 rounded-xl border-primary/20 bg-card text-primary transition-transform group-hover:-translate-y-0.5"><ExternalLink className="h-4 w-4" /></Button></div>
  </article>;
}

function EmptyState({ detail }: { detail: string }) { return <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><WalletCards className="h-5 w-5" /></div><p className="mt-4 text-sm font-extrabold">Aucune créance ne correspond à ces critères.</p><p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">{detail}</p></div>; }
