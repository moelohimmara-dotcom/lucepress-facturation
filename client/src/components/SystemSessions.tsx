import { Metric } from "@/components/Metric";
import { ScrollableTableRegion } from "@/components/ScrollableTableRegion";
import {
  ConsoleStatusBadge,
  Panel,
  formatConsoleTimestamp,
  type StatusTone,
} from "@/components/SystemConsoleDashboard";
import { Button } from "@/components/ui/button";
import {
  CircleCheck,
  Clock,
  ListChecks,
  Loader2,
  MonitorSmartphone,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from "lucide-react";

/**
 * Écran « Sessions actives » de la console d’exploitation (Phase 3 « Protéger »,
 * module 4 — étape B1).
 *
 * Purement présentationnel : tout provient de `system.sessions.list` et la seule
 * action possible, la révocation, passe par `system.sessions.revoke` (voir
 * `server/systemSessions.ts` et `server/_core/systemRouter.ts`). La décision
 * d’accepter ou de refuser un geste est prise CÔTÉ SERVEUR ; cet écran ne fait
 * que la refléter.
 *
 * Aucune valeur inventée : un registre illisible affiche « indisponible » et
 * laisse le tableau vide, un registre lisible mais vide l’annonce comme tel.
 */

export type ConsoleSessionState = "active" | "revoked" | "expired";

/** Réponse de `system.sessions.list` (voir `server/systemSessions.ts`). */
export type ConsoleSession = {
  id: number;
  userId: number;
  accountName: string | null;
  accountEmail: string | null;
  accountRoleLabel: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  userAgent: string | null;
  clientLabel: string;
  ip: string | null;
  state: ConsoleSessionState;
  current: boolean;
};

export type ConsoleSessions = {
  generatedAt: string;
  scope: "tenant";
  sessions: ConsoleSession[];
  totals: { total: number; active: number; revoked: number; expired: number };
  omitted: number;
  limit: number;
  unavailable: boolean;
};

/** Retour affiché après une révocation : succès, refus, ou échec technique. */
export type SessionNotice = { tone: StatusTone; message: string };

/** Nom affichable d’un compte, sans jamais laisser une cellule vide. */
export function sessionAccountName(session: ConsoleSession): string {
  return session.accountName?.trim() || session.accountEmail?.trim() || `Compte #${session.userId}`;
}

/** Date française (jour + heure), ou « — » si la valeur est absente. */
export function formatSessionDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Libellé et tonalité d’un état de session. */
export function sessionStateBadge(state: ConsoleSessionState): { tone: StatusTone; label: string } {
  if (state === "active") return { tone: "ok", label: "Active" };
  if (state === "revoked") return { tone: "down", label: "Révoquée" };
  return { tone: "warn", label: "Expirée" };
}

/**
 * Verdict de l’écran :
 * - « Indisponible » : le registre n’a pas pu être lu (table absente, base
 *   injoignable). On ne prétend alors PAS qu’il n’y a aucune session ;
 * - « En attente » : la réponse n’est pas encore arrivée ;
 * - « N active(s) » : le registre a répondu ; c’est le décompte réel des
 *   sessions utilisables à cet instant.
 */
export function sessionsVerdict(
  sessions: ConsoleSessions | undefined,
  failed: boolean,
): { tone: StatusTone; label: string } {
  if (failed) return { tone: "down", label: "Indisponible" };
  if (!sessions) return { tone: "unknown", label: "En attente" };
  if (sessions.unavailable) return { tone: "down", label: "Indisponible" };
  return { tone: sessions.totals.active > 0 ? "ok" : "unknown", label: `${sessions.totals.active} active(s)` };
}

function SessionStateBadge({ session }: { session: ConsoleSession }) {
  const badge = sessionStateBadge(session.state);
  return <ConsoleStatusBadge tone={badge.tone} label={badge.label} />;
}

type SystemSessionsPanelProps = {
  sessions: ConsoleSessions | undefined;
  failed: boolean;
  isLoading: boolean;
  /** Identifiant de la session en cours de révocation, ou `null`. */
  revokingId: number | null;
  /** Dernier retour de `system.sessions.revoke`. */
  notice: SessionNotice | null;
  onRevoke: (session: ConsoleSession) => void;
};

/** Écran « Sessions actives » : liste, états, révocation à distance. */
export function SystemSessionsPanel({
  sessions,
  failed,
  isLoading,
  revokingId,
  notice,
  onRevoke,
}: SystemSessionsPanelProps) {
  const verdict = sessionsVerdict(sessions, failed);
  const pending = "…";
  const rows = sessions?.sessions ?? [];
  const totals = sessions?.totals;
  const unavailable = Boolean(sessions?.unavailable) || failed;

  return (
    <div className="space-y-6" data-testid="system-sessions">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">Sessions actives</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Relevé du {sessions ? formatConsoleTimestamp(sessions.generatedAt) : "—"} · sessions ouvertes de l’instance,
            révocation à distance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <ConsoleStatusBadge tone={verdict.tone} label={verdict.label} />
        </div>
      </div>

      {failed && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-extrabold">Relevé des sessions indisponible</p>
            <p className="mt-1 text-xs leading-5">
              La procédure n’a pas répondu. Réessayez avec « Actualiser » ; si le refus persiste, vérifiez que votre rôle
              autorise l’accès à la console.
            </p>
          </div>
        </div>
      )}

      {!failed && sessions?.unavailable && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-extrabold">Registre des sessions illisible</p>
            <p className="mt-1 text-xs leading-5">
              La table des sessions n’a pas pu être interrogée (absente, droits insuffisants ou base injoignable).
              Aucune ligne n’est affichée plutôt que des sessions inventées, et aucune révocation n’est possible
              depuis cet écran.
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div
          data-testid="session-notice"
          className={
            notice.tone === "ok"
              ? "flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
              : notice.tone === "warn"
                ? "flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
                : "flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200"
          }
        >
          {notice.tone === "ok" ? (
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          ) : notice.tone === "warn" ? (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <p className="text-sm leading-5 font-semibold">{notice.message}</p>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-extrabold">Révocation immédiate, sans attendre l’échéance</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            La révocation prend effet dès la requête suivante de la session visée : le registre est consulté à chaque
            appel authentifié. Seule l’empreinte du jeton est stockée — jamais le jeton. La session qui vous authentifie
            ne peut pas être révoquée ici : utilisez « Déconnexion ». Chaque révocation est journalisée côté serveur
            (acteur, session visée, compte, horodatage).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={MonitorSmartphone}
          value={isLoading ? pending : totals ? String(totals.active) : "indisponible"}
          label="Sessions actives"
          tone={totals && totals.active > 0 ? "primary" : "neutral"}
          detail="Ni expirées, ni révoquées"
        />
        <Metric
          icon={XCircle}
          value={isLoading ? pending : totals ? String(totals.revoked) : "indisponible"}
          label="Révoquées"
          tone={totals && totals.revoked > 0 ? "warn" : "neutral"}
          detail="Fermées depuis la console ou à la déconnexion"
        />
        <Metric
          icon={Clock}
          value={isLoading ? pending : totals ? String(totals.expired) : "indisponible"}
          label="Expirées"
          tone="neutral"
          detail="Échéance dépassée, sans révocation"
        />
        <Metric
          icon={ListChecks}
          value={isLoading ? pending : totals ? String(totals.total) : "indisponible"}
          label="Total enregistré"
          tone="neutral"
          detail="Depuis la mise en place du registre"
        />
      </div>

      <Panel title="Instantané du registre">
        <p className="text-xs leading-5 text-muted-foreground">
          Les sessions ouvertes avant la mise en place du registre n’y figurent pas : elles restent valables et ne sont
          donc pas révocables à distance. Elles disparaîtront au fil des reconnexions.
        </p>
        {sessions && sessions.omitted > 0 && (
          <p className="mt-3 rounded-xl border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
            {sessions.omitted} session(s) enregistrée(s) de plus que les {sessions.limit} affichées — la liste est bornée
            aux {sessions.limit} plus récemment actives.
          </p>
        )}
      </Panel>

      <section className="lucepress-panel rounded-[1.35rem] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="lucepress-kicker">Sessions de l’instance</h2>
          <p className="text-xs text-muted-foreground">
            {unavailable ? "registre indisponible" : sessions ? `${rows.length} ligne(s)` : "relevé indisponible"}
          </p>
        </div>

        {!unavailable && rows.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="sessions-empty">
            {isLoading
              ? "Lecture en cours…"
              : "Aucune session enregistrée sur le périmètre de cette instance. Aucune connexion n’a eu lieu depuis la mise en place du registre."}
          </p>
        )}

        {rows.length > 0 && (
          <ScrollableTableRegion
            label="Sessions de l’instance — tableau défilable"
            testId="sessions-table"
            hint="Tableau large : « Révoquer » est la dernière colonne, à droite. Atteignez le tableau avec Tab, puis faites défiler avec les flèches ← →."
          >
            <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-3">Compte</th>
                  <th scope="col" className="py-2 pr-3">Ouverte le</th>
                  <th scope="col" className="py-2 pr-3">Dernière activité</th>
                  <th scope="col" className="py-2 pr-3">Expire le</th>
                  <th scope="col" className="py-2 pr-3">Agent</th>
                  <th scope="col" className="py-2 pr-3">IP</th>
                  <th scope="col" className="py-2 pr-3">État</th>
                  <th scope="col" className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(session => {
                  const revocable = session.state === "active" && !session.current;
                  return (
                    <tr
                      key={session.id}
                      className="border-b border-border/60 last:border-b-0"
                      data-testid={`session-row-${session.id}`}
                      data-session-state={session.state}
                    >
                      <td className="py-2.5 pr-3">
                        <span className="block font-semibold text-foreground">{sessionAccountName(session)}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {session.accountEmail ?? "—"} · {session.accountRoleLabel}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{formatSessionDate(session.createdAt)}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{formatSessionDate(session.lastSeenAt)}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{formatSessionDate(session.expiresAt)}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        <span title={session.userAgent ?? undefined}>{session.clientLabel}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{session.ip ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        <SessionStateBadge session={session} />
                      </td>
                      <td className="py-2.5">
                        {session.current ? (
                          <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            Session courante
                          </span>
                        ) : revocable ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-border text-xs font-bold"
                            disabled={revokingId === session.id}
                            onClick={() => onRevoke(session)}
                            data-testid={`revoke-session-${session.id}`}
                          >
                            {revokingId === session.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            Révoquer
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableTableRegion>
        )}

        <p className="mt-4 text-xs leading-4 text-muted-foreground">
          Ni le jeton de session ni son empreinte ne sont transmis à cette console : la colonne « Session courante » est
          calculée par la base de données. L’agent et l’IP proviennent de la requête de connexion et dépendent du client
          et du réseau : ils situent une session, ils ne prouvent pas qui l’utilise. « Dernière activité » est
          rafraîchie au plus une fois toutes les cinq minutes.
        </p>
      </section>
    </div>
  );
}
