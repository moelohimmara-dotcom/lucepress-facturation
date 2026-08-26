import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowUpRight, Bot, FilePlus2, ReceiptText, Send, Sparkles, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatGnf } from "@shared/billing";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: dashboard, isLoading } = trpc.billing.dashboard.useQuery(undefined, { refetchInterval: 15_000 });
  const overdue = dashboard?.counts.overdue ?? 0;
  const indicators = [
    { label: "Devis à traiter", value: isLoading ? "…" : String(dashboard?.counts.toProcess ?? 0), caption: "Brouillons et à envoyer", icon: FilePlus2, tone: "bg-[#e3efe7] text-[#1e6051]" },
    { label: "Envoyés", value: isLoading ? "…" : String(dashboard?.counts.sent ?? 0), caption: `${dashboard?.counts.accepted ?? 0} devis acceptés`, icon: Send, tone: "bg-[#e4edf7] text-[#31617f]" },
    { label: "Factures payées", value: isLoading ? "…" : String(dashboard?.counts.paidCount ?? 0), caption: formatGnf(dashboard?.counts.paidTotal ?? 0), icon: WalletCards, tone: "bg-[#e3efe7] text-[#1e6051]" },
    { label: "En retard", value: isLoading ? "…" : String(overdue), caption: `${dashboard?.counts.invoicesToFollow ?? 0} facture(s) à suivre`, icon: AlertTriangle, tone: overdue > 0 ? "bg-red-100 text-red-700" : "bg-[#f8ebcb] text-[#8c5b13]", alert: overdue > 0 },
  ];
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Pilotage commercial</p><h1 className="font-editorial mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Bonjour, pilotons l’essentiel.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Suivez l’avancement des documents Lucepress et agissez sur les prochaines priorités.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setLocation("/factures")} className="h-10 rounded-xl border-border bg-card font-bold">Nouvelle facture</Button><Button onClick={() => setLocation("/devis/nouveau")} className="h-10 rounded-xl bg-primary px-4 font-bold text-primary-foreground shadow-lg shadow-primary/15 active:scale-[0.97]"><FilePlus2 className="mr-2 h-4 w-4" />Créer un devis</Button></div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {indicators.map(({ label, value, caption, icon: Icon, tone, alert }) => <article className={`card-shadow rounded-2xl border bg-card p-5 ${alert ? "border-red-300 ring-1 ring-red-100" : "border-border"}`} key={label}><div className="flex items-start justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div><span className={`font-mono text-xs ${alert ? "font-bold text-red-700" : "text-muted-foreground"}`}>{alert ? "Action requise" : "En direct"}</span></div><p className="mt-5 text-sm font-bold text-muted-foreground">{label}</p><p className={`font-editorial mt-1 text-3xl font-semibold ${alert ? "text-red-700" : ""}`}>{value}</p><p className={`mt-2 text-xs ${alert ? "font-semibold text-red-700" : "text-muted-foreground"}`}>{caption}</p></article>)}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="card-shadow overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><p className="text-sm font-extrabold">Documents prioritaires</p><p className="mt-1 text-xs text-muted-foreground">Les documents demandant votre attention apparaissent ici.</p></div><Button variant="ghost" onClick={() => setLocation("/devis")} className="hidden rounded-lg text-xs font-bold text-primary sm:flex">Voir les devis <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button></div>{dashboard?.priority.length ? <div>{dashboard.priority.map(document => <button onClick={() => setLocation(`/documents/${document.id}`)} key={document.id} className="flex w-full items-center justify-between gap-3 border-b border-border px-5 py-4 text-left last:border-0 hover:bg-muted/40 sm:px-6"><div className="min-w-0"><p className="font-mono text-xs font-bold text-primary">{document.number}</p><p className="mt-1 truncate text-sm font-extrabold">{document.clientName}</p><p className="mt-1 text-xs text-muted-foreground">{document.status.replaceAll("_", " ")}</p></div><p className="shrink-0 font-mono text-sm font-bold">{formatGnf(document.total)}</p></button>)}</div> : <div className="flex min-h-[262px] flex-col items-center justify-center px-6 py-10 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Send className="h-5 w-5" /></div><h2 className="mt-4 text-sm font-extrabold">Aucun document à prioriser</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Créez un devis ou une facture : les statuts à traiter, les échéances et les retards seront ensuite consolidés ici.</p></div>}</article>
          <aside className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/15"><div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" /><div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-white/[0.04]" /><div className="relative"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Sparkles className="h-5 w-5 text-[#f3d48b]" /></div><p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[#f3d48b]">Assistant Lucepress</p><h2 className="font-editorial mt-2 text-2xl font-semibold leading-tight">D’un besoin terrain à un devis complet.</h2><p className="mt-3 text-sm leading-6 text-primary-foreground/70">Décrivez un chantier BTP ou un besoin de forage. L’assistant structure les prestations, conditions et hypothèses à contrôler avant toute validation.</p><Button onClick={() => setLocation("/devis/nouveau?assistant=ia")} className="mt-6 h-10 rounded-xl bg-[#f3d48b] px-4 text-sm font-extrabold text-primary hover:bg-[#f7df9f]"><Bot className="mr-2 h-4 w-4" />Générer le devis complet</Button></div></aside>
        </section>
      </div>
    </DashboardLayout>
  );
}
