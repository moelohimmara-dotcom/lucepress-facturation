import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { countGettingStartedTasks, gettingStartedTasks, isGettingStartedTaskComplete } from "@shared/gettingStarted";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { buildTodayInbox, countTodayInboxByPriority, type TodayInboxItem } from "@shared/todayInbox";
import { formatGnf } from "@shared/billing";
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, CircleHelp, FilePlus2, Mail, Sparkles, TrendingUp, Wallet, UsersRound, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showGettingStarted, setShowGettingStarted] = useState(() => localStorage.getItem("lucepress-getting-started-collapsed") !== "true");
  const [hasReviewedReceivables, setHasReviewedReceivables] = useState(() => localStorage.getItem("lucepress-getting-started-receivables") === "true");
  const { data: documents = [] } = trpc.billing.documents.list.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: clients = [] } = trpc.billing.clients.list.useQuery(undefined, { staleTime: 60_000 });
  const { data: receivables } = trpc.billing.receivables.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: dashboard } = trpc.billing.dashboard.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: mailStatus } = trpc.billing.mailStatus.useQuery();

  const counts = dashboard?.counts;
  const receivableSummary = receivables?.summary;

  const inbox = useMemo(
    () =>
      buildTodayInbox({
        documents: documents as any[],
        receivables: (receivables?.invoices ?? []) as any[],
        smtpConfigured: mailStatus?.smtpConfigured,
        clientCount: clients.length,
      }),
    [clients.length, documents, mailStatus?.smtpConfigured, receivables?.invoices],
  );
  const summary = countTodayInboxByPriority(inbox);
  const gettingStartedMilestones = useMemo(
    () => ({
      hasClient: clients.length > 0,
      hasQuote: documents.some((document: { kind: string }) => document.kind === "devis"),
      hasReviewedReceivables,
    }),
    [clients.length, documents, hasReviewedReceivables],
  );
  const gettingStartedCount = countGettingStartedTasks(gettingStartedMilestones);

  function openGettingStartedTask(task: (typeof gettingStartedTasks)[number]) {
    if (task.id === "receivables") {
      localStorage.setItem("lucepress-getting-started-receivables", "true");
      setHasReviewedReceivables(true);
    }
    setLocation(task.path);
  }

  const kpis = [
    {
      label: "Encaissé",
      value: counts ? formatGnf(counts.paidTotal) : "—",
      hint: counts ? `${counts.paidCount} facture${counts.paidCount > 1 ? "s" : ""} payée${counts.paidCount > 1 ? "s" : ""}` : "",
      icon: Wallet,
      tone: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "En attente d'encaissement",
      value: receivableSummary ? formatGnf(receivableSummary.outstandingTotal) : "—",
      hint: receivableSummary ? `${receivableSummary.openCount} créance${receivableSummary.openCount > 1 ? "s" : ""} ouverte${receivableSummary.openCount > 1 ? "s" : ""}` : "",
      icon: Clock,
      tone: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "En retard",
      value: receivableSummary ? formatGnf(receivableSummary.overdueTotal) : "—",
      hint: receivableSummary ? `${receivableSummary.overdueCount} facture${receivableSummary.overdueCount > 1 ? "s" : ""} en retard` : "",
      icon: AlertTriangle,
      tone: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Devis à traiter",
      value: counts ? String(counts.toProcess) : "—",
      hint: counts ? `${counts.sent} envoyé${counts.sent > 1 ? "s" : ""} · ${counts.accepted} accepté${counts.accepted > 1 ? "s" : ""}` : "",
      icon: TrendingUp,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl pb-10 stagger-rise" data-testid="dashboard-main">
        <PageHeader
          kicker="Aujourd'hui"
          title="Tableau de bord"
          description={`Pilotage ${LUCEPRES_PUBLIC_PROFILE.displayName} · vos chiffres essentiels en un coup d'œil.`}
          actions={
            <>
              <Button onClick={() => setLocation("/devis/nouveau?assistant=1")} className="h-10 rounded-xl bg-primary px-4 font-bold text-primary-foreground shadow-lg shadow-primary/15" data-testid="create-quote-button">
                <FilePlus2 className="mr-2 h-4 w-4" />Nouveau devis
              </Button>
              <Button variant="outline" onClick={() => setLocation("/creances")} className="h-10 rounded-xl border-border bg-card font-bold">
                Créances
              </Button>
              <Button variant="outline" onClick={() => setLocation("/calendrier")} className="h-10 rounded-xl border-border bg-card font-bold">
                <CalendarDays className="mr-2 h-4 w-4" />Calendrier
              </Button>
              <Button variant="outline" onClick={() => setLocation("/relances")} className="h-10 rounded-xl border-border bg-card font-bold">
                <Mail className="mr-2 h-4 w-4" />Relances
              </Button>
            </>
          }
        />

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map(kpi => (
            <Card key={kpi.label} className="gap-3 px-5 py-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg} ${kpi.tone}`}>
                  <kpi.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="font-mono text-2xl font-extrabold tracking-tight">{kpi.value}</p>
              {kpi.hint ? <p className="text-xs text-muted-foreground">{kpi.hint}</p> : null}
            </Card>
          ))}
        </section>

        <section className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Clients" value={clients.length} onClick={() => setLocation("/clients")} icon={UsersRound} />
          <MiniStat label="Factures à suivre" value={counts?.invoicesToFollow ?? 0} onClick={() => setLocation("/factures")} icon={Clock} />
          <MiniStat label="Devis envoyés" value={counts?.sent ?? 0} onClick={() => setLocation("/devis")} icon={TrendingUp} />
          <MiniStat label="Devis acceptés" value={counts?.accepted ?? 0} onClick={() => setLocation("/devis")} icon={CheckCircle2} />
        </section>

        {showGettingStarted && gettingStartedCount < gettingStartedTasks.length ? (
          <GettingStartedPanel
            completedCount={gettingStartedCount}
            milestones={gettingStartedMilestones}
            onOpenTask={openGettingStartedTask}
            onDismiss={() => {
              setShowGettingStarted(false);
              localStorage.setItem("lucepress-getting-started-collapsed", "true");
            }}
          />
        ) : gettingStartedCount < gettingStartedTasks.length ? (
          <button
            type="button"
            onClick={() => {
              setShowGettingStarted(true);
              localStorage.removeItem("lucepress-getting-started-collapsed");
            }}
            className="mt-5 flex w-full items-center justify-between rounded-xl border border-dashed border-primary/20 bg-primary/[0.025] px-4 py-3 text-left transition-colors hover:border-primary/40"
          >
            <span className="flex items-center gap-2 text-xs font-extrabold text-primary">
              <CircleHelp className="h-4 w-4" />
              Guide de démarrage · {gettingStartedCount}/{gettingStartedTasks.length}
            </span>
            <span className="text-xs font-bold text-primary">
              Ouvrir <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </span>
          </button>
        ) : null}

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-editorial text-2xl font-semibold">À valider</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.urgent > 0
                  ? `${summary.urgent} urgent${summary.urgent > 1 ? "s" : ""} · ${summary.total} au total`
                  : summary.total > 0
                    ? `${summary.total} action${summary.total > 1 ? "s" : ""}`
                    : `Pilotage ${LUCEPRES_PUBLIC_PROFILE.displayName}`}
              </p>
            </div>
          </div>

          {inbox.length ? (
            <div className="space-y-3">
              {inbox.map((item, index) => (
                <div
                  key={item.id}
                  style={{ animation: `lucepress-rise 0.4s cubic-bezier(0.23, 1, 0.32, 1) ${index * 60}ms both` }}
                >
                  <InboxCard item={item} onOpen={() => setLocation(item.href)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="surface-grid relative flex min-h-56 flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card px-6 text-center">
              <div className="lucepress-ornament absolute inset-0 opacity-40" aria-hidden />
              <div className="relative z-10 flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-editorial text-lg font-semibold">File vide</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Créez un devis ou enregistrez un paiement : les prochaines actions apparaîtront ici automatiquement.
                </p>
                <Button onClick={() => setLocation("/devis/nouveau?assistant=1")} className="mt-5 h-10 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/15">
                  <Sparkles className="mr-2 h-4 w-4" />Créer un devis avec l'IA
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function MiniStat({ label, value, onClick, icon: Icon }: { label: string; value: number; onClick: () => void; icon: typeof UsersRound }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/35"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-extrabold leading-none">{value}</span>
        <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

function InboxCard({ item, onOpen }: { item: TodayInboxItem; onOpen: () => void }) {
  const tone =
    item.priority === "urgent"
      ? "border-red-200 dark:border-red-800 bg-red-50/80"
      : item.priority === "action"
        ? "border-primary/20 bg-primary/[0.03] shadow-[0_18px_40px_-30px_oklch(0.3_0.079_166/55%)]"
        : "border-border bg-card shadow-[0_18px_40px_-32px_oklch(0.18_0.06_164/40%)]";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 sm:p-5 ${tone}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {item.priority === "urgent" && <AlertTriangle className="h-4 w-4 shrink-0 text-red-700 dark:text-red-200" />}
          <p className="text-sm font-extrabold">{item.title}</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
        <p className="mt-3 inline-flex items-center text-xs font-extrabold text-primary">
          {item.cta}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </p>
      </div>
      {item.amountLabel && <p className="shrink-0 font-mono text-sm font-extrabold">{item.amountLabel}</p>}
    </button>
  );
}

function GettingStartedPanel({
  completedCount,
  milestones,
  onOpenTask,
  onDismiss,
}: {
  completedCount: number;
  milestones: { hasClient: boolean; hasQuote: boolean; hasReviewedReceivables: boolean };
  onOpenTask: (task: (typeof gettingStartedTasks)[number]) => void;
  onDismiss: () => void;
}) {
  const progress = Math.round((completedCount / gettingStartedTasks.length) * 100);
  return (
    <section className="mt-5 rounded-2xl border border-primary/18 bg-primary/[0.035] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="lucepress-kicker">Test 48 h</p>
          <h2 className="font-editorial mt-2 text-2xl font-semibold">Trois gestes pour démarrer</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Client → devis → suivi. Ensuite, cette page devient votre file quotidienne.</p>
        </div>
        <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-extrabold text-primary hover:underline">
          Réduire
        </button>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary/10">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 grid gap-3">
        {gettingStartedTasks.map((task, index) => {
          const complete = isGettingStartedTaskComplete(task.id, milestones);
          return (
            <button
              type="button"
              key={task.id}
              onClick={() => onOpenTask(task)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left ${complete ? "border-primary/20 bg-card/80" : "border-border bg-card hover:border-primary/35"}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${complete ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold">{task.label}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{task.description}</span>
              </span>
              {complete ? <CheckCircle2 className="h-4 w-4 text-primary" /> : task.id === "client" ? <UsersRound className="h-4 w-4 text-primary" /> : <ArrowRight className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
