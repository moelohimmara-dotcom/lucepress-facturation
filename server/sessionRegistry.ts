import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { SESSION_TTL_MS } from "./_core/localAuth";
import { getDb } from "./db";

/**
 * Registre des sessions adossées à la base (Phase 3 « Protéger », étape B1).
 *
 * POURQUOI CE MODULE
 * ------------------
 * Le jeton de session est un JWT autoporteur : il prouve son authenticité mais
 * ne dit rien de sa validité courante. Impossible, donc, de fermer la session
 * d’un agent qui quitte l’entreprise ou dont le poste a été compromis avant
 * l’échéance (un an). La table `sessions` donne à chaque connexion une ligne
 * que la console peut lister et révoquer.
 *
 * DEUX IMPÉRATIFS OPPOSÉS, TOUS DEUX TENUS ICI
 * --------------------------------------------
 * 1. DISPONIBILITÉ — la connexion ne doit JAMAIS échouer à cause de ce module.
 *    La table vient d’être posée sur une application en production : si elle est
 *    absente, si la base est momentanément injoignable ou si le rôle applicatif
 *    n’a pas les droits, `auth.login` doit continuer de délivrer sa session.
 *    C’est pourquoi TOUTES les fonctions d’écriture de ce module avalé leur
 *    erreur (`recordSession`, `revokeSessionByToken`) : elles rendent compte de
 *    leur échec, elles ne le propagent pas.
 * 2. SÉCURITÉ — une révocation doit RÉELLEMENT invalider la session. Ce contrôle
 *    ne peut donc pas être « au mieux » : `readSessionState` renvoie un verdict
 *    explicite, et `_core/context.ts` refuse la requête quand il est négatif.
 *
 * COMPROMIS DE DISPONIBILITÉ DU CONTRÔLE (`readSessionState`)
 * ----------------------------------------------------------
 * Un contrôle qui refuse en cas de doute transformerait une panne de base en
 * panne d’authentification : tout le monde serait déconnecté. On choisit donc
 * l’ouverture (« fail-open ») : en cas d’erreur de lecture, la session est
 * considérée comme NON révoquée, et l’échec est journalisé pour être vu. Les
 * autres barrières restent en place (signature JWT, existence du compte, rôle
 * relu en base à chaque requête) — le repli ne rouvre jamais un accès anonyme.
 *
 * EMPREINTE
 * ---------
 * La table ne stocke QUE l’empreinte SHA-256 du jeton, jamais le jeton : une
 * fuite de la table ne permet pas de rejouer une session. SHA-256 (et non
 * scrypt comme pour les invitations) parce que ce calcul tourne à CHAQUE requête
 * authentifiée : le jeton est un JWT de 256 bits signé, il n’est ni devinable ni
 * énumérable, une fonction de dérivation lente n’apporterait rien et coûterait
 * cher. Même choix que `shared/documentShare.ts` (`hashDocumentShareToken`).
 */

/** Empreinte du jeton de session — la seule forme qui touche la base. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

/** Longueurs des colonnes `sessions.ip` et `sessions.userAgent`, vues du code. */
const IP_MAX_LENGTH = 64;
const USER_AGENT_MAX_LENGTH = 512;

/**
 * Intervalle minimal entre deux rafraîchissements de `lastSeenAt` pour une même
 * session. Voir `touchSessionSeen` : sans ce garde-fou, chaque requête
 * authentifiée écrirait en base.
 */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Exécuteur de requêtes brutes — injectable pour tester la robustesse. */
export type RawQueryRunner = (query: SQL) => Promise<Record<string, unknown>[]>;

export type SessionRegistryDeps = {
  /** Remplace l’accès à la base. Les tests peuvent le faire échouer. */
  runQuery?: RawQueryRunner;
  /** Horloge injectable. */
  now?: () => Date;
};

export type RecordSessionInput = {
  userId: number;
  /** `null` si le compte n’est rattaché à aucun tenant (ligne héritée). */
  tenantId: number | null;
  /** Jeton EN CLAIR : il n’est utilisé que pour calculer l’empreinte, puis oublié. */
  token: string;
  userAgent?: string | null;
  ip?: string | null;
  /** Échéance réelle du jeton. Par défaut : maintenant + `SESSION_TTL_MS`. */
  expiresAt?: Date;
};

/** Compte rendu d’une écriture « au mieux » : l’échec est décrit, jamais levé. */
export type SessionWriteOutcome = {
  ok: boolean;
  /** Motif technique, à destination des journaux serveur. Jamais montré à l’utilisateur. */
  reason?: string;
};

export type SessionState = {
  /** Une ligne existe pour cette empreinte. `false` = session antérieure au registre. */
  known: boolean;
  /** Révocation constatée : la requête doit être refusée. */
  revoked: boolean;
  expiresAt: Date | null;
};

/*
 * Journalisation « une fois par motif ».
 *
 * Le contrôle de révocation tourne à chaque requête. Si la table manquait, la
 * même erreur serait écrite des milliers de fois par heure et noierait les
 * journaux. On retient donc les motifs déjà vus : le premier est écrit, les
 * répétitions sont tues. La borne évite une fuite mémoire si les motifs varient.
 */
const LOGGED_REASONS = new Set<string>();
const LOGGED_REASONS_MAX = 50;

function warnOnce(prefix: string, reason: string): void {
  const key = `${prefix}:${reason}`;
  if (LOGGED_REASONS.has(key)) return;
  if (LOGGED_REASONS.size >= LOGGED_REASONS_MAX) LOGGED_REASONS.clear();
  LOGGED_REASONS.add(key);
  console.warn(`[sessions] ${reason}`);
}

/** Message d’erreur utilisable en journal, jamais une pile complète. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 200 ? `${message.slice(0, 200)}…` : message;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * Ouvre le client à la demande. Renvoie `null` quand la base n’est pas
 * configurée ou pas joignable : l’appelant traite alors l’absence comme un
 * échec « au mieux », jamais comme une exception.
 */
async function resolveRunQuery(deps: SessionRegistryDeps): Promise<RawQueryRunner | null> {
  if (deps.runQuery) return deps.runQuery;
  try {
    const db = await getDb();
    if (!db) return null;
    return async query => Array.from((await db.execute(query)) as unknown as Record<string, unknown>[]);
  } catch {
    return null;
  }
}

/** Ligne `sessions` créée à la connexion, ou échec silencieux décrit. */
export async function recordSession(
  input: RecordSessionInput,
  deps: SessionRegistryDeps = {}
): Promise<SessionWriteOutcome> {
  const now = deps.now ?? (() => new Date());
  try {
    const runQuery = await resolveRunQuery(deps);
    if (!runQuery) return { ok: false, reason: "base de données indisponible" };

    const expiresAt = input.expiresAt ?? new Date(now().getTime() + SESSION_TTL_MS);
    const userAgent = asText(input.userAgent, USER_AGENT_MAX_LENGTH);
    const ip = asText(input.ip, IP_MAX_LENGTH);

    await runQuery(sql`
      insert into sessions ("tenantId", "userId", "tokenHash", "expiresAt", "userAgent", "ip")
      values (
        ${input.tenantId},
        ${input.userId},
        ${hashSessionToken(input.token)},
        ${new Date(expiresAt).toISOString()},
        ${userAgent},
        ${ip}
      )
      on conflict ("tokenHash") do nothing
    `);
    return { ok: true };
  } catch (error) {
    const reason = reasonOf(error);
    warnOnce("record", `enregistrement impossible (${reason}) — la connexion n’est pas bloquée`);
    return { ok: false, reason };
  }
}

/**
 * Marque la session correspondant au jeton comme révoquée (déconnexion).
 * Silencieux en cas d’échec : se déconnecter doit toujours réussir côté client,
 * même si la base ne répond pas — le cookie est effacé de toute façon.
 */
export async function revokeSessionByToken(
  token: string,
  deps: SessionRegistryDeps = {}
): Promise<SessionWriteOutcome> {
  try {
    const runQuery = await resolveRunQuery(deps);
    if (!runQuery) return { ok: false, reason: "base de données indisponible" };

    await runQuery(sql`
      update sessions
         set "revokedAt" = now()
       where "tokenHash" = ${hashSessionToken(token)}
         and "revokedAt" is null
    `);
    return { ok: true };
  } catch (error) {
    const reason = reasonOf(error);
    warnOnce("revoke", `révocation à la déconnexion impossible (${reason})`);
    return { ok: false, reason };
  }
}

/**
 * État de la session présentée — appelé à CHAQUE requête authentifiée.
 *
 * UNE seule lecture : `select "revokedAt", "expiresAt" from sessions where
 * "tokenHash" = $1`, servie par l’index UNIQUE `sessions_tokenHash_unique`
 * (recherche d’une ligne, pas d’un parcours de table). Aucune écriture ici : le
 * rafraîchissement de `lastSeenAt` vit dans `touchSessionSeen`, pour qu’un échec
 * d’écriture ne puisse jamais influencer le verdict de sécurité.
 *
 * Ne lève jamais : une erreur de lecture rend `{ known: false, revoked: false }`
 * (voir « compromis de disponibilité » en tête de fichier) et journalise le
 * motif une seule fois.
 */
export async function readSessionState(
  token: string,
  deps: SessionRegistryDeps = {}
): Promise<SessionState> {
  const unknown: SessionState = { known: false, revoked: false, expiresAt: null };
  try {
    const runQuery = await resolveRunQuery(deps);
    if (!runQuery) return unknown;

    const rows = await runQuery(sql`
      select "revokedAt", "expiresAt"
        from sessions
       where "tokenHash" = ${hashSessionToken(token)}
       limit 1
    `);
    const row = rows[0];
    if (!row) return unknown;

    return {
      known: true,
      revoked: row.revokedAt !== null && row.revokedAt !== undefined,
      expiresAt: asDate(row.expiresAt),
    };
  } catch (error) {
    warnOnce("state", `contrôle de révocation impossible (${reasonOf(error)}) — session laissée ouverte`);
    return unknown;
  }
}

/*
 * Throttle en mémoire de `lastSeenAt` : empreinte → horodatage du dernier
 * rafraîchissement demandé par CE processus.
 *
 * Pourquoi en mémoire et pas en SQL (`where "lastSeenAt" < now() - interval …`) :
 * un `UPDATE` conditionnel coûte tout de même un aller-retour à chaque requête,
 * même quand il ne modifie rien. Ici, la décision est prise sans toucher la base
 * et 99 % des appels ne font rien du tout. Chaque instance garde sa propre
 * table : au pire, une session est rafraîchie une fois par instance et par
 * intervalle — sans conséquence, `lastSeenAt` n’est qu’un indicateur.
 */
const LAST_TOUCH_MS = new Map<string, number>();
const LAST_TOUCH_MAX_ENTRIES = 2_000;

/**
 * Rafraîchit `lastSeenAt`, au plus une fois par `SESSION_TOUCH_INTERVAL_MS` et
 * par session. Volontairement « au mieux » : l’appelant ne l’attend pas
 * (`void`), un échec ne remonte nulle part et n’a aucune incidence sur la
 * requête en cours. Aucune promesse rejetée ne peut donc s’échapper.
 */
export function touchSessionSeen(token: string, deps: SessionRegistryDeps = {}): void {
  const tokenHash = hashSessionToken(token);
  const nowMs = (deps.now ?? (() => new Date()))().getTime();
  const previous = LAST_TOUCH_MS.get(tokenHash);
  if (previous !== undefined && nowMs - previous < SESSION_TOUCH_INTERVAL_MS) return;

  if (LAST_TOUCH_MS.size >= LAST_TOUCH_MAX_ENTRIES) LAST_TOUCH_MS.clear();
  LAST_TOUCH_MS.set(tokenHash, nowMs);

  void (async () => {
    try {
      const runQuery = await resolveRunQuery(deps);
      if (!runQuery) return;
      await runQuery(sql`
        update sessions
           set "lastSeenAt" = now()
         where "tokenHash" = ${tokenHash}
      `);
    } catch (error) {
      warnOnce("touch", `rafraîchissement de lastSeenAt impossible (${reasonOf(error)})`);
    }
  })();
}

/** Remet à zéro l’état de throttle en mémoire — réservé aux tests. */
export function resetSessionTouchCache(): void {
  LAST_TOUCH_MS.clear();
}
