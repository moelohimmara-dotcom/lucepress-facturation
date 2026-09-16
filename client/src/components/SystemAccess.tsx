import { Metric } from "@/components/Metric";
import {
  AccessAdministrationBanner,
  AccessNoticeBanner,
  ExpiredInvitationMark,
  JournalisedMention,
  accessAccountLabel,
  roleLabel,
  type AccessActionInvitation,
  type AccessNotice,
} from "@/components/SystemAccessActions";
import {
  ConsoleStatusBadge,
  Panel,
  Row,
  formatConsoleTimestamp,
  type StatusTone,
} from "@/components/SystemConsoleDashboard";
import { Button } from "@/components/ui/button";
import {
  CircleCheck,
  CircleMinus,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  UserCog,
  UserRound,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";

/**
 * Écran « Accès & comptes » de la console d’exploitation (Phase 3 « Protéger »,
 * module 4 — étape A, lecture seule).
 *
 * Purement présentationnel : tout provient de la procédure `system.access` (voir
 * `server/systemAccess.ts`). CET écran n’offre aucune action : l’édition des
 * comptes, des rôles et des mots de passe reste dans le back-office (admin), et
 * la MFA se gère depuis le tableau de bord de la console (panneau « Ma double
 * authentification »), chacun pour son propre compte. La révocation de session,
 * elle, vit sur l’écran voisin « Sessions actives » : deux responsabilités, deux
 * écrans.
 *
 * La colonne « second facteur » est un BOOLÉEN : elle dit si la MFA est active
 * sur le compte, jamais quel en est le secret ni combien de codes de secours
 * restent — ces informations n’existent pas dans la réponse de `system.access`.
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
  /** MFA active sur ce compte. Booléen seul : aucun secret ne circule. */
  mfaEnabled: boolean;
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
  // Une seule règle de nommage pour tout l’écran : celle de
  // `SystemAccessActions`, que les boîtes de dialogue utilisent aussi. Deux
  // implémentations finiraient par désigner la même personne autrement d’une
  // fenêtre à l’autre — et une suppression confirmée « sur le bon nom » ne
  // voudrait plus rien dire.
  return accessAccountLabel(account);
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
 * - « Lecture seule » : les comptes ont été lus et l’écran n’offre AUCUNE action
 *   (c’est le cas quand aucun gestionnaire ne lui est fourni) ;
 * - « Comptes administrables » : les comptes ont été lus et l’écran porte les
 *   actions d’administration. Le libellé change parce que l’écran, lui, a
 *   changé : annoncer « lecture seule » sur un écran qui écrit serait faux.
 */
export function accessVerdict(
  access: ConsoleAccess | undefined,
  failed: boolean,
  canWrite = false,
): { tone: StatusTone; label: string } {
  if (failed) return { tone: "down", label: "Indisponible" };
  if (!access) return { tone: "unknown", label: "En attente" };
  if (access.unavailable.length > 0) return { tone: "warn", label: "Partiel" };
  return canWrite ? { tone: "ok", label: "Comptes administrables" } : { tone: "ok", label: "Lecture seule" };
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

/**
 * Gestionnaires d’écriture de l’écran.
 *
 * OPTIONNELS, ET C’EST DÉLIBÉRÉ : sans eux, l’écran n’offre AUCUNE commande —
 * il reste exactement la revue en lecture seule décrite à l’étape A, et un test
 * épingle ce fait (aucun `<button>`, aucun `<input>` dans le rendu de lecture).
 * La page `/console/acces`, elle, fournit toujours les huit gestionnaires et les
 * boîtes de dialogue correspondantes.
 *
 * Les décisions, elles, ne sont PAS ici : chaque gestionnaire déclenche une
 * procédure serveur, qui applique ses propres garde-fous. L’écran qui
 * s’autoriserait lui-même serait un écran qui ment.
 */
export type SystemAccessActions = {
  onCreate: () => void;
  onRename: (account: ConsoleAccessAccount) => void;
  onChangeRole: (account: ConsoleAccessAccount) => void;
  onResetPassword: (account: ConsoleAccessAccount) => void;
  onRemove: (account: ConsoleAccessAccount) => void;
  onInvite: () => void;
  onResendInvitation: (invitation: AccessActionInvitation) => void;
  onRevokeInvitation: (invitation: AccessActionInvitation) => void;
  /**
   * Écriture en vol, sous forme de clé (`compte#2`, `invitation#7`, `creation`,
   * `invitation.creation`), ou `null`. Sert à désactiver LA ligne concernée
   * plutôt que tout l’écran : bloquer les autres lignes ferait croire à une
   * panne générale.
   */
  busyKey: string | null;
};

type SystemAccessPanelProps = {
  access: ConsoleAccess | undefined;
  failed: boolean;
  isLoading: boolean;
  /** Gestionnaires d’écriture. Sans eux : lecture seule, aucune commande. */
  actions?: SystemAccessActions;
  /** Dernier retour d’écriture (succès, refus du serveur, échec). */
  notice?: AccessNotice | null;
  /**
   * Invitations en attente, détaillées : c’est ce qui rend le renvoi et la
   * révocation possibles. `undefined` = liste non demandée (lecture seule ou
   * procédure indisponible), `null` = lecture en échec.
   */
  invitations?: AccessActionInvitation[] | null;
  /** Vrai quand `system.invitations.list` a échoué. */
  invitationsFailed?: boolean;
  isLoadingInvitations?: boolean;
};

/** Clé d’occupation d’une ligne de compte. Même forme que côté serveur. */
export function accountBusyKey(userId: number): string {
  return `compte#${userId}`;
}

/** Clé d’occupation d’une ligne d’invitation. */
export function invitationBusyKey(invitationId: number): string {
  return `invitation#${invitationId}`;
}

/** Écran « Accès & comptes » : comptes, invitations, moyens d’accès, politique. */
export function SystemAccessPanel({
  access,
  failed,
  isLoading,
  actions,
  notice = null,
  invitations,
  invitationsFailed = false,
  isLoadingInvitations = false,
}: SystemAccessPanelProps) {
  const canWrite = Boolean(actions);
  const verdict = accessVerdict(access, failed, canWrite);
  const pending = "…";
  const accounts = access?.accounts ?? [];
  const roleCounts = access?.roleCounts ?? [];
  const portalCount = accounts.filter(isPortalAccount).length;
  const staffCount = accounts.length - portalCount;
  const accountsUnavailable = access?.unavailable.includes("accounts") ?? false;
  const busy = actions?.busyKey ?? null;

  return (
    <div className="space-y-6" data-testid="system-access">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">Accès &amp; comptes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Relevé du {access ? formatConsoleTimestamp(access.generatedAt) : "—"} · comptes staff et portail client
            {canWrite ? ", administration des accès" : ", lecture seule"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <ConsoleStatusBadge tone={verdict.tone} label={verdict.label} />
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap gap-2" data-testid="access-header-actions">
          <Button
            type="button"
            onClick={actions.onCreate}
            disabled={busy !== null}
            className="h-10 rounded-xl bg-primary font-bold text-primary-foreground"
            data-testid="access-create-account"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Créer un compte
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={actions.onInvite}
            disabled={busy !== null}
            className="h-10 rounded-xl border-border font-bold"
            data-testid="access-invite"
          >
            <Mail className="mr-2 h-4 w-4" />
            Inviter
          </Button>
        </div>
      )}

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

      {notice && <AccessNoticeBanner notice={notice} />}

      {canWrite ? (
        <AccessAdministrationBanner />
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-extrabold">Consultation seule — sauf la révocation de session</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Cet écran ne crée, ne modifie et ne supprime aucun compte : côté serveur, il n’existe ici que des lectures.
              La gestion des comptes reste dans « Comptes collaborateurs ». Les sessions, elles, sont désormais listables
              et révocables — depuis l’écran « Sessions actives », où la révocation est journalisée et où la session qui
              vous authentifie est protégée contre une révocation accidentelle.
            </p>
          </div>
        </div>
      )}

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
          {/*
            La phrase change selon ce que l’écran montre VRAIMENT. En lecture
            seule, seuls des nombres sont remontés — et le dire est une garantie.
            Dès que le détail est affiché (pour permettre le renvoi et la
            révocation), les adresses sont bel et bien là : garder la phrase
            précédente serait un mensonge confortable.
          */}
          {invitations === undefined ? (
            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
              Seuls des nombres par rôle sont remontés : ni jeton d’invitation, ni adresse e-mail.
            </p>
          ) : (
            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
              Les adresses des invitations en attente sont détaillées plus bas, pour permettre le renvoi et la
              révocation. Ni le lien, ni le jeton, ni son empreinte ne sont remontés.
            </p>
          )}
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
                  <th scope="col" className="py-2 pr-3">Second facteur</th>
                  <th scope="col" className="py-2 pr-3">Dernière connexion</th>
                  <th scope="col" className="py-2">Créé le</th>
                  {actions && <th scope="col" className="py-2 pl-3">Actions</th>}
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
                        label={roleCounts.find(entry => entry.role === account.role)?.label ?? roleLabel(account.role)}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      {/*
                        Un BOOLÉEN, et rien d’autre : ni le secret TOTP, ni les
                        empreintes des codes de secours ne quittent le serveur.
                        Un enrôlement inachevé affiche « non » — c’est exact, la
                        MFA n’est pas active tant qu’un premier code ne l’a pas
                        confirmée.
                      */}
                      <span
                        data-testid={`access-mfa-${account.id}`}
                        className={
                          account.mfaEnabled
                            ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                            : "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground"
                        }
                      >
                        {account.mfaEnabled ? "MFA active" : "MFA inactive"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{formatAccessDate(account.lastSignedIn)}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{formatAccessDate(account.createdAt)}</td>
                    {actions && (
                      <td className="py-2.5 pl-3">
                        {/*
                          Les commandes de la ligne. Elles ne décident rien : le
                          serveur refusera ce qui doit l’être (dernier compte
                          système, soi-même). La seule chose que l’écran décide,
                          c’est ce qu’il faut confirmer — et il demande plus
                          pour une suppression que pour un renommage.
                        */}
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-border text-xs font-bold"
                            disabled={busy !== null}
                            onClick={() => actions.onRename(account)}
                            data-testid={`rename-account-${account.id}`}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Renommer
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-border text-xs font-bold"
                            disabled={busy !== null}
                            onClick={() => actions.onChangeRole(account)}
                            data-testid={`change-role-${account.id}`}
                          >
                            <UserCog className="mr-1.5 h-3.5 w-3.5" />
                            Rôle
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-border text-xs font-bold"
                            disabled={busy !== null}
                            onClick={() => actions.onResetPassword(account)}
                            data-testid={`reset-password-${account.id}`}
                          >
                            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                            Mot de passe
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-rose-200 text-xs font-bold text-rose-800 dark:border-rose-800 dark:text-rose-200"
                            disabled={busy !== null}
                            onClick={() => actions.onRemove(account)}
                            data-testid={`remove-account-${account.id}`}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
          Aucun mot de passe, aucune empreinte de mot de passe, aucun jeton et aucun secret TOTP ne sont lus par cette
          console : la colonne « second facteur » n’est qu’un booléen. La date de « dernière connexion » est initialisée
          à la création du compte : elle ne prouve pas une connexion réelle.
        </p>
      </section>

      {/*
        DÉTAIL DES INVITATIONS EN ATTENTE — affiché uniquement quand la page le
        fournit (procédure `system.invitations.list`). Le pavé « Invitations en
        attente » ci-dessus ne donne que des nombres ; celui-ci nomme les
        adresses, parce qu’il faut savoir QUI relancer pour le relancer.
      */}
      {invitations !== undefined && (
        <section className="lucepress-panel rounded-[1.35rem] p-5" data-testid="access-invitations">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="lucepress-kicker">Invitations en attente</h2>
            <p className="text-[11px] text-muted-foreground">
              {invitationsFailed ? "liste indisponible" : `${invitations?.length ?? 0} invitation(s)`}
            </p>
          </div>

          {invitationsFailed && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
              La liste des invitations n’a pas pu être lue. Aucune ligne n’est affichée plutôt que des invitations
              inventées, et ni renvoi ni révocation ne sont possibles depuis cet écran.
            </p>
          )}

          {!invitationsFailed && (invitations?.length ?? 0) === 0 && (
            <p className="mt-3 text-xs text-muted-foreground" data-testid="access-invitations-empty">
              {isLoadingInvitations
                ? "Lecture en cours…"
                : "Aucune invitation en attente : personne n’a de lien d’accès ouvert en ce moment."}
            </p>
          )}

          {!invitationsFailed && (invitations?.length ?? 0) > 0 && (
            <ul className="mt-4 divide-y divide-border/60">
              {invitations!.map(invitation => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  data-testid={`access-invitation-${invitation.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{invitation.email}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Rôle visé : {invitation.roleLabel} · émise le {formatAccessDate(invitation.createdAt)} · expire le{" "}
                      {formatAccessDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {invitation.expired && <ExpiredInvitationMark />}
                    {actions ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg border-border text-xs font-bold"
                          disabled={busy !== null}
                          onClick={() => actions.onResendInvitation(invitation)}
                          data-testid={`resend-invitation-${invitation.id}`}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Renvoyer
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg border-rose-200 text-xs font-bold text-rose-800 dark:border-rose-800 dark:text-rose-200"
                          disabled={busy !== null}
                          onClick={() => actions.onRevokeInvitation(invitation)}
                          data-testid={`revoke-invitation-${invitation.id}`}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Révoquer
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <JournalisedMention />
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Seules des invitations EN ATTENTE figurent ici. Ni le lien, ni le jeton, ni même son empreinte ne sont
              transmis à cet écran : « Renvoyer » en régénère un nouveau et invalide l’ancien.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
