import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

/**
 * JETON D’EXPORT PRÉALABLE — LE FILET AVANT LA CHUTE.
 *
 * LA RÈGLE, EN UNE PHRASE
 * -----------------------
 * On ne détruit pas de données sans avoir d’abord pu en produire une copie, et
 * cette copie doit porter sur EXACTEMENT le même périmètre.
 *
 * Comment le prouver sans écrire en base ? Ce module n’a pas le droit d’ajouter
 * une colonne ni une table (aucun DDL). Le jeton est donc SIGNÉ et NON STOCKÉ :
 * sa validité se vérifie par recalcul, et il porte en clair le périmètre qu’il
 * couvre. La purge n’accepte un jeton que si son périmètre est, champ pour
 * champ, celui de la sélection qu’on lui demande de supprimer.
 *
 * CE QUE LE JETON GARANTIT, ET CE QU’IL NE GARANTIT PAS
 * -----------------------------------------------------
 * Il garantit qu’une exportation a été demandée par CE compte, sur CE tenant,
 * pour CES identifiants, il y a moins de dix minutes, et qu’elle a bien été
 * produite (le jeton n’est rendu qu’avec le contenu, jamais avant).
 *
 * Il ne garantit pas que l’administrateur a CONSERVÉ le fichier : le serveur
 * n’en sait rien, et prétendre le contraire serait faux. La copie est produite
 * et transmise ; c’est à l’écran de le dire sans mentir.
 *
 * POURQUOI IL EXPIRE VITE
 * -----------------------
 * Dix minutes : le temps de lire le fichier, pas celui de vaquer à autre chose.
 * Un jeton qui traînerait dans un onglet ouvert la veille ne doit pas pouvoir
 * autoriser une suppression le lendemain — l’état de la base, lui, a changé.
 *
 * POURQUOI LA CLÉ EST DÉRIVÉE
 * ---------------------------
 * `JWT_SECRET` sert déjà aux sessions et aux secrets TOTP. On en dérive une clé
 * DISTINCTE par HKDF (séparation de domaine) : un jeton d’export ne peut donc
 * pas être confondu avec un artefact de session, même si les deux partagent le
 * secret de l’instance.
 */

/** Version du format. Un jeton d’une autre version est refusé, jamais interprété. */
const TOKEN_VERSION = "v1";

/** Sel HKDF : non secret, il sert la séparation de domaine. */
const KEY_SALT = "lucepress:facturation:jeton-export";

/** Information HKDF : distingue cette clé de celle de la MFA et de la session. */
const KEY_INFO = "console-donnees-export";

/** Durée de vie : dix minutes. Voir « pourquoi il expire vite » ci-dessus. */
export const EXPORT_TOKEN_TTL_MS = 10 * 60 * 1000;

/** Le périmètre exact qu’un jeton couvre. Tout écart le rend inutilisable. */
export type ExportTokenScope = {
  /** Tenant de l’acteur. `null` : aucun périmètre — le jeton ne vaut rien. */
  tenantId: number | null;
  /** Identifiant du compte qui a demandé l’export. */
  actorId: number;
  /** Clients exportés, TRIÉS et dédoublonnés (comparaison ensembliste). */
  clientIds: number[];
  /** Total annoncé par l’inventaire au moment de l’export. */
  totalRecords: number;
};

export type ExportTokenPayload = ExportTokenScope & { v: string; exp: number };

export type ExportTokenReason = "malformed" | "signature" | "expired" | "scope" | "unavailable";

export type ExportTokenCheck =
  | { ok: true; payload: ExportTokenPayload }
  | { ok: false; reason: ExportTokenReason };

export type ExportTokenDeps = {
  now?: () => Date;
  /** Secret d’instance, injectable pour prouver qu’une AUTRE clé invalide le jeton. */
  secret?: string;
};

/** Erreur de configuration : sans secret, aucun jeton ne peut être émis. */
export class ExportTokenUnavailableError extends Error {
  constructor() {
    super(
      "Le secret d’instance est indisponible : l’export ne peut pas être signé, donc la purge reste fermée.",
    );
    this.name = "ExportTokenUnavailableError";
  }
}

/**
 * Clé de signature dérivée de `JWT_SECRET` par HKDF-SHA256.
 *
 * Lève quand le secret est vide : mieux vaut refuser un export que d’en produire
 * un dont le jeton ne prouverait rien.
 */
export function deriveExportTokenKey(secret: string = ENV.cookieSecret): Buffer {
  if (secret.length === 0) throw new ExportTokenUnavailableError();
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from(KEY_SALT, "utf8"), Buffer.from(KEY_INFO, "utf8"), 32),
  );
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

/**
 * Décode du base64url en vérifiant l’ALLER-RETOUR.
 *
 * `Buffer.from` ne signale pas une chaîne illisible : il rend ce qu’il peut.
 * Sans cette vérification, un jeton tronqué pourrait produire un tampon
 * inattendu plutôt qu’un refus.
 */
function fromBase64Url(value: string): Buffer | null {
  if (value.length === 0) return null;
  try {
    const buffer = Buffer.from(value, "base64url");
    return buffer.toString("base64url") === value ? buffer : null;
  } catch {
    return null;
  }
}

/** Identifiants triés et dédoublonnés : la comparaison est ensembliste, pas ordonnée. */
function canonicalClientIds(clientIds: readonly number[]): number[] {
  return Array.from(new Set(clientIds.filter(id => Number.isInteger(id) && id > 0))).sort((a, b) => a - b);
}

function scopeOf(scope: ExportTokenScope): ExportTokenScope {
  return {
    tenantId: scope.tenantId,
    actorId: scope.actorId,
    clientIds: canonicalClientIds(scope.clientIds),
    totalRecords: scope.totalRecords,
  };
}

function signatureFor(encodedPayload: string, key: Buffer): string {
  return toBase64Url(createHmac("sha256", key).update(`${TOKEN_VERSION}.${encodedPayload}`).digest());
}

/**
 * Émet un jeton pour un périmètre. Le jeton porte le périmètre EN CLAIR (il n’a
 * rien de secret) et une signature qui le rend infalsifiable.
 */
export function issueExportToken(
  scope: ExportTokenScope,
  deps: ExportTokenDeps = {},
): { token: string; expiresAt: string; payload: ExportTokenPayload } {
  const now = deps.now ?? (() => new Date());
  const key = deriveExportTokenKey(deps.secret);
  const payload: ExportTokenPayload = {
    v: TOKEN_VERSION,
    ...scopeOf(scope),
    exp: now().getTime() + EXPORT_TOKEN_TTL_MS,
  };
  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  return {
    token: `${TOKEN_VERSION}.${encodedPayload}.${signatureFor(encodedPayload, key)}`,
    expiresAt: new Date(payload.exp).toISOString(),
    payload,
  };
}

function sameScope(candidate: ExportTokenPayload, expected: ExportTokenScope): boolean {
  if (candidate.tenantId !== expected.tenantId) return false;
  if (candidate.actorId !== expected.actorId) return false;
  if (candidate.totalRecords !== expected.totalRecords) return false;
  const left = canonicalClientIds(candidate.clientIds);
  const right = canonicalClientIds(expected.clientIds);
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

/**
 * Vérifie un jeton CONTRE le périmètre de la sélection à supprimer.
 *
 * Cinq refus, tous distincts, parce qu’ils ne disent pas la même chose à qui
 * enquête : illisible, mal signé, expiré, hors périmètre, ou impossible à
 * vérifier faute de secret. Dans TOUS les cas la purge s’arrête : le défaut de
 * cette fonction est de refuser.
 */
export function verifyExportToken(
  token: unknown,
  expected: ExportTokenScope,
  deps: ExportTokenDeps = {},
): ExportTokenCheck {
  if (typeof token !== "string" || token.length === 0) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [version, encodedPayload, signature] = parts;
  if (version !== TOKEN_VERSION) return { ok: false, reason: "malformed" };

  const raw = fromBase64Url(encodedPayload);
  if (!raw) return { ok: false, reason: "malformed" };

  let key: Buffer;
  try {
    key = deriveExportTokenKey(deps.secret);
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const expectedSignature = Buffer.from(signatureFor(encodedPayload, key), "utf8");
  const providedSignature = Buffer.from(signature, "utf8");
  if (expectedSignature.length !== providedSignature.length) return { ok: false, reason: "signature" };
  if (!timingSafeEqual(expectedSignature, providedSignature)) return { ok: false, reason: "signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "malformed" };
  }
  const payload = parsed as Partial<ExportTokenPayload>;
  if (
    payload.v !== TOKEN_VERSION ||
    typeof payload.actorId !== "number" ||
    typeof payload.totalRecords !== "number" ||
    typeof payload.exp !== "number" ||
    (payload.tenantId !== null && typeof payload.tenantId !== "number") ||
    !Array.isArray(payload.clientIds) ||
    !payload.clientIds.every(id => typeof id === "number")
  ) {
    return { ok: false, reason: "malformed" };
  }

  const now = (deps.now ?? (() => new Date()))().getTime();
  if (!(payload.exp > now)) return { ok: false, reason: "expired" };

  const complete = payload as ExportTokenPayload;
  if (!sameScope(complete, expected)) return { ok: false, reason: "scope" };
  return { ok: true, payload: complete };
}
