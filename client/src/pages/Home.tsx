import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { countGettingStartedTasks, gettingStartedTasks, isGettingStartedTaskComplete } from "@shared/gettingStarted";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { buildTodayInbox, countTodayInboxByPriority, type TodayInboxItem } from "@shared/todayInbox";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, CircleHelp, FilePlus2, Loader2, Mail, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showGettingStarted, setShowGettingStarted] = useState(() => localStorage.getItem("lucepress-getting-started-collapsed") !== "true");
  const [hasReviewedReceivables, setHasReviewedReceivables] = useState(() => localStorage.getItem("lucepress-getting-started-receivables") === "true");
  const { data: documents = [], isLoading: documentsLoading } = trpc.billing.documents.list.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: clients = [] } = trpc.billing.clients.list.useQuery(undefined, { staleTime: 60_000 });
  const { data: receivables, isLoading: receivablesLoading } = trpc.billing.receivables.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: mailStatus } = trpc.billing.mailStatus.useQuery();
  const isLoading = documentsLoading || receivablesLoading;

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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl pb-10">
        <header className="border-b border-border pb-6">
          <p className="lucepress-kicker">Aujourd’hui</p>
          <h1 className="font-editorial mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {summary.total ? "Votre file à traiter." : "Rien d’urgent pour l’instant."}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Une carte = une décision. Validez, envoyez ou suivez — le reste de Lucepres reste accessible dans le menu.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setLocation("/devis/nouveau?assistant=1")} className="h-10 rounded-xl bg-primary px-4 font-bold text-primary-foreground">
              <FilePlus2 className="mr-2 h-4 w-4" />Nouveau devis
            </Button>
            <Button variant="outline" onClick={() => setLocation("/creances")} className="h-10 rounded-xl border-border bg-card font-bold">
              Créances
            </Button>
            <Button variant="outline" onClick={() => setLocation("/relances")} className="h-10 rounded-xl border-border bg-card font-bold">
              <Mail className="mr-2 h-4 w-4" />Relances
            </Button>
          </div>
        </header>

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

          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : inbox.length ? (
            <div className="space-y-3">
              {inbox.map(item => (
                <InboxCard key={item.id} item={item} onOpen={() => setLocation(item.href)} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-extrabold">File vide</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Créez un devis ou enregistrez un paiement : les prochaines actions apparaîtront ici automatiquement.
              </p>
              <Button onClick={() => setLocation("/devis/nouveau?assistant=1")} className="mt-5 h-10 rounded-xl bg-primary font-bold text-primary-foreground">
                <Sparkles className="mr-2 h-4 w-4" />Créer un devis avec l’IA
              </Button>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function InboxCard({ item, onOpen }: { item: TodayInboxItem; onOpen: () => void }) {
  const tone =
    item.priority === "urgent"
      ? "border-red-200 bg-red-50/80"
      : item.priority === "action"
        ? "border-primary/20 bg-primary/[0.03]"
        : "border-border bg-card";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-transform duration-150 hover:-translate-y-0.5 sm:p-5 ${tone}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {item.priority === "urgent" && <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" />}
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
