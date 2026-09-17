import { Metric } from "@/components/Metric";
import {
  ConsoleStatusBadge,
  Panel,
  Row,
  formatConsoleTimestamp,
  type StatusTone,
} from "@/components/SystemConsoleDashboard";
import { Activity, CircleCheck, Database, HardDrive, Loader2, ShieldCheck, Table2, TriangleAlert, Zap } from "lucide-react";

/**
 * Écran « Santé & supervision » de la console d’exploitation (Phase 2, module 2).
 *
 * Purement présentationnel : toutes les mesures viennent de la procédure
 * `system.metrics` (voir `server/systemMetrics.ts`). Aucune valeur n’est
 * inventée — une mesure absente est affichée « indisponible », et l’usage du
 * pool, non exposé par le pilote PostgreSQL, est affiché « non communiqué ».
 */

export type ConsoleMetricsTable = { name: string; bytes: number };

/** Réponse de `system.metrics` (voir `server/systemMetrics.ts`). */
export type ConsoleMetrics = {
  generatedAt: string;
  database: {
    reachable: boolean;
    latencyMs: number | null;
    pool: { limit: number; observedConnections: number | null };
    sizeBytes: number | null;
    tables: ConsoleMetricsTable[];
  };
  counts: {
    clients: number | null;
    documents: number | null;
    pendingInvitations: number | null;
    accounts: number | null;
  };
  migration: { tracked: boolean; appliedAt: string | null; hash: string | null };
  unavailable: string[];
};

/** Unités lisibles pour des octets (base 1024, format français). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "indisponible";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value);
  return `${formatted} ${units[unit]}`;
}

/** Latence en millisecondes, ou « indisponible » si la mesure n’a pas pu être prise. */
export function formatLatency(latencyMs: number | null | undefined): string {
  if (latencyMs === null || latencyMs === undefined || !Number.isFinite(latencyMs)) return "indisponible";
  return `${Math.round(latencyMs)} ms`;
}

/** Compteur entier, ou « indisponible » (jamais 0 par défaut). */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "indisponible";
  return new Intl.NumberFormat("fr-FR").format(value);
}

/**
 * Verdict d’ensemble de l’écran :
 * - « Indisponible » : le relevé lui-même n’a pas pu être obtenu ;
 * - « OK » : base joignable et toutes les mesures relevées ;
 * - « Attention » : base injoignable ou au moins une mesure indisponible.
 */
export function supervisionVerdict(metrics: ConsoleMetrics | undefined, failed: boolean): { tone: StatusTone; label: string } {
  if (failed) return { tone: "down", label: "Indisponible" };
  if (!metrics) return { tone: "unknown", label: "En attente" };
  if (!metrics.database.reachable) return { tone: "warn", label: "Attention" };
  if (metrics.unavailable.length > 0) return { tone: "warn", label: "Attention" };
  return { tone: "ok", label: "OK" };
}

type SupervisionPanelProps = {
  metrics: ConsoleMetrics | undefined;
  failed: boolean;
  isLoading: boolean;
};

/** Relevé de supervision : base, pool, compteurs métier, stockage et migrations. */
export function SystemSupervisionPanel({ metrics, failed, isLoading }: SupervisionPanelProps) {
  const verdict = supervisionVerdict(metrics, failed);
  const pending = "…";
  const database = metrics?.database;
  const tables = database?.tables ?? [];
  const largestTable = tables.length > 0 ? tables[0].bytes : 0;

  return (
    <div className="space-y-6" data-testid="system-supervision">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">Santé &amp; supervision</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Dernier relevé : {metrics ? formatConsoleTimestamp(metrics.generatedAt) : "—"} · mesures serveur, lecture seule
          </p>
        </div>
        <ConsoleStatusBadge tone={verdict.tone} label={verdict.label} />
      </div>

      {failed && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-extrabold">Mesures indisponibles</p>
            <p className="mt-1 text-xs leading-5">
              La procédure de supervision n’a pas répondu. Réessayez avec « Actualiser » ; si le refus persiste, vérifiez
              que votre rôle autorise l’accès à la console.
            </p>
          </div>
        </div>
      )}

      {isLoading && !metrics && (
        <p className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Relevé en cours…
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Database}
          value={isLoading && !metrics ? pending : !metrics ? "—" : database?.reachable ? "Accessible" : "Injoignable"}
          label="Base de données"
          tone={!metrics ? "neutral" : database?.reachable ? "primary" : "danger"}
          detail="Requête de santé (SELECT 1)"
        />
        <Metric
          icon={Zap}
          value={isLoading && !metrics ? pending : database?.reachable ? formatLatency(database?.latencyMs) : "indisponible"}
          label="Latence"
          tone="neutral"
          detail="Mesurée côté serveur autour du test de connexion"
        />
        <Metric
          icon={HardDrive}
          value={isLoading && !metrics ? pending : formatBytes(database?.sizeBytes)}
          label="Taille de la base"
          tone="neutral"
          detail="pg_database_size de la base courante"
        />
        <Metric
          icon={ShieldCheck}
          value={isLoading && !metrics ? pending : metrics ? String(database?.pool.limit ?? "—") : "—"}
          label="Pool configuré"
          tone="neutral"
          detail="Taille maximale du pool de connexions"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Pool de connexions">
          <Row label="Taille configurée">{metrics ? formatCount(database?.pool.limit) : "—"}</Row>
          <Row label="Usage observé">{"non communiqué"}</Row>
          <Row label="Connexions ouvertes sur la base">
            {isLoading && !metrics ? pending : !metrics ? "—" : formatCount(database?.pool.observedConnections)}
          </Row>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Le pilote PostgreSQL n’expose pas le nombre de connexions réellement empruntées dans le pool : cette valeur
            n’est pas communiquée, plutôt que déduite. Le nombre de connexions ouvertes est relevé côté serveur
            (pg_stat_activity) pour la base courante.
          </p>
        </Panel>

        <Panel title="Compteurs métier">
          <Row label="Clients">{isLoading && !metrics ? pending : formatCount(metrics?.counts.clients)}</Row>
          <Row label="Documents">{isLoading && !metrics ? pending : formatCount(metrics?.counts.documents)}</Row>
          <Row label="Invitations en attente">
            {isLoading && !metrics ? pending : formatCount(metrics?.counts.pendingInvitations)}
          </Row>
          <Row label="Comptes">{isLoading && !metrics ? pending : formatCount(metrics?.counts.accounts)}</Row>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Comptages de l’instance entière (tous espaces confondus), relevés par requêtes count en lecture seule.
          </p>
        </Panel>

        <Panel title="Stockage">
          <Row label="Base de données">{formatBytes(metrics?.database.sizeBytes)}</Row>
          <Row label="Tables principales">{metrics ? formatCount(tables.length) : "—"}</Row>
          {tables.length === 0 ? (
            <p className="pt-3 text-xs leading-5 text-muted-foreground">
              Taille des tables indisponible : aucune des tables principales n’a pu être mesurée.
            </p>
          ) : (
            <ul className="pt-3" data-testid="system-supervision-tables">
              {tables.map(table => (
                <li key={table.name} className="flex items-center gap-3 border-b border-border/60 py-1.5 last:border-b-0">
                  <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{table.name}</span>
                  <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{ width: `${largestTable > 0 ? Math.max(4, Math.round((table.bytes / largestTable) * 100)) : 0}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-xs font-bold text-foreground">
                    {formatBytes(table.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Migration">
          <Row label="Suivi Drizzle">
            {!metrics ? "—" : metrics.migration.tracked ? "présent" : "absent"}
          </Row>
          <Row label="Dernière migration">
            {isLoading && !metrics ? pending : metrics?.migration.appliedAt ? formatConsoleTimestamp(metrics.migration.appliedAt) : "indisponible"}
          </Row>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {metrics && !metrics.migration.tracked
              ? "Cette base ne possède pas le schéma de suivi drizzle.__drizzle_migrations : la dernière migration appliquée n’est pas lisible ici."
              : "Relevé dans drizzle.__drizzle_migrations (suivi des migrations Drizzle)."}
          </p>
        </Panel>
      </div>

      {metrics && metrics.unavailable.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-extrabold text-foreground">Mesures indisponibles sur ce relevé</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{metrics.unavailable.join(" · ")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Ces mesures n’ont pas pu être lues (droits ou disponibilité) : elles sont affichées « indisponible »
              plutôt que remplacées par une valeur approchée.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Activity className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs leading-5 text-muted-foreground">
          Cette console observe le système en lecture seule : aucune donnée commerciale n’est modifiée, et aucun
          secret n’est affiché.
        </p>
      </div>
    </div>
  );
}
