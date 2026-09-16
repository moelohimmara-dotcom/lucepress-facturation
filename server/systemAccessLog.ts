/**
 * JOURNAL DES TENTATIVES D’ACCÈS À LA CONSOLE D’EXPLOITATION.
 *
 * LA RÈGLE, EN UNE PHRASE
 * -----------------------
 * Silencieux pour l’intéressé, visible pour l’administrateur système.
 *
 * Quand un compte connecté mais NON HABILITÉ — ou un visiteur anonyme — frappe
 * un chemin de la console, l’interface ne doit RIEN lui apprendre : pas un mot,
 * pas un indice, pas la confirmation que cet espace existe. Ce silence est une
 * décision de sécurité, pas une omission : une page qui dit « accès refusé »
 * révèle l’existence d’une zone à attaquer.
 *
 * Le corollaire est un devoir : si l’on ne dit rien à l’intéressé, il faut le
 * dire à quelqu’un. Chaque refus écrit donc UNE ligne structurée dans le journal
 * du serveur, là où le propriétaire de l’instance la lira (journal de
 * l’hébergeur). C’est le seul endroit où l’existence de la console est nommée.
 *
 * CE QUI N’EST JAMAIS ÉCRIT
 * -------------------------
 * Aucun mot de passe, aucun jeton — ni de session, ni de défi —, aucun secret
 * TOTP, aucun code à six chiffres, aucun code de secours, aucun contenu de
 * requête. La ligne nomme l’ACTEUR, la PROCÉDURE VISÉE et le MOTIF : de quoi
 * enquêter, rien de quoi rejouer.
 *
 * POURQUOI AUCUNE ADRESSE IP
 * --------------------------
 * Elle serait utile, mais c’est une donnée personnelle, et elle n’est pas
 * nécessaire ici : la force brute sur les mots de passe et sur les codes à six
 * chiffres est déjà comptée et bloquée par `_core/loginRateLimit.ts`. Ce journal
 * dit QUI a tenté quoi, pas d’où.
 *
 * POURQUOI UNE DÉDUPLICATION
 * --------------------------
 * Un client qui boucle sur `/console` écrirait des milliers de lignes identiques
 * en quelques minutes et noierait le journal — exactement le raisonnement tenu
 * par `server/sessionRegistry.ts`. On écrit donc au plus une ligne par
 * (motif, procédure, acteur) et par fenêtre ; les répétitions immédiates sont
 * tues. L’information ne devient pas fausse : elle cesse d’être répétée.
 */

/** Motif du refus, ou étape franchie. Vocabulaire FERMÉ, stable, sans accent. */
export type ConsoleAttemptOutcome =
  /** Aucune session valide : visiteur anonyme. */
  | "anonyme"
  /** Session valide, rôle non habilité (`admin`, `cadre`, `directeur`, `client`). */
  | "role_refuse"
  /** Rôle habilité, mais aucune authentification à deux facteurs active. */
  | "mfa_absente"
  /** Défi MFA présenté, invalide ou expiré. */
  | "defi_refuse"
  /** Enrôlement MFA commencé (secret généré, non encore confirmé). */
  | "enrolement_demarre"
  /** Enrôlement MFA confirmé par un premier code : la MFA devient active. */
  | "enrolement_confirme"
  /** MFA désactivée, sur présentation d’un code valide. */
  | "mfa_desactivee";

export type ConsoleAttemptEvent = {
  outcome: ConsoleAttemptOutcome;
  /** Procédure visée, ou chemin d’écran. Jamais un contenu de requête. */
  target: string;
  /** Rôle porté par le compte, tel quel (valeur inconnue affichée telle quelle). */
  role?: string | null;
  /** Identité de l’acteur : e-mail si connu, sinon identifiant technique. */
  actor?: string | null;
  /** Identifiant interne du compte, `null` si non authentifié. */
  actorId?: number | null;
  tenantId?: number | null;
};

export type ConsoleAttemptLogDeps = {
  /** Destination de la ligne. Par défaut : `console.warn`. */
  sink?: (line: string) => void;
  /** Horloge injectable, en millisecondes. */
  now?: () => number;
  /** Fenêtre de déduplication, en millisecondes. */
  windowMs?: number;
};

/**
 * Fenêtre de déduplication. Cinq minutes : assez courte pour qu’une campagne de
 * tentatives espacée soit vue, assez longue pour qu’une boucle serrée ne
 * produise pas dix mille lignes.
 */
export const CONSOLE_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

/** Borne du cache de déduplication : au-delà, il est vidé (pas de fuite mémoire). */
const DEDUP_MAX_ENTRIES = 200;

const LAST_LOGGED_AT = new Map<string, number>();

/**
 * Remet à zéro la déduplication — réservé aux tests, qui doivent pouvoir
 * observer deux lignes successives identiques.
 */
export function resetConsoleAttemptLog(): void {
  LAST_LOGGED_AT.clear();
}

/** Ligne lisible, sans données sensibles. Fonction PURE, donc testable telle quelle. */
export function formatConsoleAttempt(event: ConsoleAttemptEvent): string {
  const actor = event.actor && event.actor.trim().length > 0 ? event.actor.trim() : "anonyme";
  const actorId = event.actorId === null || event.actorId === undefined ? "?" : String(event.actorId);
  const role = event.role && event.role.trim().length > 0 ? event.role.trim() : "aucun";
  const tenant = event.tenantId === null || event.tenantId === undefined ? "?" : String(event.tenantId);
  return (
    `[console] tentative — motif=${event.outcome} cible=${event.target}` +
    ` acteur=${actor}(id ${actorId}) role=${role} tenant=${tenant}`
  );
}

/**
 * Écrit une ligne de journal, au plus une fois par fenêtre et par
 * (motif, cible, acteur). Ne lève jamais : journaliser un refus ne doit pas
 * pouvoir provoquer l’échec de la requête qui l’a motivé.
 */
export function logConsoleAttempt(event: ConsoleAttemptEvent, deps: ConsoleAttemptLogDeps = {}): void {
  try {
    const now = (deps.now ?? Date.now)();
    const windowMs = deps.windowMs ?? CONSOLE_ATTEMPT_WINDOW_MS;
    const key = `${event.outcome}|${event.target}|${event.actor ?? ""}`;

    const previous = LAST_LOGGED_AT.get(key);
    if (previous !== undefined && now - previous < windowMs) return;

    const sink = deps.sink ?? ((line: string) => console.warn(line));
    // La ligne est écrite AVANT d’être marquée comme écrite. Si la destination
    // échoue, aucune marque n’est posée : la tentative suivante, identique,
    // sera donc journalisée à nouveau. Marquer d’abord reviendrait à taire une
    // tentative au motif qu’on a CRU la journaliser.
    sink(formatConsoleAttempt(event));

    if (LAST_LOGGED_AT.size >= DEDUP_MAX_ENTRIES) LAST_LOGGED_AT.clear();
    LAST_LOGGED_AT.set(key, now);
  } catch {
    // Un journal ne fait jamais échouer une requête.
  }
}
