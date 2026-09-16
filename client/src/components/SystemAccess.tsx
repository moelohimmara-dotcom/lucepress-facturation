import { Metric } from "@/components/Metric";
import {
  ConsoleStatusBadge,
  Panel,
  Row,
  formatConsoleTimestamp,
  type StatusTone,
} from "@/components/SystemConsoleDashboard";
import {
  CircleCheck,
  CircleMinus,
  KeyRound,
  Loader2,
  ShieldAlert,
  TriangleAlert,
  UserRound,
  UsersRound,
} from "lucide-react";

/**
 * Écran « Accès & comptes » de la console d’exploitation (Phase 3 « Protéger »,
 * module 4 — étape A, lecture seule).
 *
 * Purement présentationnel : tout provient de la procédure `system.access` (voir
 * `server/systemAccess.ts`). Cet écran n’offre AUCUNE action — il n’existe côté
 * serveur que des lectures ; l’édition des comptes, des rôles et des mots de
 * passe reste dans le back-office (admin), et la MFA attend une migration.
 *
 * Aucune valeur n’est inventée : un compte non lisible affiche un état vide
 * explicite, et un moyen d’accès indisponible est annoncé comme tel avec sa
 * raison.
 */

/** Réponse de `system.access` (voir `server/systemAccess.ts`). */
export type ConsoleAccessAccount = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  lastSignedIn: string | null;
  createdAt: string | null;
};

export type ConsoleAccessRoleCount = { role: string; label: string; count: number };

export type ConsoleAccess = {
  generatedAt: string;
  scope: "tenant";
  accounts: ConsoleAccessAccount[];
  accountsTotal: number;
  roleCounts: ConsoleAccessRoleCount[];
  invitations: { total: number; byRole: ConsoleAccessRoleCount[] } | null;
  accessMeans: Array<{ key: string; label: string; available: boolean; detail: string }>;
  passwordPolicy: {
    minLength: number;
    maxLength: number;
    hashing: {
      algorithm: string;
      saltBytes: number;
      keyBytes: number;
      storedFormat: string;
      comparison: string;
      implementation: string;
    };
    complexity: string | null;
    resetLinkTtlMinutes: number;
    protections: string[];
    enforcedBy: string[];
  };
  unavailable: string[];
};

/** Compte du portail client : il est cloisonné, on le distingue à l’affichage. */
export function isPortalAccount(account: ConsoleAccessAccount): boolean {
  return account.role === "client";
}

/** Nom affichable d’un compte, sans jamais laisser une cellule vide. */
export function accountDisplayName(account: ConsoleAccessAccount): string {
  return account.name?.trim() || account.email?.trim() || `Compte #${account.id}`;
}

/** Date française (jour + heure), ou « — » si la valeur est absente. */
export function formatAccessDate(value: string | null | undefined): string {
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

/**
 * Verdict de l’écran :
 * - « Indisponible » : la procédure n’a pas répondu ;
 * - « Partiel » : au moins une lecture a échoué ;
 * - « Lecture seule » : les comptes ont été lus, aucune écriture n’est offerte.
 */
export function accessVerdict(access: ConsoleAccess | undefined, failed: boolean): { tone: StatusTone; label: string } {
  if (failed) return { tone: "down", label: "Indisponible" };
  if (!access) return { tone: "unknown", label: "En attente" };
  if (access.unavailable.length > 0) return { tone: "warn", label: "Partiel" };
  return { tone: "ok", label: "Lecture seule" };
}

function MeanBadge({ available }: { available: boolean }) {
  return available ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
      <CircleCheck className="h-3 w-3" />
      Disponible
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
      <CircleMinus className="h-3 w-3" />
      Non disponible
    </span>
  );
}

function RoleBadge({ role, label }: { role: string; label: string }) {
  const portal = role === "client";
  return (
    <span
      className={
        portal
          ? "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
          : "rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground"
      }
      data-testid={`access-role-${role}`}
    >
      {label}
    </span>
  );
}

type SystemAccessPanelProps = {
  access: ConsoleAccess | undefined;
  failed: boolean;
  isLoading: boolean;
};

/** Écran « Accès & comptes » : comptes, invitations, moyens d’accès, politique. */
export function SystemAccessPanel({ access, failed, isLoading }: SystemAccessPanelProps) {
  const verdict = accessVerdict(access, failed);
  const pending = "…";
  const accounts = access?.accounts ?? [];
  const roleCounts = access?.roleCounts ?? [];
  const portalCount = accounts.filter(isPortalAccount).length;
  const staffCount = accounts.length - portalCount;
  const accountsUnavailable = access?.unavailable.includes("accounts") ?? false;

  return (
    <div className="space-y-6" data-testid="system-access">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">Accès &amp; comptes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Relevé du {access ? formatConsoleTimestamp(access.generatedAt) : "—"} · comptes staff et portail client, lecture seule
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <ConsoleStatusBadge tone={verdict.tone} label={verdict.label} />
        </div>
      </div>

      {failed && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-extrabold">Relevé des accès indisponible</p>
            <p className="mt-1 text-xs leading-5">
              La procédure d’accès n’a pas répondu. Réessayez avec « Actualiser » ; si le refus persiste, vérifiez que
              votre rôle autorise l’accès à la console.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-extrabold">Consultation seule</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Cet écran ne crée, ne modifie et ne supprime aucun compte : il n’existe côté serveur que des lectures.
            La gestion des comptes reste dans « Comptes collaborateurs », et aucune session ne peut être révoquée ici.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={UsersRound}
          value={isLoading ? pending : access ? String(access.accountsTotal) : "—"}
          label="Comptes"
          tone="primary"
          detail="Staff et portail client confondus"
        />
        <Metric
          icon={UserRound}
          value={isLoading ? pending : access ? String(staffCount) : "—"}
          label="Comptes internes"
          tone="neutral"
          detail="Admin, direction, cadres, administrateur système"
        />
        <Metric
          icon={KeyRound}
          value={isLoading ? pending : access ? String(portalCount) : "—"}
          label="Comptes portail client"
          tone="neutral"
          detail="Accès cloisonné aux documents partagés"
        />
        <Metric
          icon={TriangleAlert}
          value={isLoading ? pending : access?.invitations ? String(access.invitations.total) : "indisponible"}
          label="Invitations en attente"
          tone={access?.invitations && access.invitations.total > 0 ? "warn" : "neutral"}
          detail="Jetons jamais transmis à la console"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Répartition par rôle">
          {roleCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun rôle à répartir sur ce relevé.</p>
          ) : (
            roleCounts.map(entry => (
              <Row key={entry.role} label={entry.label}>
                {entry.count}
              </Row>
            ))
          )}
        </Panel>

        <Panel title="Invitations en attente">
          {!access?.invitations ? (
            <p className="text-xs text-muted-foreground">
              Comptage indisponible : les invitations n’ont pas pu être lues. Aucun zéro n’est affiché à la place.
            </p>
          ) : access.invitations.total === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune invitation en attente.</p>
          ) : (
            <>
              <Row label="Total">{access.invitations.total}</Row>
              {access.invitations.byRole
                .filter(entry => entry.count > 0)
                .map(entry => (
                  <Row key={entry.role} label={`Rôle visé · ${entry.label}`}>
                    {entry.count}
                  </Row>
                ))}
            </>
          )}
          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
            Seuls des nombres par rôle sont remontés : ni jeton d’invitation, ni adresse e-mail.
          </p>
        </Panel>
      </div>

      <Panel title="Moyens d’accès & de session">
        <ul className="space-y-3">
          {(access?.accessMeans ?? []).map(mean => (
            <li key={mean.key} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{mean.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{mean.detail}</p>
              </div>
              <MeanBadge available={mean.available} />
            </li>
          ))}
        </ul>
        {access?.accessMeans.length === 0 && (
          <p className="text-xs text-muted-foreground">Relevé indisponible.</p>
        )}
      </Panel>

      {access && (
        <Panel title="Politique de mot de passe">
          <Row label="Longueur">{`${access.passwordPolicy.minLength} à ${access.passwordPolicy.maxLength} caractères`}</Row>
          <Row label="Hachage">{access.passwordPolicy.hashing.algorithm}</Row>
          <Row label="Sel & clé">{`${access.passwordPolicy.hashing.saltBytes} octets de sel · clé de ${access.passwordPolicy.hashing.keyBytes} octets`}</Row>
          <Row label="Comparaison">{access.passwordPolicy.hashing.comparison}</Row>
          <Row label="Complexité">{access.passwordPolicy.complexity ?? "aucune exigence imposée"}</Row>
          <Row label="Validité du lien de réinitialisation">{`${access.passwordPolicy.resetLinkTtlMinutes} min`}</Row>
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
            Garde-fous en place
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
            {access.passwordPolicy.protections.map(protection => (
              <li key={protection}>{protection}</li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
            Imposée par : {access.passwordPolicy.enforcedBy.join(", ")} — source {access.passwordPolicy.hashing.implementation}.
          </p>
        </Panel>
      )}

      <section className="lucepress-panel rounded-[1.35rem] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="lucepress-kicker">Comptes de l’instance</h2>
          <p className="text-[11px] text-muted-foreground">
            {access ? `${access.accountsTotal} compte(s)` : "relevé indisponible"}
          </p>
        </div>

        {accountsUnavailable && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
            La liste des comptes n’a pas pu être lue. Aucune ligne n’est affichée plutôt que des comptes inventés.
          </p>
        )}

        {!accountsUnavailable && accounts.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {isLoading ? "Lecture en cours…" : "Aucun compte sur le périmètre de cette instance."}
          </p>
        )}

        {accounts.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-3">Nom</th>
                  <th scope="col" className="py-2 pr-3">E-mail</th>
                  <th scope="col" className="py-2 pr-3">Rôle</th>
                  <th scope="col" className="py-2 pr-3">Dernière connexion</th>
                  <th scope="col" className="py-2">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr key={account.id} className="border-b border-border/60 last:border-b-0" data-testid={`access-account-${account.id}`}>
                    <td className="py-2.5 pr-3 font-semibold text-foreground">{accountDisplayName(account)}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{account.email ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <RoleBadge
                        role={account.role}
                        label={roleCounts.find(entry => entry.role === account.role)?.label ?? account.role}
                      />
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{formatAccessDate(account.lastSignedIn)}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{formatAccessDate(account.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
          Aucun mot de passe, aucune empreinte de mot de passe et aucun jeton ne sont lus par cette console. La date de
          « dernière connexion » est initialisée à la création du compte : elle ne prouve pas une connexion réelle.
        </p>
      </section>
    </div>
  );
}
