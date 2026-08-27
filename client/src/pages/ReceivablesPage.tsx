import ClientActivityTimeline from "@/components/ClientActivityTimeline";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatGnf } from "@shared/billing";
import { BATCH_REMINDER_LIMIT } from "@shared/batchReminders";
import { isReceivableDueInPeriod, type ReceivablesPeriod } from "@shared/receivablesPeriod";
import { createReceivablesCsv } from "@shared/receivablesCsv";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, CircleDollarSign, Copy, Download, ExternalLink, History, Loader2, Mail, Search, ShieldAlert, Sparkles, UsersRound, WalletCards, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Period = ReceivablesPeriod;
type TimelineClient = { id: number; name: string };
type BatchDraft = { documentId: number; subject: string; greeting: string; body: string; closing: string; tone: string };

const periods: { value: Period; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
];

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("fr-GN", { day: "2-digit", month: "short", year: "numeric" }) : "Échéance non renseignée";
}

function exportFilename() {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `lucepress-creances-filtrees-${timestamp}.csv`;
}

export default function ReceivablesPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.billing.receivables.useQuery();
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [timelineClient, setTimelineClient] = useState<TimelineClient | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchTone, setBatchTone] = useState<"courtois" | "ferme">("courtois");
  const [batchInstruction, setBatchInstruction] = useState("");
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const { data: clientActivities = [], isLoading: activitiesLoading } = trpc.billing.clients.activities.list.useQuery({ clientId: timelineClient?.id ?? 1 }, { enabled: Boolean(timelineClient) });

  const visibleInvoices = useMemo(() => (data?.invoices ?? []).filter(invoice => {
    const match = `${invoice.number} ${invoice.clientName} ${invoice.projectName ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    const periodMatch = invoice.isOverdue ? isReceivableDueInPeriod(invoice.dueDate, period) : period === "all";
    return match && periodMatch && (!overdueOnly || invoice.isOverdue);
  }), [data, search, overdueOnly, period]);
  const visibleSelectedInvoiceIds = useMemo(() => selectedInvoiceIds.filter(id => visibleInvoices.some(invoice => invoice.id === id && invoice.isOverdue)), [selectedInvoiceIds, visibleInvoices]);
  const summary = data?.summary;
  const periodLabel = period === "all" ? "toutes les échéances" : `les retards des ${period} derniers jours`;
  const hasExpiredPromises = (summary?.expiredPromiseCount ?? 0) > 0;
  const prepareBatchReminders = trpc.billing.assistant.prepareBatchReminders.useMutation({
    onSuccess: result => {
      setBatchDrafts(result.reminders);
      for (const invoiceId of visibleSelectedInvoiceIds) {
        const invoice = visibleInvoices.find(item => item.id === invoiceId);
        if (invoice) utils.billing.clients.activities.list.invalidate({ clientId: invoice.clientId });
      }
      toast.success(`${result.reminders.length} brouillon${result.reminders.length > 1 ? "s" : ""} préparé${result.reminders.length > 1 ? "s" : ""}. Relisez-les avant toute utilisation.`);
    },
    onError: error => toast.error(error.message),
  });

  function toggleInvoiceSelection(invoiceId: number) {
    setSelectedInvoiceIds(current => {
      if (current.includes(invoiceId)) return current.filter(id => id !== invoiceId);
      if (current.length >= BATCH_REMINDER_LIMIT) {
        toast.error(`Un lot ne peut pas contenir plus de ${BATCH_REMINDER_LIMIT} factures.`);
        return current;
      }
      return [...current, invoiceId];
    });
  }

  function openBatchDialog() {
    if (!visibleSelectedInvoiceIds.length) return toast.error("Sélectionnez au moins une facture en retard.");
    setBatchDrafts([]);
    setBatchInstruction("");
    setBatchDialogOpen(true);
  }

  function prepareBatch() {
    if (!visibleSelectedInvoiceIds.length) return toast.error("Aucune facture en retard n’est sélectionnée.");
    prepareBatchReminders.mutate({ documentIds: visibleSelectedInvoiceIds, tone: batchTone, instruction: batchInstruction.trim() || undefined });
  }

  async function copyBatchDraft(draft: BatchDraft) {
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.greeting}\n\n${draft.body}\n\n${draft.closing}`);
      toast.success(`Brouillon ${draft.subject} copié.`);
    } catch { toast.error("Le brouillon n’a pas pu être copié."); }
  }

  function exportVisibleInvoices() {
    if (!visibleInvoices.length) return toast.error("Aucune créance filtrée n’est disponible à exporter.");
    const blob = new Blob(["\uFEFF", createReceivablesCsv(visibleInvoices)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = exportFilename();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success(`File filtrée exportée : ${visibleInvoices.length} créance${visibleInvoices.length > 1 ? "s" : ""}.`);
  }

  return <DashboardLayout><main className="mx-auto max-w-7xl pb-10">
    <header className="relative overflow-hidden rounded-[1.45rem] border border-primary/15 bg-primary/[0.035] px-5 py-6 sm:px-7 sm:py-7">
      <div className="absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl"><p className="lucepress-kicker">Suivi commercial · Recouvrement</p><h1 className="font-editorial mt-3 text-3xl font-semibold sm:text-4xl">Créances & priorités</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Transformez les factures impayées en actions claires : identifiez l’encours, les retards et les engagements clients à sécuriser.</p></div>
        <div className="flex max-w-sm items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/45 dark:text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" /><span><strong className="block">Supervision humaine</strong> Les relances restent à préparer et valider avant tout envoi.</span></div>
      </div>
    </header>

    {isLoading ? <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : <>
      <section className="mt-6 grid gap-4 sm:grid-cols-3"><Metric icon={CircleDollarSign} label="Encours total" value={formatGnf(summary?.outstandingTotal ?? 0)} detail="Factures non réglées" /><Metric icon={AlertTriangle} label="À prioriser" value={formatGnf(summary?.overdueTotal ?? 0)} detail={`${summary?.overdueCount ?? 0} facture${(summary?.overdueCount ?? 0) > 1 ? "s" : ""} en retard`} tone="danger" /><Metric icon={WalletCards} label="Échéances ouvertes" value={formatGnf(summary?.currentTotal ?? 0)} detail={`${summary?.openCount ?? 0} impayé${(summary?.openCount ?? 0) > 1 ? "s" : ""} suivi${(summary?.openCount ?? 0) > 1 ? "s" : ""}`} tone="neutral" /></section>
      {hasExpiredPromises && <section className="mt-5 flex flex-col gap-4 rounded-[1.35rem] border border-red-400/80 bg-red-50 px-5 py-4 text-red-950 shadow-[0_18px_38px_-30px_rgba(185,28,28,.8)] dark:border-red-600/70 dark:bg-red-950/45 dark:text-red-100 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-200"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-sm font-extrabold">Promesse de paiement dépassée</p><p className="mt-1 text-xs leading-5 text-red-800 dark:text-red-200">{summary?.expiredPromiseCount} facture{(summary?.expiredPromiseCount ?? 0) > 1 ? "s" : ""} concernée{(summary?.expiredPromiseCount ?? 0) > 1 ? "s" : ""} · <strong>{formatGnf(summary?.expiredPromiseTotal ?? 0)}</strong> à traiter en priorité.</p></div></div><Button onClick={() => { setOverdueOnly(true); }} className="h-10 shrink-0 rounded-xl bg-red-700 text-xs font-extrabold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"><ArrowUpRight className="mr-2 h-4 w-4" />Voir les retards</Button></section>}

      <section className="lucepress-panel mt-6 overflow-hidden rounded-[1.4rem]">
        <div className="border-b border-border px-5 py-5 sm:px-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><p className="lucepress-kicker">File de traitement</p><h2 className="font-editorial mt-2 text-2xl font-semibold">Factures à encaisser</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Les promesses dépassées et les retards sont affichés avant les autres échéances.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Rechercher une créance" value={search} onChange={event => setSearch(event.target.value)} className="lucepress-field h-10 w-full rounded-xl py-2 pr-3 pl-9 text-xs sm:w-64" placeholder="Facture, client, chantier…" /></label><Button variant={overdueOnly ? "default" : "outline"} onClick={() => setOverdueOnly(value => !value)} className="h-10 rounded-xl text-xs font-extrabold"><AlertTriangle className="mr-2 h-3.5 w-3.5" />{overdueOnly ? "Retards affichés" : "Prioriser les retards"}</Button></div></div><div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><p className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Période de retard</p><div className="flex flex-wrap gap-2" role="group" aria-label="Période des créances">{periods.map(item => <button type="button" key={item.value} onClick={() => setPeriod(item.value)} className={`h-8 rounded-lg border px-3 text-[11px] font-extrabold transition-colors ${period === item.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/[0.03]"}`}>{item.label}</button>)}</div></div><Button type="button" variant="outline" onClick={exportVisibleInvoices} disabled={!visibleInvoices.length} className="h-9 shrink-0 rounded-lg border-primary/20 bg-card text-xs font-extrabold text-primary"><Download className="mr-1.5 h-3.5 w-3.5" />Exporter la file filtrée</Button></div></div>
        {visibleSelectedInvoiceIds.length > 0 && <div className="flex flex-col gap-3 border-b border-primary/15 bg-primary/[0.045] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><p className="text-xs font-bold"><strong>{visibleSelectedInvoiceIds.length}</strong> facture{visibleSelectedInvoiceIds.length > 1 ? "s" : ""} en retard sélectionnée{visibleSelectedInvoiceIds.length > 1 ? "s" : ""} · maximum {BATCH_REMINDER_LIMIT} par lot</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => setSelectedInvoiceIds(current => current.filter(id => !visibleSelectedInvoiceIds.includes(id)))} className="h-8 px-2 text-[11px] font-bold text-muted-foreground"><X className="mr-1 h-3.5 w-3.5" />Effacer</Button><Button type="button" onClick={openBatchDialog} className="h-9 rounded-lg bg-primary text-xs font-extrabold text-primary-foreground"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Préparer les brouillons</Button></div></div>}
        {visibleInvoices.length ? <div className="divide-y divide-border">{visibleInvoices.map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} selected={visibleSelectedInvoiceIds.includes(invoice.id)} onToggleSelect={() => toggleInvoiceSelection(invoice.id)} onOpenTimeline={() => setTimelineClient({ id: invoice.clientId, name: invoice.clientName })} onOpen={() => setLocation(`/documents/${invoice.id}`)} />)}</div> : <EmptyState detail={`Filtre actif : ${periodLabel}. Les factures réglées intégralement ne figurent pas dans cette liste.`} />}
      </section>
    </>}
    <ClientTimelineDialog client={timelineClient} activities={clientActivities} loading={activitiesLoading} onClose={() => setTimelineClient(null)} onOpenDocument={documentId => { setTimelineClient(null); setLocation(`/documents/${documentId}`); }} />
    <BatchRemindersDialog open={batchDialogOpen} selectedCount={visibleSelectedInvoiceIds.length} tone={batchTone} instruction={batchInstruction} drafts={batchDrafts} pending={prepareBatchReminders.isPending} onOpenChange={open => { setBatchDialogOpen(open); if (!open) setBatchDrafts([]); }} onToneChange={setBatchTone} onInstructionChange={setBatchInstruction} onPrepare={prepareBatch} onCopy={copyBatchDraft} />
  </main></DashboardLayout>;
}

function Metric({ icon: Icon, label, value, detail, tone = "primary" }: { icon: React.ElementType; label: string; value: string; detail: string; tone?: "primary" | "danger" | "neutral" }) {
  const styles = { primary: "bg-secondary text-primary", danger: "bg-red-100 text-red-700 dark:bg-red-950/65 dark:text-red-200", neutral: "bg-sky-100 text-sky-700 dark:bg-sky-950/65 dark:text-sky-200" }[tone];
  const valueTone = tone === "danger" ? "text-red-700 dark:text-red-300" : "text-foreground";
  return <article className="lucepress-panel rounded-[1.35rem] p-5"><div className="flex items-start justify-between gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles}`}><Icon className="h-5 w-5" /></div><CheckCircle2 className="h-4 w-4 text-primary/55" /></div><p className={`lucepress-value mt-6 text-2xl ${valueTone}`}>{value}</p><p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></article>;
}

function InvoiceCard({ invoice, selected, onToggleSelect, onOpenTimeline, onOpen }: { invoice: any; selected: boolean; onToggleSelect: () => void; onOpenTimeline: () => void; onOpen: () => void }) {
  const priority = invoice.isPaymentPromiseOverdue ? "promise" : invoice.isOverdue ? "overdue" : "current";
  const status = priority === "promise" ? { label: "Promesse dépassée", badge: "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200", row: "bg-red-50/70 dark:bg-red-950/20" } : priority === "overdue" ? { label: `Retard · ${invoice.daysOverdue} j`, badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/65 dark:text-amber-200", row: "bg-amber-50/45 dark:bg-amber-950/15" } : { label: "À échéance", badge: "bg-primary/[0.08] text-primary", row: "" };
  return <article className={`group flex flex-col gap-4 px-5 py-5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-6 ${status.row} ${selected ? "ring-1 ring-inset ring-primary/40" : ""}`}><div className="flex min-w-0 gap-3"><div className="pt-0.5">{invoice.isOverdue ? <input aria-label={`Sélectionner la facture ${invoice.number}`} type="checkbox" checked={selected} onChange={onToggleSelect} className="h-4 w-4 rounded border-primary/30 accent-primary" /> : <span className="block h-4 w-4" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-extrabold text-primary">{invoice.number}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.badge}`}>{status.label}</span></div><p className="mt-3 text-sm font-extrabold">{invoice.clientName}</p><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{invoice.projectName ?? "Sans chantier rattaché"}</span><span className="hidden sm:inline">·</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Échéance {formatDate(invoice.dueDate)}</span></p>{invoice.paymentPromise && <p className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${invoice.isPaymentPromiseOverdue ? "bg-red-200 text-red-950 dark:bg-red-900/65 dark:text-red-100" : "bg-primary/[0.07] text-primary"}`}><CalendarClock className="h-3.5 w-3.5" />Promesse déclarée : {formatDate(invoice.paymentPromise.promisedDate)}</p>}</div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><div className="text-right"><p className={`font-mono text-lg font-extrabold ${priority === "promise" ? "text-red-700 dark:text-red-300" : priority === "overdue" ? "text-amber-800 dark:text-amber-200" : "text-primary"}`}>{formatGnf(invoice.balanceDue)}</p><p className="mt-1 text-[11px] text-muted-foreground">sur {formatGnf(invoice.total)} · encaissé {formatGnf(invoice.paidAmount)}</p></div><div className="flex gap-1"><Button aria-label={`Voir l’historique de ${invoice.clientName}`} variant="ghost" size="icon" onClick={onOpenTimeline} className="h-10 w-10 rounded-xl text-primary hover:bg-primary/[0.08]"><History className="h-4 w-4" /></Button><Button aria-label={`Ouvrir la facture ${invoice.number}`} variant="outline" size="icon" onClick={onOpen} className="h-10 w-10 rounded-xl border-primary/20 bg-card text-primary transition-transform group-hover:-translate-y-0.5"><ExternalLink className="h-4 w-4" /></Button></div></div></article>;
}

function ClientTimelineDialog({ client, activities, loading, onClose, onOpenDocument }: { client: TimelineClient | null; activities: any[]; loading: boolean; onClose: () => void; onOpenDocument: (documentId: number) => void }) {
  return <Dialog open={Boolean(client)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" />Historique client</DialogTitle><DialogDescription>{client ? `Chronologie complète des documents, paiements, notes et relances préparées pour ${client.name}.` : ""}</DialogDescription></DialogHeader>{client && <ClientActivityTimeline activities={activities} loading={loading} onOpenDocument={onOpenDocument} />}</DialogContent></Dialog>;
}

function BatchRemindersDialog({ open, selectedCount, tone, instruction, drafts, pending, onOpenChange, onToneChange, onInstructionChange, onPrepare, onCopy }: { open: boolean; selectedCount: number; tone: "courtois" | "ferme"; instruction: string; drafts: BatchDraft[]; pending: boolean; onOpenChange: (open: boolean) => void; onToneChange: (tone: "courtois" | "ferme") => void; onInstructionChange: (value: string) => void; onPrepare: () => void; onCopy: (draft: BatchDraft) => void }) {
  const hasDrafts = drafts.length > 0;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Relances groupées</DialogTitle><DialogDescription>La préparation crée uniquement des brouillons internes personnalisés. Aucun e-mail, WhatsApp ou autre message n’est envoyé depuis cette action.</DialogDescription></DialogHeader>{hasDrafts ? <div className="space-y-3 py-2"><div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" /><span><strong className="block">Relecture obligatoire</strong> Vérifiez chaque texte, son destinataire et son contexte avant toute communication externe.</span></div>{drafts.map(draft => <details key={draft.documentId} className="rounded-xl border border-border bg-card p-4" open={drafts.length === 1}><summary className="cursor-pointer list-none text-sm font-extrabold"><span className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{draft.subject}</span><span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-primary">{draft.tone}</span></span></summary><div className="mt-4 border-t border-border pt-4 text-sm leading-6"><p>{draft.greeting}</p><p className="mt-3 whitespace-pre-line">{draft.body}</p><p className="mt-3 whitespace-pre-line">{draft.closing}</p><Button type="button" variant="outline" onClick={() => onCopy(draft)} className="mt-4 h-9 rounded-lg border-border text-xs font-bold"><Copy className="mr-1.5 h-3.5 w-3.5" />Copier ce brouillon</Button></div></details>)}<p className="text-center text-[11px] leading-5 text-muted-foreground">Ces brouillons sont aussi tracés dans la chronologie de chaque client, sans indication d’envoi.</p></div> : <div className="grid gap-4 py-3"><div className="rounded-xl bg-secondary/60 p-3 text-xs leading-5"><strong className="block text-primary">{selectedCount} facture{selectedCount > 1 ? "s" : ""} en retard sélectionnée{selectedCount > 1 ? "s" : ""}</strong><span className="mt-1 block text-muted-foreground">Les relances seront individualisées selon le client, la facture, l’échéance et le solde dû.</span></div><div><p className="text-xs font-extrabold">Ton de la relance</p><div className="mt-2 flex gap-2"><ToneButton selected={tone === "courtois"} onClick={() => onToneChange("courtois")}>Courtois</ToneButton><ToneButton selected={tone === "ferme"} onClick={() => onToneChange("ferme")}>Plus ferme</ToneButton></div></div><label className="grid gap-1.5 text-xs font-extrabold">Consigne de personnalisation <span className="font-normal text-muted-foreground">(facultative, sans données sensibles)</span><textarea value={instruction} maxLength={500} onChange={event => onInstructionChange(event.target.value)} placeholder="Ex. rappeler de transmettre le justificatif de règlement dès disponibilité." className="lucepress-field min-h-24 resize-y rounded-xl p-3 text-sm" /><span className="text-right text-[10px] font-normal text-muted-foreground">{instruction.length}/500</span></label><Button type="button" onClick={onPrepare} disabled={!selectedCount || pending} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground"><Mail className="mr-2 h-4 w-4" />{pending ? "Préparation des brouillons…" : `Préparer ${selectedCount} brouillon${selectedCount > 1 ? "s" : ""}`}</Button></div>}</DialogContent></Dialog>;
}

function ToneButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`h-8 rounded-lg border px-3 text-xs font-bold ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>{children}</button>; }
function EmptyState({ detail }: { detail: string }) { return <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><WalletCards className="h-5 w-5" /></div><p className="mt-4 text-sm font-extrabold">Aucune créance ne correspond à ces critères.</p><p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">{detail}</p></div>; }
