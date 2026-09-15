import { Metric } from "@/components/Metric";
import {
  Activity,
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
  ScrollText,
  Server,
  ShieldCheck,
  SquareTerminal,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Parties présentationnelles de la console d’exploitation (Phase 1 — socle).
 * Aucune donnée inventée : tout provient de `/api/health` et de `system.overview`,
 * transmis par la page. Ces composants sont purement rendus (testables sans réseau).
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

type ConsoleModule = {
  label: string;
  icon: LucideIcon;
  /** Disponible en Phase 1 — les autres modules arrivent aux phases suivantes. */
  available?: boolean;
  /** Phase de livraison prévue (cahier des charges § 9). */
  phase: string;
};

export const CONSOLE_MODULES: ConsoleModule[] = [
  { label: "Tableau de bord", icon: Activity, available: true, phase: "Phase 1" },
  { label: "Santé & supervision", icon: ShieldCheck, phase: "Phase 2" },
  { label: "Base & sauvegardes", icon: DatabaseBackup, phase: "Phase 4" },
  { label: "Accès & sessions", icon: KeyRound, phase: "Phase 3" },
  { label: "Rôles & permissions", icon: UsersRound, phase: "Phase 3" },
  { label: "Environnement", icon: FolderCog, phase: "Phase 4" },
  { label: "Intégrations", icon: Cable, phase: "Phase 5" },
  { label: "Tâches & files", icon: ListChecks, phase: "Phase 5" },
  { label: "Journal technique", icon: ScrollText, phase: "Phase 2" },
  { label: "Données & conformité", icon: HardDrive, phase: "Phase 5" },
];

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

function StatusDot({ tone }: { tone: "ok" | "down" | "unknown" }) {
  const className = tone === "ok" ? "bg-emerald-500" : tone === "down" ? "bg-rose-500" : "bg-muted-foreground/40";
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} aria-hidden="true" />;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="lucepress-panel rounded-[1.35rem] p-5">
      <h2 className="lucepress-kicker">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-bold text-foreground">{children}</span>
    </div>
  );
}

/** Rail des modules de la console : un seul actif en Phase 1. */
export function ConsoleModuleRail() {
  return (
    <nav aria-label="Modules de la console" className="lucepress-panel h-fit rounded-[1.35rem] p-3">
      <p className="px-2 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Modules</p>
      <ul className="space-y-1">
        {CONSOLE_MODULES.map(module => {
          const Icon = module.icon;
          return (
            <li key={module.label}>
              <div
                aria-current={module.available ? "page" : undefined}
                aria-disabled={module.available ? undefined : true}
                data-testid={`console-module-${module.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${module.available ? "bg-secondary font-bold text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{module.label}</span>
                {!module.available && (
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
                    {module.phase}
                  </span>
                )}
              </div>
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

type SystemDashboardProps = {
  health: ConsoleHealth | null;
  healthError: string | null;
  isLoadingHealth: boolean;
  overview: ConsoleOverview | undefined;
  isLoadingOverview: boolean;
  overviewFailed: boolean;
  now: Date;
};

/** Tableau de bord système — santé applicative, version et date. */
export function SystemDashboard({
  health,
  healthError,
  isLoadingHealth,
  overview,
  isLoadingOverview,
  overviewFailed,
  now,
}: SystemDashboardProps) {
  const dbTone: "ok" | "down" | "unknown" = health ? (health.db === "up" ? "ok" : "down") : "unknown";
  const appTone: "ok" | "down" | "unknown" = health ? (health.ok ? "ok" : "down") : "unknown";
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
              <StatusDot tone={appTone} />
              {isLoadingHealth ? pending : health ? (health.ok ? "En ligne" : "Dégradé") : "Inconnu"}
            </span>
          }
          label="Application"
          tone={appTone === "ok" ? "primary" : appTone === "down" ? "danger" : "neutral"}
          detail="Endpoint /api/health"
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Application">
          <Row label="Nom">{overview?.application.name ?? "Lucepress Facturation"}</Row>
          <Row label="Version">{isLoadingOverview ? pending : (overview?.application.version ?? "non communiquée")}</Row>
          <Row label="Date">{`${formatConsoleDate(now)} · ${formatConsoleTime(now)}`}</Row>
        </Panel>

        <Panel title="Système">
          <Row label="Console">{"/console · Phase 1"}</Row>
          <Row label="Dernier relevé">
            {health?.timestamp
              ? new Date(health.timestamp).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—"}
          </Row>
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
          Les modules de supervision détaillée, de sauvegarde et de gestion des accès arrivent dans les phases
          suivantes. Aucune donnée commerciale n’est modifiable depuis cette console.
        </p>
      </div>
    </div>
  );
}
