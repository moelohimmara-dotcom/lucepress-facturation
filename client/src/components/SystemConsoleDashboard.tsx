import { Metric } from "@/components/Metric";
import {
  Activity,
  Briefcase,
  Cable,
  CircleCheck,
  Clock,
  Database,
  DatabaseBackup,
  FolderCog,
  HardDrive,
  KeyRound,
  ListChecks,
  Loader2,
  MonitorSmartphone,
  ScrollText,
  Server,
  ShieldCheck,
  SquareTerminal,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

/**
 * Parties présentationnelles de la console d’exploitation (Phases 1 et 2).
 * Aucune donnée inventée : tout provient de `/api/health`, de `system.overview`
 * et de `system.metrics`, transmis par les pages. Ces composants sont purement
 * rendus (testables sans réseau) et n’importent pas de routeur : la navigation
 * interne leur est fournie par la page via `onNavigate`, ce qui laisse un
 * `<a href>` inerte lorsqu’ils sont rendus hors application.
 */

/** Réponse de `/api/health` (voir `server/_core/health.ts`). */
export type ConsoleHealth = {
  ok: boolean;
  db: "up" | "down";
  uptimeSec: number;
  poolLimit: number;
  timestamp?: string;
};

export type ConsoleOverview = {
  application: { name: string; version: string | null };
};

/** Navigation interne (wouter) fournie par la page qui affiche la console. */
export type ConsoleNavigate = (path: string) => void;

type ConsoleModule = {
  label: string;
  icon: LucideIcon;
  /** Route de l’écran lorsque le module est livré ; absent tant qu’il ne l’est pas. */
  path?: string;
  /** Résumé court affiché par les accès rapides. */
  summary?: string;
  /** Phase de livraison prévue (cahier des charges § 9). */
  phase: string;
};

export const CONSOLE_MODULES: ConsoleModule[] = [
  {
    label: "Tableau de bord",
    icon: Activity,
    path: "/console",
    summary: "Santé applicative, version déployée et disponibilité.",
    phase: "Phase 1",
  },
  {
    label: "Santé & supervision",
    icon: ShieldCheck,
    path: "/console/sante",
    summary: "Base, latence, pool, compteurs métier et migrations.",
    phase: "Phase 2",
  },
  { label: "Base & sauvegardes", icon: DatabaseBackup, phase: "Phase 4" },
  {
    label: "Accès & comptes",
    icon: KeyRound,
    path: "/console/acces",
    summary: "Comptes staff et portail, invitations, moyens d’accès.",
    phase: "Phase 3",
  },
  {
    label: "Sessions actives",
    icon: MonitorSmartphone,
    path: "/console/sessions",
    summary: "Sessions ouvertes de l’instance, révocation à distance.",
    phase: "Phase 3",
  },
  {
    label: "Rôles & permissions",
    icon: UsersRound,
    path: "/console/permissions",
    summary: "Matrice de référence capacités × rôles, en lecture seule.",
    phase: "Phase 3",
  },
  {
    label: "Données & métier",
    icon: Briefcase,
    path: "/console/metier",
    summary: "Hub vers les écrans métier : documents, clients, chantiers, créances…",
    phase: "Phase 3",
  },
  { label: "Environnement", icon: FolderCog, phase: "Phase 4" },
  { label: "Intégrations", icon: Cable, phase: "Phase 5" },
  { label: "Tâches & files", icon: ListChecks, phase: "Phase 5" },
  { label: "Journal technique", icon: ScrollText, phase: "Phase 2" },
  { label: "Données & conformité", icon: HardDrive, phase: "Phase 5" },
];

/** Modules déjà livrés : ceux qui portent une route. */
export const DELIVERED_CONSOLE_MODULES = CONSOLE_MODULES.filter(module => module.path !== undefined);

export function formatUptime(uptimeSec: number): string {
  const seconds = Math.max(0, Math.floor(uptimeSec));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} s`;
}

export function formatConsoleDate(value: Date): string {
  return value.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatConsoleTime(value: Date): string {
  return value.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Horodatage complet en français (secondes incluses), ou « — » si absent. */
export function formatConsoleTimestamp(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export type StatusTone = "ok" | "warn" | "down" | "unknown";

function StatusDot({ tone }: { tone: StatusTone }) {
  const className =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "down"
          ? "bg-rose-500"
          : "bg-muted-foreground/40";
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} aria-hidden="true" />;
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="lucepress-panel rounded-[1.35rem] p-5">
      <h2 className="lucepress-kicker">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-bold text-foreground">{children}</span>
    </div>
  );
}

/** Badge d’état simple : « OK » / « Attention » / « Indisponible ». */
export function ConsoleStatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const className =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
        : tone === "down"
          ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] ${className}`}>
      <StatusDot tone={tone} />
      {label}
    </span>
  );
}

/** Lien interne de la console : navigation applicative si la page la fournit. */
export function ConsoleLink({
  href,
  onNavigate,
  className,
  current,
  testId,
  children,
}: {
  href: string;
  onNavigate?: ConsoleNavigate;
  className: string;
  current?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return;
    // On laisse le navigateur gérer les ouvertures dans un nouvel onglet / une
    // fenêtre et tout clic modifié : seul le clic simple devient interne.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };
  return (
    <a
      href={href}
      onClick={handleClick}
      aria-current={current ? "page" : undefined}
      data-testid={testId}
      className={className}
    >
      {children}
    </a>
  );
}

/** Rail des modules de la console : les écrans livrés sont navigables. */
export function ConsoleModuleRail({ activePath = "/console", onNavigate }: { activePath?: string; onNavigate?: ConsoleNavigate }) {
  return (
    <nav aria-label="Modules de la console" className="lucepress-panel h-fit rounded-[1.35rem] p-3">
      <p className="px-2 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Modules</p>
      <ul className="space-y-1">
        {CONSOLE_MODULES.map(module => {
          const Icon = module.icon;
          const path = module.path;
          const active = path !== undefined && path === activePath;
          const testId = `console-module-${module.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
          const className = `flex items-center gap-2.5 rounded-xl px-3 py-2 ${
            active
              ? "bg-secondary font-bold text-primary"
              : path
                ? "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                : "text-muted-foreground"
          }`;
          const body = (
            <>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{module.label}</span>
              {!path && (
                <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
                  {module.phase}
                </span>
              )}
            </>
          );
          return (
            <li key={module.label}>
              {path ? (
                <ConsoleLink href={path} onNavigate={onNavigate} current={active} testId={testId} className={className}>
                  {body}
                </ConsoleLink>
              ) : (
                <div aria-disabled="true" data-testid={testId} className={className}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-3 pt-3 text-[11px] leading-4 text-muted-foreground">
        Les modules annotés d’une phase seront livrés lors des phases suivantes.
      </p>
    </nav>
  );
}

/** Accès rapides vers les écrans déjà livrés de la console. */
export function ConsoleQuickAccess({ onNavigate }: { onNavigate?: ConsoleNavigate }) {
  return (
    <section aria-label="Accès rapides" className="lucepress-panel rounded-[1.35rem] p-5">
      <h2 className="lucepress-kicker">Accès rapides</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {DELIVERED_CONSOLE_MODULES.map(module => {
          const Icon = module.icon;
          const path = module.path as string;
          return (
            <ConsoleLink
              key={module.label}
              href={path}
              onNavigate={onNavigate}
              testId={`console-quick-${module.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">{module.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{module.summary}</span>
                <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{path}</span>
              </span>
            </ConsoleLink>
          );
        })}
      </div>
    </section>
  );
}

type SystemDashboardProps = {
  health: ConsoleHealth | null;
  healthError: string | null;
  isLoadingHealth: boolean;
  overview: ConsoleOverview | undefined;
  isLoadingOverview: boolean;
  overviewFailed: boolean;
  now: Date;
  onNavigate?: ConsoleNavigate;
};

/** Tableau de bord système — santé globale, version, disponibilité et accès. */
export function SystemDashboard({
  health,
  healthError,
  isLoadingHealth,
  overview,
  isLoadingOverview,
  overviewFailed,
  now,
  onNavigate,
}: SystemDashboardProps) {
  const dbTone: StatusTone = health ? (health.db === "up" ? "ok" : "down") : "unknown";
  // État global : l’application répond-elle, et sa base est-elle joignable ?
  const globalState: { label: string; tone: StatusTone } = health
    ? health.ok
      ? { label: "En ligne", tone: "ok" }
      : { label: "Dégradé", tone: "warn" }
    : healthError
      ? { label: "Hors ligne", tone: "down" }
      : { label: "Inconnu", tone: "unknown" };
  const pending = "…";

  return (
    <div className="space-y-6" data-testid="system-dashboard">
      <div>
        <h2 className="font-editorial text-xl font-semibold">Tableau de bord système</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Relevé du {formatConsoleDate(now)} à {formatConsoleTime(now)} · Conakry
        </p>
      </div>

      {healthError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-extrabold">Relevé de santé indisponible</p>
            <p className="mt-1 text-xs leading-5">{healthError}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Activity}
          value={
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={globalState.tone} />
              {isLoadingHealth ? pending : globalState.label}
            </span>
          }
          label="État global"
          tone={globalState.tone === "ok" ? "primary" : globalState.tone === "warn" ? "warn" : globalState.tone === "down" ? "danger" : "neutral"}
          detail="Application et base de données"
        />
        <Metric
          icon={Database}
          value={
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={dbTone} />
              {isLoadingHealth ? pending : health ? (health.db === "up" ? "Accessible" : "Injoignable") : "Inconnu"}
            </span>
          }
          label="Base de données"
          tone={dbTone === "ok" ? "primary" : dbTone === "down" ? "danger" : "neutral"}
          detail="Test de connexion (SELECT 1)"
        />
        <Metric
          icon={Clock}
          value={isLoadingHealth ? pending : health ? formatUptime(health.uptimeSec) : "—"}
          label="Disponibilité"
          tone="neutral"
          detail="Depuis le dernier démarrage du processus"
        />
        <Metric
          icon={Server}
          value={isLoadingHealth ? pending : health ? String(health.poolLimit) : "—"}
          label="Connexions max"
          tone="neutral"
          detail="Taille du pool de connexions"
        />
      </div>

      <ConsoleQuickAccess onNavigate={onNavigate} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Application">
          <Row label="Nom">{overview?.application.name ?? "Lucepress Facturation"}</Row>
          <Row label="Version">{isLoadingOverview ? pending : (overview?.application.version ?? "non communiquée")}</Row>
          <Row label="Date">{`${formatConsoleDate(now)} · ${formatConsoleTime(now)}`}</Row>
        </Panel>

        <Panel title="Système">
          <Row label="Console">{"/console · Phase 2"}</Row>
          <Row label="Dernière vérification">{formatConsoleTimestamp(health?.timestamp)}</Row>
          <Row label="Contrôle serveur">
            {isLoadingOverview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : overviewFailed ? (
              <span className="inline-flex items-center gap-2 text-rose-700 dark:text-rose-200">
                <TriangleAlert className="h-4 w-4" /> refusé
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-200">
                <CircleCheck className="h-4 w-4" /> vérifié
              </span>
            )}
          </Row>
          <Row label="Mode">Consultation (lecture seule)</Row>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <SquareTerminal className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-xs leading-5 text-muted-foreground">
          Les modules de sauvegarde, de gestion des accès et d’environnement arrivent dans les phases suivantes.
          Aucune donnée commerciale n’est modifiable depuis cette console.
        </p>
      </div>
    </div>
  );
}
