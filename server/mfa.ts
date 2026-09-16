import { randomInt } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import {
  MFA_ISSUER,
  MFA_RECOVERY_ALPHABET,
  MFA_RECOVERY_CODE_COUNT,
  MFA_RECOVERY_CODE_LENGTH,
  TOTP_ALGORITHM,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  isRecoveryCode,
  normalizeRecoveryCode,
  normalizeTotpCode,
} from "../shared/mfa";
import { decryptMfaSecret, encryptMfaSecret, isMfaEnvelope } from "./_core/mfaSecret";
import { hashPassword, verifyPassword } from "./_core/password";
import { buildOtpAuthUri, generateTotpSecret, verifyTotp } from "./_core/totp";
import { getDb } from "./db";

/**
 * AUTHENTIFICATION À DEUX FACTEURS (TOTP) — persistance et règles.
 *
 * AUCUN DDL. Les colonnes `users.mfa%` ont été ajoutées par le propriétaire de
 * la base (`docs/sql/phase3-mfa-sessions.sql`, déjà appliqué). Ce module ne les
 * crée pas, ne les modifie pas, et n’exige aucune migration : il les lit et les
 * écrit, en SQL BRUT.
 *
 * POURQUOI DU SQL BRUT, ET NON LE SCHÉMA DRIZZLE
 * ----------------------------------------------
 * C’est le parti pris de toute la Phase 3 : `sessions`,
 * `permission_overrides` et les colonnes MFA n’ont jamais été déclarées dans
 * `drizzle/schema.ts` (voir `server/sessionRegistry.ts`). Les y ajouter
 * changerait la génération de `pnpm db:push`, donc l’outil qui produit du DDL —
 * précisément ce que cette livraison ne doit pas toucher. Le SQL brut garde la
 * frontière nette : le schéma appartient au propriétaire, le code le consomme.
 *
 * DEUX COMPROMIS OPPOSÉS, TRANCHÉS DIFFÉRENDEMMENT
 * -----------------------------------------------
 * 1. VÉRIFIER UN SECOND FACTEUR est une décision de SÉCURITÉ : elle échoue
 *    FERMÉ. Base injoignable, enveloppe illisible, secret absent → refus. On ne
 *    « laisse pas passer » un doute sur un second facteur.
 * 2. SE CONNECTER sans MFA est le CHEMIN NORMAL de la quasi-totalité des
 *    comptes. Il ne doit jamais dépendre de ce module : `auth.login` traite une
 *    lecture impossible comme « pas de MFA » et la connexion reste identique à
 *    ce qu’elle était (voir `server/routers.ts`).
 *
 * LA MFA EST FACULTATIVE, Y COMPRIS POUR LA CONSOLE
 * -------------------------------------------------
 * Elle a été OBLIGATOIRE pour ouvrir la console (Phases 3B2), puis le
 * propriétaire de l’instance a demandé le contraire — « je dois toujours avoir
 * le choix de décider ». `systemProcedure` n’exige donc plus qu’un rôle
 * (`server/_core/trpc.ts`), et un compte `systeme` active ou désactive son
 * second facteur depuis la console, s’il le décide. Rien d’autre n’a changé :
 * l’enrôlement, le défi de connexion, la vérification, l’anti-rejeu, les codes
 * de secours et la désactivation sont intacts, et c’est CE module qui les porte.
 *
 * CE QUI N’EST JAMAIS ÉCRIT EN BASE
 * ---------------------------------
 * Le secret TOTP est CHIFFRÉ (AES-256-GCM, `_core/mfaSecret.ts`) : la colonne ne
 * contient jamais un secret exploitable. Les codes de secours ne sont stockés
 * que sous forme d’EMPREINTES scrypt (`salt:hash`), avec exactement la fonction
 * de hachage des mots de passe (`_core/password.ts`) — aucune dépendance
 * nouvelle, et une fuite de la table ne rend aucun code utilisable.
 *
 * CE QU’IL N’Y A PAS ICI, ET POURQUOI
 * -----------------------------------
 * Aucune fonction ne retire la MFA d’un compte SANS présenter de code valide.
 * Un administrateur système qui voudrait réenrôler un collègue ne le peut donc
 * pas depuis l’interface : ce serait un pouvoir de prise de contrôle de compte,
 * et il n’est pas ouvert. Les cas résiduels — téléphone perdu sans code de
 * secours, ou rotation de `JWT_SECRET` qui rend les enveloppes illisibles — se
 * traitent par une remise à zéro des colonnes, faite par le PROPRIÉTAIRE de la
 * base (voir l’en-tête de `_core/mfaSecret.ts`). C’est un choix assumé : le seul
 * chemin qui retire un second facteur exige une preuve.
 */

/** Exécuteur de requêtes brutes — injectable, comme dans `sessionRegistry.ts`. */
export type RawQueryRunner = (query: SQL) => Promise<Record<string, unknown>[]>;

export type MfaDeps = {
  /** Remplace l’accès à la base. Les tests peuvent le faire échouer. */
  runQuery?: RawQueryRunner;
  /** Horloge injectable (pas TOTP, dates d’enrôlement). */
  now?: () => Date;
};

/* ------------------------------------------------------------------ */
/* États                                                               */
/* ------------------------------------------------------------------ */

/**
 * État MFA d’un compte, tel qu’il peut être ANNONCÉ.
 *
 * `readable: false` signifie « on ne sait pas » — et non « inactive ». Cette
 * distinction est le cœur du fail-closed : la garde de la console exige
 * `readable && enabled`, donc une lecture impossible ferme la porte au lieu de
 * l’ouvrir.
 */
export type MfaState = {
  readable: boolean;
  /** MFA confirmée par un premier code : `mfaEnabled` est vrai. */
  enabled: boolean;
  /** Enrôlement commencé (secret écrit) mais jamais confirmé. */
  pending: boolean;
  enrolledAt: Date | null;
  /** Nombre de codes de secours encore valables. */
  recoveryCodesRemaining: number;
};

const UNREADABLE_STATE: MfaState = {
  readable: false,
  enabled: false,
  pending: false,
  enrolledAt: null,
  recoveryCodesRemaining: 0,
};

/** Motif de refus — vocabulaire fermé, traduit en message par le routeur. */
export type MfaRefusalReason =
  /** Base de données injoignable : on ne sait rien, donc on refuse. */
  | "indisponible"
  /** Aucun enrôlement en cours pour ce compte. */
  | "aucun_enrolement"
  /** La MFA est déjà active sur ce compte. */
  | "deja_active"
  /** La MFA n’est pas active sur ce compte. */
  | "non_active"
  /** Code faux. */
  | "code_incorrect"
  /** Code juste, mais déjà consommé (rejeu, ou code de secours déjà utilisé). */
  | "code_deja_utilise"
  /** L’écriture n’a pas abouti : rien n’a été modifié. */
  | "echec_ecriture";

export type MfaResult<T> = { ok: true; value: T } | { ok: false; reason: MfaRefusalReason };

/* ------------------------------------------------------------------ */
/* Accès à la base                                                     */
/* ------------------------------------------------------------------ */

async function resolveRunQuery(deps: MfaDeps): Promise<RawQueryRunner | null> {
  if (deps.runQuery) return deps.runQuery;
  try {
    const db = await getDb();
    if (!db) return null;
    return async query => Array.from((await db.execute(query)) as unknown as Record<string, unknown>[]);
  } catch {
    return null;
  }
}

type MfaRecord = {
  secretCipher: string | null;
  enabled: boolean;
  enrolledAt: Date | null;
  recoveryCodeHashes: string[];
  /**
   * Texte BRUT de la colonne des codes de secours.
   *
   * Conservé à côté des empreintes parce que la comparaison-échange
   * (`update … where "mfaRecoveryCodes" = <ancien texte>`) doit porter sur la
   * valeur TELLE QU’ELLE EST EN BASE. Comparer une reconstruction
   * (`JSON.stringify` du tableau relu) échouerait au moindre écart de format et
   * rendrait tous les codes de secours inopérants — une panne silencieuse.
   */
  recoveryCodesRaw: string | null;
  lastUsedStep: number | null;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asStep(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Empreintes des codes de secours, relues depuis la colonne texte.
 *
 * Une valeur illisible rend un tableau vide — jamais une exception : un compte
 * dont les codes de secours seraient corrompus doit pouvoir se connecter par
 * TOTP, et ne pas voir la connexion échouer sur une colonne annexe.
 */
function parseRecoveryHashes(value: unknown): string[] {
  if (typeof value !== "string" || value.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.includes(":"));
  } catch {
    return [];
  }
}

/**
 * Ligne MFA d’un compte, ou `null` si elle n’est pas lisible.
 *
 * `null` voulant dire « on ne sait pas » — et non « pas de MFA » —, TOUS les
 * appelants qui en dérivent une décision d’accès traitent `null` comme un refus.
 */
async function readMfaRecord(userId: number, deps: MfaDeps): Promise<MfaRecord | null> {
  const runQuery = await resolveRunQuery(deps);
  if (!runQuery) return null;
  try {
    const rows = await runQuery(sql`
      select "mfaSecretCipher", "mfaEnabled", "mfaEnrolledAt", "mfaRecoveryCodes", "mfaLastUsedStep"
        from users
       where id = ${userId}
       limit 1
    `);
    const row = rows[0];
    if (!row) return null;
    const rawRecoveryCodes = typeof row.mfaRecoveryCodes === "string" && row.mfaRecoveryCodes.length > 0 ? row.mfaRecoveryCodes : null;
    return {
      secretCipher: typeof row.mfaSecretCipher === "string" && row.mfaSecretCipher.length > 0 ? row.mfaSecretCipher : null,
      enabled: row.mfaEnabled === true || row.mfaEnabled === "true" || row.mfaEnabled === 1,
      enrolledAt: asDate(row.mfaEnrolledAt),
      recoveryCodeHashes: parseRecoveryHashes(rawRecoveryCodes),
      recoveryCodesRaw: rawRecoveryCodes,
      lastUsedStep: asStep(row.mfaLastUsedStep),
    };
  } catch (error) {
    logOnce("lecture", error);
    return null;
  }
}

/*
 * Journalisation « une fois par motif » : une colonne absente ou une base
 * injoignable produirait sinon une ligne par requête, ce qui noierait le journal
 * sans rien apprendre de plus. Même mécanisme que `sessionRegistry.warnOnce`.
 * Aucun secret, aucun contenu de colonne n’y figure — seulement le motif.
 */
const LOGGED_REASONS = new Set<string>();
const LOGGED_REASONS_MAX = 50;

function logOnce(operation: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const reason = message.length > 200 ? `${message.slice(0, 200)}…` : message;
  const key = `${operation}:${reason}`;
  if (LOGGED_REASONS.has(key)) return;
  if (LOGGED_REASONS.size >= LOGGED_REASONS_MAX) LOGGED_REASONS.clear();
  LOGGED_REASONS.add(key);
  console.warn(`[mfa] ${operation} impossible (${reason})`);
}

/** Remet à zéro la journalisation « une fois par motif » — réservé aux tests. */
export function resetMfaLogCache(): void {
  LOGGED_REASONS.clear();
}

/**
 * Exécute une écriture et rend compte : une ligne touchée, ou un échec décrit.
 * Les appelants décident — une écriture ratée n’est jamais présentée comme un
 * succès.
 */
async function runWrite(query: SQL, operation: string, deps: MfaDeps): Promise<boolean> {
  const runQuery = await resolveRunQuery(deps);
  if (!runQuery) {
    logOnce(operation, "base de données indisponible");
    return false;
  }
  try {
    const rows = await runQuery(query);
    return rows.length > 0;
  } catch (error) {
    logOnce(operation, error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Lecture d’état                                                      */
/* ------------------------------------------------------------------ */

/** État MFA d’un compte, tel qu’il peut être affiché. Ne lève jamais. */
export async function readMfaState(userId: number, deps: MfaDeps = {}): Promise<MfaState> {
  const record = await readMfaRecord(userId, deps);
  if (!record) return UNREADABLE_STATE;
  return {
    readable: true,
    enabled: record.enabled,
    pending: record.secretCipher !== null && !record.enabled,
    enrolledAt: record.enrolledAt,
    recoveryCodesRemaining: record.recoveryCodeHashes.length,
  };
}

/**
 * La MFA est-elle active, et le sait-on de source sûre ?
 *
 * Échoue FERMÉ : toute lecture impossible rend `false`. C’est le bon côté de
 * l’erreur pour un prédicat de sécurité — on ne suppose jamais qu’un second
 * facteur est actif quand on n’a pas pu le lire.
 *
 * DÉPENDANCE : plus aucun garde serveur ne s’en sert depuis que la console
 * n’exige plus la MFA (`server/_core/trpc.ts`). Elle reste le prédicat public
 * « MFA active ? » du module — prouvé sur le vrai module dans
 * `server/mfa.test.ts` — plutôt que d’être retirée avec la règle qu’elle
 * servait : la MFA elle-même n’a pas été retirée.
 */
export async function isMfaActiveForUser(userId: number, deps: MfaDeps = {}): Promise<boolean> {
  const record = await readMfaRecord(userId, deps);
  return record !== null && record.enabled && record.secretCipher !== null;
}

/* ------------------------------------------------------------------ */
/* Enrôlement                                                          */
/* ------------------------------------------------------------------ */

/** Codes de secours neufs : tirés au hasard, alphabet sans glyphes ambigus. */
export function generateRecoveryCodes(count: number = MFA_RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  while (codes.length < count) {
    let code = "";
    for (let index = 0; index < MFA_RECOVERY_CODE_LENGTH; index += 1) {
      code += MFA_RECOVERY_ALPHABET[randomInt(MFA_RECOVERY_ALPHABET.length)];
    }
    // Le tirage peut, en théorie, produire deux fois le même code ; on le
    // refuse plutôt que de rendre un lot où un code consommerait l’autre.
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

export type MfaEnrollmentStart = {
  /** Secret en base32 — remis UNE SEULE FOIS, jamais relu depuis la base. */
  secret: string;
  /** URI `otpauth://` à confier à l’application d’authentification. */
  otpauthUri: string;
  issuer: string;
  account: string;
  digits: number;
  periodSeconds: number;
  algorithm: string;
};

/**
 * Commence (ou recommence) un enrôlement : tire un secret, le CHIFFRE et
 * l’enregistre, sans activer la MFA.
 *
 * Tant que le premier code n’a pas été confirmé, `mfaEnabled` reste faux : un
 * enrôlement interrompu — secret écrit, application non configurée — ne doit
 * surtout pas rendre la connexion à deux facteurs obligatoire, sans quoi le
 * compte demanderait un code que personne ne peut produire.
 */
export async function startEnrollment(
  userId: number,
  account: string,
  deps: MfaDeps = {},
): Promise<MfaResult<MfaEnrollmentStart>> {
  const record = await readMfaRecord(userId, deps);
  if (!record) return { ok: false, reason: "indisponible" };
  if (record.enabled) return { ok: false, reason: "deja_active" };

  const secret = generateTotpSecret();
  const cipher = encryptMfaSecret(secret);
  const stored = await runWrite(
    sql`
      update users
         set "mfaSecretCipher" = ${cipher},
             "mfaEnabled" = false,
             "mfaEnrolledAt" = null,
             "mfaRecoveryCodes" = null,
             "mfaLastUsedStep" = null
       where id = ${userId}
       returning "id"
    `,
    "écriture du secret",
    deps,
  );
  if (!stored) return { ok: false, reason: "echec_ecriture" };

  return {
    ok: true,
    value: {
      secret,
      otpauthUri: buildOtpAuthUri(secret, { account, issuer: MFA_ISSUER }),
      issuer: MFA_ISSUER,
      account,
      digits: TOTP_DIGITS,
      periodSeconds: TOTP_PERIOD_SECONDS,
      algorithm: TOTP_ALGORITHM,
    },
  };
}

export type MfaEnrollmentConfirmation = {
  /**
   * Les dix codes de secours EN CLAIR. Ils ne sont rendus qu’ici, une fois :
   * la base n’en garde que les empreintes, donc ils sont irrécupérables
   * ensuite. C’est voulu — et c’est ce que l’écran annonce.
   */
  recoveryCodes: string[];
  enrolledAt: Date;
};

/**
 * Confirme l’enrôlement avec un premier code, puis ACTIVE la MFA.
 *
 * Le code est vérifié contre le secret en attente, en clair le temps de la
 * comparaison. Le pas consommé est enregistré dans le même mouvement : si
 * l’utilisateur présente ce code à la connexion suivante, il sera refusé
 * (anti-rejeu) — c’est le comportement voulu.
 */
export async function confirmEnrollment(
  userId: number,
  code: string,
  deps: MfaDeps = {},
): Promise<MfaResult<MfaEnrollmentConfirmation>> {
  const record = await readMfaRecord(userId, deps);
  if (!record) return { ok: false, reason: "indisponible" };
  if (record.enabled) return { ok: false, reason: "deja_active" };
  if (!record.secretCipher) return { ok: false, reason: "aucun_enrolement" };

  let secret: string;
  try {
    secret = decryptMfaSecret(record.secretCipher);
  } catch (error) {
    logOnce("déchiffrement", error);
    return { ok: false, reason: "indisponible" };
  }

  const now = deps.now ?? (() => new Date());
  const verdict = verifyTotp({ secretBase32: secret, code, nowMs: now().getTime() });
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason === "deja_utilise" ? "code_deja_utilise" : "code_incorrect" };
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashes = await Promise.all(recoveryCodes.map(recoveryCode => hashPassword(recoveryCode)));
  const enrolledAt = now();

  const activated = await runWrite(
    sql`
      update users
         set "mfaEnabled" = true,
             "mfaEnrolledAt" = ${enrolledAt.toISOString()},
             "mfaRecoveryCodes" = ${JSON.stringify(hashes)},
             "mfaLastUsedStep" = ${verdict.step}
       where id = ${userId}
         and "mfaSecretCipher" is not null
       returning "id"
    `,
    "activation",
    deps,
  );
  if (!activated) return { ok: false, reason: "echec_ecriture" };

  return { ok: true, value: { recoveryCodes, enrolledAt } };
}

/* ------------------------------------------------------------------ */
/* Vérification du second facteur                                      */
/* ------------------------------------------------------------------ */

export type MfaSecondFactor = {
  /** Nature du facteur présenté. `totp` en usage courant, `recovery` en secours. */
  method: "totp" | "recovery";
  /** Pas TOTP consommé (`null` pour un code de secours). */
  step: number | null;
  /** Codes de secours restants APRÈS consommation. */
  recoveryCodesRemaining: number;
};

/**
 * Vérifie un second facteur : un code TOTP, ou un code de secours.
 *
 * ANTI-REJEU — il ne suffit pas de vérifier le code, il faut CONSOMMER le pas :
 * `update … where "mfaLastUsedStep" is null or "mfaLastUsedStep" < pas`. La
 * condition est dans la REQUÊTE, donc atomique : deux requêtes concurrentes avec
 * le même code ne peuvent pas réussir toutes les deux. Zéro ligne touchée =
 * rejeu = refus.
 *
 * CODES DE SECOURS — consommés par comparaison-échange : la nouvelle liste
 * remplace l’ancienne À CONDITION qu’elle soit encore celle qu’on a lue. Un code
 * ne peut donc pas servir deux fois, même sous concurrence.
 */
export async function verifySecondFactor(
  userId: number,
  code: string,
  deps: MfaDeps = {},
): Promise<MfaResult<MfaSecondFactor>> {
  const record = await readMfaRecord(userId, deps);
  if (!record) return { ok: false, reason: "indisponible" };
  if (!record.enabled || !record.secretCipher) return { ok: false, reason: "non_active" };

  const now = deps.now ?? (() => new Date());
  const digits = normalizeTotpCode(code);

  // 1. Code TOTP — six chiffres. On tente d’abord ce chemin : c’est l’usage
  //    courant, et un code de secours ne peut pas ressembler à un TOTP (longueur
  //    et alphabet disjoints).
  if (digits.length === TOTP_DIGITS) {
    let secret: string | null = null;
    try {
      secret = decryptMfaSecret(record.secretCipher);
    } catch (error) {
      logOnce("déchiffrement", error);
      return { ok: false, reason: "indisponible" };
    }
    const verdict = verifyTotp({
      secretBase32: secret,
      code,
      nowMs: now().getTime(),
      lastUsedStep: record.lastUsedStep,
    });
    if (verdict.ok && verdict.step !== null) {
      const consumed = await runWrite(
        sql`
          update users
             set "mfaLastUsedStep" = ${verdict.step}
           where id = ${userId}
             and ("mfaLastUsedStep" is null or "mfaLastUsedStep" < ${verdict.step})
           returning "id"
        `,
        "consommation du pas",
        deps,
      );
      if (!consumed) return { ok: false, reason: "code_deja_utilise" };
      return {
        ok: true,
        value: { method: "totp", step: verdict.step, recoveryCodesRemaining: record.recoveryCodeHashes.length },
      };
    }
    if (verdict.reason === "deja_utilise") return { ok: false, reason: "code_deja_utilise" };
  }

  // 2. Code de secours — dix caractères de l’alphabet annoncé.
  if (isRecoveryCode(code)) {
    const normalized = normalizeRecoveryCode(code);
    const remaining: string[] = [];
    let matched = false;
    // On retire TOUTES les empreintes égales au code présenté (il ne devrait y
    // en avoir qu’une : le tirage interdit les doublons) et on conserve les
    // autres telles quelles.
    for (const hash of record.recoveryCodeHashes) {
      const equal = await verifyPassword(normalized, hash);
      if (equal) matched = true;
      else remaining.push(hash);
    }
    if (!matched) return { ok: false, reason: "code_incorrect" };

    const consumed = await runWrite(
      sql`
        update users
           set "mfaRecoveryCodes" = ${JSON.stringify(remaining)}
         where id = ${userId}
           and "mfaRecoveryCodes" = ${record.recoveryCodesRaw}
         returning "id"
      `,
      "consommation d’un code de secours",
      deps,
    );
    if (!consumed) return { ok: false, reason: "code_deja_utilise" };
    return { ok: true, value: { method: "recovery", step: null, recoveryCodesRemaining: remaining.length } };
  }

  return { ok: false, reason: "code_incorrect" };
}

/* ------------------------------------------------------------------ */
/* Désactivation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Désactive la MFA. Un code VALIDE est exigé — TOTP ou code de secours.
 *
 * Accepter un code de secours n’affaiblit pas la règle : c’est un second
 * facteur, à usage unique. C’est même le seul moyen de sortir d’un téléphone
 * perdu, et exiger un TOTP dans ce cas condamnerait le compte à sa MFA.
 *
 * Les colonnes sont VIDÉES, pas seulement désactivées : `mfaSecretCipher`,
 * `mfaEnrolledAt`, `mfaRecoveryCodes` et `mfaLastUsedStep` reviennent à l’état
 * d’avant enrôlement. Un secret qui traîne n’a aucune raison de survivre à une
 * désactivation — c’est aussi ce qui rend un ré-enrôlement franc.
 */
export async function disableMfa(
  userId: number,
  code: string,
  deps: MfaDeps = {},
): Promise<MfaResult<{ disabledAt: Date }>> {
  const record = await readMfaRecord(userId, deps);
  if (!record) return { ok: false, reason: "indisponible" };
  if (!record.enabled) return { ok: false, reason: "non_active" };

  const verified = await verifySecondFactor(userId, code, deps);
  if (!verified.ok) return verified;

  const cleared = await runWrite(
    sql`
      update users
         set "mfaSecretCipher" = null,
             "mfaEnabled" = false,
             "mfaEnrolledAt" = null,
             "mfaRecoveryCodes" = null,
             "mfaLastUsedStep" = null
       where id = ${userId}
       returning "id"
    `,
    "désactivation",
    deps,
  );
  if (!cleared) return { ok: false, reason: "echec_ecriture" };

  return { ok: true, value: { disabledAt: (deps.now ?? (() => new Date()))() } };
}

/**
 * Vérifie qu’une valeur lue en base est bien une ENVELOPPE et non un secret en
 * clair. Utilisé par les tests comme par une relecture d’audit : un secret nu
 * (base32 de 32 caractères) n’est pas une enveloppe.
 */
export function isEncryptedSecret(value: string | null): boolean {
  return typeof value === "string" && isMfaEnvelope(value);
}
