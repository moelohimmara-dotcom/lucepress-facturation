import { sql, type SQL } from "drizzle-orm";
import { APP_ROLE_LABELS } from "@shared/roles";
import { peekTenant } from "./_core/tenantContext";
import { getDb } from "./db";

/**
 * Écran « Sessions actives » de la console d’exploitation (Phase 3 « Protéger »,
 * module 4 — étape B1).
 *
 * Ce module est le pendant LECTURE + RÉVOCATION de `server/sessionRegistry.ts`,
 * qui tient le registre au fil des requêtes. Il n’écrit jamais de schéma : la
 * table `sessions` a été créée par le propriétaire de la base, la console ne fait
 * que la lire et y poser un `revokedAt`.
 *
 * CE QUI NE SORT JAMAIS D’ICI
 * ---------------------------
 * Ni le jeton, ni son empreinte. `tokenHash` n’est même pas projeté : la colonne
 * « session courante » est calculée PAR LA BASE (`"tokenHash" = $actuel`), si
 * bien que l’empreinte ne quitte pas PostgreSQL pour se retrouver dans une charge
 * utile tRPC, un journal ou un cache navigateur. Un test le vérifie en balayant
 * la réponse sérialisée.
 *
 * RÈGLES DE RESTITUTION (identiques à `systemAccess.ts` / `systemMetrics.ts`)
 * -------------------------------------------------------------------------
 * - jamais de valeur inventée : une lecture impossible est marquée
 *   `unavailable` et la liste reste vide, plutôt qu’un « 0 session » trompeur ;
 * - jamais de message d’erreur brut : un échec peut contenir des détails de
 *   connexion, on ne les remonte pas ;
 * - l’objet retourné est sérialisable tel quel (nombres, chaînes, booléens).
 */

/** Nombre maximal de sessions affichées ; au-delà, `omitted` en rend compte. */
export const SESSION_LIST_LIMIT = 200;

/**
 * État d’une session — les trois états se recouvrent partiellement en base, on
 * les rend MUTUELLEMENT EXCLUSIFS avec une priorité assumée : une session
 * révoquée le reste, même après son échéance. Un administrateur qui a fermé un
 * accès doit continuer de voir que l’accès a été fermé ; le fait qu’il soit
 * devenu caduc par le temps est secondaire.
 */
export type SystemSessionState = "active" | "revoked" | "expired";

export type SystemSession = {
  id: number;
  userId: number;
  accountName: string | null;
  accountEmail: string | null;
  /** Libellé lisible du rôle du compte (jamais l’identifiant brut seul). */
  accountRoleLabel: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  /** En-tête `User-Agent` reçu à la connexion, tronqué. Fourni par le client : indicatif. */
  userAgent: string | null;
  /**
   * Résumé lisible du même en-tête (« Chrome · Windows »), calculé CÔTÉ SERVEUR
   * pour que la règle de lecture n’existe qu’à un seul endroit.
   */
  clientLabel: string;
  ip: string | null;
  state: SystemSessionState;
  /**
   * Session qui exécute la demande courante. Sa révocation est REFUSÉE par
   * `system.sessions.revoke` : le garde-fou s’appuie sur ce que la base a
   * constaté, pas sur une donnée envoyée par le navigateur.
   */
  current: boolean;
};

export type SystemSessionsTotals = {
  total: number;
  active: number;
  revoked: number;
  expired: number;
};

export type SystemSessions = {
  /** Horodatage serveur du relevé (ISO 8601). */
  generatedAt: string;
  /** Périmètre de lecture : le tenant courant, jamais la table entière. */
  scope: "tenant";
  sessions: SystemSession[];
  totals: SystemSessionsTotals;
  /** Lignes existantes non affichées parce que la liste est bornée. */
  omitted: number;
  limit: number;
  /**
   * Vrai quand la table n’a pas pu être lue. DISTINCT d’un total nul : la
   * console affiche « indisponible », jamais « aucune session ».
   */
  unavailable: boolean;
};

/**
 * Verdict d’une révocation. Union discriminée plutôt qu’un booléen : l’appelant
 * doit pouvoir dire « introuvable », « déjà révoquée » et « c’est votre propre
 * session » — trois situations distinctes qui appellent trois réponses
 * différentes.
 */
export type RevokeSessionResult =
  | { outcome: "revoked"; id: number; userId: number; revokedAt: string }
  | { outcome: "already_revoked"; id: number; userId: number }
  | { outcome: "not_found" }
  | { outcome: "self"; id: number }
  | { outcome: "unavailable"; reason: string };

/** Exécuteur de requêtes brutes — injectable pour tester la robustesse. */
export type RawQueryRunner = (query: SQL) => Promise<Record<string, unknown>[]>;

export type SystemSessionsDeps = {
  /** Remplace l’accès à la base. Les tests peuvent le faire échouer. */
  runQuery?: RawQueryRunner;
  /** Horloge injectable. */
  now?: () => Date;
  /** Tenant lu. `undefined` = aucun périmètre lisible : on ne lit rien. */
  tenantId?: number;
  /** Empreinte de la session qui demande — voir `SystemSession.current`. */
  currentTokenHash?: string | null;
  /** Borne d’affichage. */
  limit?: number;
};

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asIsoString(value: unknown): string | null {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Libellé d’un rôle ; une valeur inconnue est affichée telle quelle, jamais masquée. */
function roleLabel(role: string): string {
  return (APP_ROLE_LABELS as Record<string, string | undefined>)[role] ?? role;
}

/**
 * État d’une ligne, calculé à partir des deux seules dates qui le déterminent.
 * Exporté : c’est la règle que la console annonce, elle doit être testable seule.
 */
export function resolveSessionState(
  row: { revokedAt?: unknown; expiresAt?: unknown },
  now: Date
): SystemSessionState {
  if (row.revokedAt !== null && row.revokedAt !== undefined) return "revoked";
  const expiresAt = asDate(row.expiresAt);
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

async function resolveRunQuery(deps: SystemSessionsDeps): Promise<RawQueryRunner | null> {
  if (deps.runQuery) return deps.runQuery;
  const db = await getDb();
  if (!db) return null;
  return async query => Array.from((await db.execute(query)) as unknown as Record<string, unknown>[]);
}

/**
 * Sessions du tenant courant, les plus récemment vues d’abord.
 *
 * La jointure sur `users` apporte le nom et l’e-mail du compte : c’est ce qui
 * rend la ligne exploitable (« qui est connecté ? »), sans exposer autre chose du
 * compte que son identité et son rôle. `tokenHash` est comparé, jamais projeté.
 */
async function loadSessions(
  runQuery: RawQueryRunner,
  tenantId: number,
  currentTokenHash: string,
  limit: number
): Promise<SystemSession[]> {
  const rows = await runQuery(sql`
    select s.id,
           s."userId",
           s."createdAt",
           s."lastSeenAt",
           s."expiresAt",
           s."userAgent",
           s.ip,
           s."revokedAt",
           (s."tokenHash" = ${currentTokenHash}) as "isCurrent",
           u.name  as "accountName",
           u.email as "accountEmail",
           u.role  as "accountRole"
      from sessions s
      join users u on u.id = s."userId"
     where s."tenantId" = ${tenantId}
     order by s."lastSeenAt" desc, s.id desc
     limit ${limit}
  `);
  const now = new Date();
  return rows.map(row => {
    const role = typeof row.accountRole === "string" ? row.accountRole : String(row.accountRole ?? "");
    return {
      id: asNumber(row.id) ?? 0,
      userId: asNumber(row.userId) ?? 0,
      accountName: asText(row.accountName),
      accountEmail: asText(row.accountEmail),
      accountRoleLabel: roleLabel(role),
      createdAt: asIsoString(row.createdAt),
      lastSeenAt: asIsoString(row.lastSeenAt),
      expiresAt: asIsoString(row.expiresAt),
      userAgent: asText(row.userAgent),
      clientLabel: describeSessionClient(asText(row.userAgent)),
      ip: asText(row.ip),
      state: resolveSessionState(row, now),
      current: row.isCurrent === true || row.isCurrent === "t" || row.isCurrent === 1,
    };
  });
}

/**
 * Décompte exact par état. Requête séparée de la liste pour que les totaux
 * restent justes même quand l’affichage est borné — un total faux serait pire
 * qu’un total absent.
 */
async function loadTotals(
  runQuery: RawQueryRunner,
  tenantId: number,
  now: Date
): Promise<SystemSessionsTotals> {
  const rows = await runQuery(sql`
    select count(*) as "total",
           count(*) filter (where s."revokedAt" is null and s."expiresAt" > ${now.toISOString()}) as "active",
           count(*) filter (where s."revokedAt" is not null) as "revoked",
           count(*) filter (where s."revokedAt" is null and s."expiresAt" <= ${now.toISOString()}) as "expired"
      from sessions s
     where s."tenantId" = ${tenantId}
  `);
  const row = rows[0];
  return {
    total: asNumber(row?.total) ?? 0,
    active: asNumber(row?.active) ?? 0,
    revoked: asNumber(row?.revoked) ?? 0,
    expired: asNumber(row?.expired) ?? 0,
  };
}

const EMPTY_TOTALS: SystemSessionsTotals = { total: 0, active: 0, revoked: 0, expired: 0 };

/**
 * Relève les sessions de l’instance. Ne lève jamais : une table absente ou une
 * base injoignable produit un relevé explicitement marqué `unavailable`, jamais
 * une liste vide présentée comme un constat.
 */
export async function collectSystemSessions(deps: SystemSessionsDeps = {}): Promise<SystemSessions> {
  const now = deps.now ?? (() => new Date());
  const tenantId = deps.tenantId ?? peekTenant();
  const limit = deps.limit ?? SESSION_LIST_LIMIT;

  const base = {
    generatedAt: now().toISOString(),
    scope: "tenant" as const,
    sessions: [] as SystemSession[],
    totals: EMPTY_TOTALS,
    omitted: 0,
    limit,
  };

  // Sans tenant, on ne lit rien plutôt que de lire trop large (l’écran est
  // réservé au rôle système, mais la règle de cloisonnement reste la même).
  if (tenantId === undefined) return { ...base, unavailable: true };

  try {
    const runQuery = await resolveRunQuery(deps);
    if (!runQuery) return { ...base, unavailable: true };

    const currentTokenHash = deps.currentTokenHash ?? "";
    const [sessions, totals] = await Promise.all([
      loadSessions(runQuery, tenantId, currentTokenHash, limit),
      loadTotals(runQuery, tenantId, now()),
    ]);

    return {
      ...base,
      sessions,
      totals,
      omitted: Math.max(0, totals.total - sessions.length),
      unavailable: false,
    };
  } catch {
    // Aucun message d’erreur n’est remonté : il peut contenir des détails de
    // connexion. La console dit « indisponible » et n’invente aucun compte.
    return { ...base, unavailable: true };
  }
}

export type RevokeSessionInput = {
  /** Identifiant de la session visée. */
  id: number;
  tenantId: number | undefined;
  /**
   * Empreinte de la session qui exécute la révocation, ou `null` si elle est
   * inconnue. En production elle est TOUJOURS connue : `systemProcedure` exige
   * un utilisateur, donc un cookie de session, donc un jeton.
   */
  actingTokenHash?: string | null;
  runQuery?: RawQueryRunner;
  now?: () => Date;
};

/**
 * Révoque UNE session du tenant courant.
 *
 * GARDE-FOU — ON NE SE COUPE PAS SOI-MÊME L’ACCÈS
 * ----------------------------------------------
 * Révoquer la session qui porte la requête rendrait l’administrateur incapable
 * d’annuler son geste (l’écran « Sessions actives » cesserait de répondre) : une
 * erreur de clic deviendrait une perte d’accès définitive jusqu’à la prochaine
 * connexion. On refuse donc, avec un message qui dit quoi faire pour se
 * déconnecter réellement (« Déconnexion »). La comparaison porte sur
 * l’EMPREINTE du jeton présenté : rien à falsifier côté navigateur.
 *
 * La révocation est idempotente : révoquer une session déjà révoquée n’est pas
 * une erreur, c’est un constat.
 */
export async function revokeSessionById(input: RevokeSessionInput): Promise<RevokeSessionResult> {
  if (input.tenantId === undefined) return { outcome: "unavailable", reason: "aucun tenant associé" };

  try {
    const runQuery = await resolveRunQuery({ runQuery: input.runQuery });
    if (!runQuery) return { outcome: "unavailable", reason: "base de données indisponible" };

    const rows = await runQuery(sql`
      select id, "userId", "revokedAt", "tokenHash"
        from sessions
       where id = ${input.id} and "tenantId" = ${input.tenantId}
       limit 1
    `);
    const row = rows[0];
    if (!row) return { outcome: "not_found" };

    const userId = asNumber(row.userId) ?? 0;
    const tokenHash = typeof row.tokenHash === "string" ? row.tokenHash : null;

    if (tokenHash && input.actingTokenHash && tokenHash === input.actingTokenHash) {
      return { outcome: "self", id: input.id };
    }
    if (row.revokedAt !== null && row.revokedAt !== undefined) {
      return { outcome: "already_revoked", id: input.id, userId };
    }

    const updated = await runQuery(sql`
      update sessions
         set "revokedAt" = now()
       where id = ${input.id}
         and "tenantId" = ${input.tenantId}
         and "revokedAt" is null
      returning "revokedAt"
    `);
    const revokedAt = asIsoString(updated[0]?.revokedAt);
    // Course avec une autre révocation : la ligne a été fermée entre la lecture
    // et l’écriture. Le résultat est le même pour l’administrateur.
    if (!revokedAt) return { outcome: "already_revoked", id: input.id, userId };

    return { outcome: "revoked", id: input.id, userId, revokedAt };
  } catch (error) {
    return {
      outcome: "unavailable",
      reason: error instanceof Error ? error.message.slice(0, 200) : "erreur inconnue",
    };
  }
}

/**
 * Résumé lisible d’un en-tête `User-Agent`, pour que le tableau reste lisible.
 *
 * VALEUR DÉRIVÉE, JAMAIS UNE PREUVE : l’en-tête est fourni par le client et peut
 * être vide, tronqué ou mensonger. La console l’annonce comme indicatif, affiche
 * la valeur brute en infobulle, et ne s’en sert pour aucune décision.
 */
export function describeSessionClient(userAgent: string | null | undefined): string {
  if (!userAgent || userAgent.trim().length === 0) return "Agent non communiqué";
  const ua = userAgent;

  const browser =
    /\bEdg\//.test(ua) ? "Edge"
    : /\bOPR\/|\bOpera\b/.test(ua) ? "Opera"
    : /\bFirefox\//.test(ua) ? "Firefox"
    : /\bChrome\//.test(ua) ? "Chrome"
    : /\bSafari\//.test(ua) ? "Safari"
    : /curl\//i.test(ua) ? "curl"
    : /node|undici/i.test(ua) ? "Client applicatif"
    : null;

  const system =
    /Windows NT/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /\biPhone|\biPad|\biOS\b/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : null;

  if (browser && system) return `${browser} · ${system}`;
  if (browser) return browser;
  if (system) return system;
  // Inconnu : on n’invente rien, on montre le début de ce qui a été reçu.
  return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua;
}
