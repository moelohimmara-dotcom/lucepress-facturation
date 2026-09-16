import { randomInt } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { APP_ROLE_LABELS, isSystemRole, type PersistedAppRole } from "../shared/roles";
import {
  assertKeepsOwnSystemRole,
  assertNotLastSystemAccount,
  assertNotSelfRemoval,
  readAccountRole,
} from "./accountGuardrails";
import * as db from "./db";
import {
  issueInvitation,
  resendInvitationEmail,
  type IssueInvitationResult,
  type ResendInvitationOutcome,
} from "./invitationIssue";
import { logConsoleAction, type ConsoleActionName, type ConsoleActionOutcome } from "./systemAccessLog";

/**
 * ÉCRITURE SUR LES COMPTES ET LES INVITATIONS — le bras armé de la console.
 *
 * Ce module est le pendant AGISSANT de `server/systemAccess.ts` (lecture). Il
 * porte les huit écritures de l’écran « Accès & comptes » :
 *
 *   comptes      — création, changement de nom, changement de rôle,
 *                  réinitialisation de mot de passe, suppression ;
 *   invitations  — émission, renvoi, révocation.
 *
 * CE QU’IL RÉUTILISE, ET POURQUOI IL NE RÉIMPLÉMENTE RIEN
 * ------------------------------------------------------
 * - `db.*` pour toute écriture. Aucune requête SQL n’est écrite ici : le module
 *   ne connaît ni table ni colonne, donc il ne peut pas dériver du schéma — et
 *   il n’a, littéralement, pas de quoi en modifier un (aucun DDL).
 * - `accountGuardrails.*` pour les règles qui protègent l’INSTANCE (dernier
 *   compte système, auto-rétrogradation, auto-suppression). Ces règles existent
 *   déjà pour le back-office métier ; les réécrire ici suffirait à faire
 *   diverger les deux écrans, et c’est la version la plus permissive qui gagne
 *   en production.
 * - `invitationIssue.*` pour les invitations : un seul chemin crée une
 *   invitation, avec ses garanties (un compte par adresse, une invitation en
 *   attente par adresse, jeton jamais stocké en clair, envoi d’e-mail non
 *   bloquant).
 *
 * CE QUI CHANGE PAR RAPPORT AU BACK-OFFICE MÉTIER
 * ----------------------------------------------
 * Le back-office métier (`users.*`) sépare les DOMAINES : un `admin` administre
 * les comptes métier, un `systeme` les comptes système. La console, elle, donne
 * à l’administrateur système TOUS les comptes — c’est son métier d’exploitation,
 * et le cahier des charges § 5 le dit ainsi (« l’administrateur système gère
 * tous les comptes »). `assertAccountHabilitation` n’a donc rien à faire ici :
 * ce n’est pas une règle de sécurité de l’instance, c’est le découpage du
 * back-office. Les garde-fous que ce module applique sont ceux qui ne dépendent
 * PAS de ce découpage.
 *
 * UNE SEULE EXCEPTION, ASSUMÉE ET DITE : la création d’un compte `client` reste
 * refusée, exactement comme dans `users.create`. Un compte portail sans fiche
 * client liée n’ouvre rien ; l’écran qui sait le créer est la fiche client.
 * Ouvrir ici une seconde porte, plus permissive, pour le même acte serait une
 * régression, pas une fonctionnalité.
 *
 * AUCUN SECRET N’EST JOURNALISÉ
 * -----------------------------
 * Le type `ConsoleActionEvent` n’a pas de champ mot de passe, et ce module ne
 * lui en transmet aucun : la seule valeur sensible qui circule (le mot de passe
 * temporaire) est RENDUE à l’appelant, jamais journalisée. Un test le vérifie en
 * capturant la sortie du journal pendant une réinitialisation.
 */

/** Identité de l’acteur, telle que le journal doit la porter. Aucun secret. */
export type ConsoleActor = {
  id: number;
  name: string | null;
  /** E-mail si connu, sinon identifiant technique. Jamais un mot de passe. */
  email: string | null;
  role: string;
  tenantId: number | null;
};

/* ------------------------------------------------------------------ */
/* Mot de passe temporaire                                             */
/* ------------------------------------------------------------------ */

/**
 * Alphabet du mot de passe temporaire — sans glyphes ambigus : ni `0`/`O`, ni
 * `1`/`I`/`l`. C’est la même règle que les codes de secours MFA
 * (`shared/mfa.ts`), et pour la même raison : ce mot de passe est RECOPIÉ À LA
 * MAIN par l’administrateur vers un canal sûr (téléphone, SMS, de vive voix).
 * Un caractère ambigu se transforme en appel au support.
 */
export const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Longueur du mot de passe temporaire. Seize caractères sur cet alphabet
 * valent environ 93 bits : très au-delà de la politique appliquée par
 * l’application (8 à 128 caractères, aucune exigence de complexité — voir
 * `PASSWORD_POLICY`), et sans caractère impossible à dicter au téléphone.
 */
export const TEMPORARY_PASSWORD_LENGTH = 16;

/**
 * Tire un mot de passe temporaire. Fonction PURE vis-à-vis de son entrée : le
 * tirage est injectable, donc reproductible en test.
 *
 * `randomInt` (node:crypto) rend une valeur uniforme et cryptographiquement
 * sûre — contrairement à `Math.random`, qui serait ici un générateur de
 * mots de passe prévisibles.
 */
export function createTemporaryPassword(
  length: number = TEMPORARY_PASSWORD_LENGTH,
  random: (max: number) => number = max => randomInt(max),
): string {
  const taille = Number.isFinite(length) ? Math.max(8, Math.trunc(length)) : TEMPORARY_PASSWORD_LENGTH;
  let motDePasse = "";
  for (let index = 0; index < taille; index += 1) {
    motDePasse += TEMPORARY_PASSWORD_ALPHABET[random(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return motDePasse;
}

/* ------------------------------------------------------------------ */
/* Journalisation des écritures                                        */
/* ------------------------------------------------------------------ */

/**
 * Codes de refus : l’écriture n’a PAS été appliquée parce que l’état de
 * l’instance ne le permettait pas (garde-fou, compte inexistant, doublon).
 * Tout le reste est un ÉCHEC : l’infrastructure n’a pas répondu.
 *
 * La distinction n’est pas cosmétique. « refusé » dit à qui enquête qu’une
 * règle a joué et que rien n’a bougé ; « échec » dit qu’il faut regarder la
 * base ou le serveur de messagerie. Les confondre reviendrait à masquer la
 * moitié des incidents.
 */
const REFUSAL_CODES = new Set<string>([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "METHOD_NOT_SUPPORTED",
]);

/** Classe un échec d’écriture. Fonction PURE, donc testable telle quelle. */
export function classifyConsoleOutcome(error: unknown): Exclude<ConsoleActionOutcome, "ok"> {
  return error instanceof TRPCError && REFUSAL_CODES.has(error.code) ? "refuse" : "echec";
}

/** Cible d’un compte, sous forme technique stable (`compte#12`). */
export function accountTarget(userId: number | null | undefined): string {
  return typeof userId === "number" && Number.isFinite(userId) ? `compte#${userId}` : "compte#inconnu";
}

/** Cible d’une invitation, sous forme technique stable (`invitation#7`). */
export function invitationTarget(invitationId: number | null | undefined): string {
  return typeof invitationId === "number" && Number.isFinite(invitationId) ? `invitation#${invitationId}` : "invitation#inconnue";
}

/**
 * Exécute une écriture de console et la journalise, QUOI QU’IL ARRIVE.
 *
 * Trois garanties, dans cet ordre :
 *  1. le geste est tenté une fois, jamais rejoué ;
 *  2. une ligne est écrite pour un succès COMME pour un refus ou un échec — la
 *     ligne dit donc toujours la vérité sur ce qui a été modifié ;
 *  3. l’erreur d’origine est relancée TELLE QUELLE : le journal n’attrape pas
 *     les erreurs, il les accompagne. Un écran qui reçoit « dernier compte
 *     système » doit recevoir le message du garde-fou, pas un message de journal.
 *
 * La cible est évaluée AU MOMENT de la journalisation, via une fonction : une
 * création ne connaît l’identifiant de son compte qu’une fois la ligne insérée,
 * et la ligne de journal doit porter l’identifiant RÉEL, pas « à venir ».
 */
async function performConsoleAction<T>(options: {
  actor: ConsoleActor;
  action: ConsoleActionName;
  target: () => string;
  work: () => Promise<T>;
}): Promise<T> {
  const trace = (outcome: ConsoleActionOutcome) =>
    logConsoleAction({
      action: options.action,
      outcome,
      target: options.target(),
      role: options.actor.role,
      actor: options.actor.email,
      actorId: options.actor.id,
      tenantId: options.actor.tenantId,
    });

  try {
    const result = await options.work();
    trace("ok");
    return result;
  } catch (error) {
    trace(classifyConsoleOutcome(error));
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

/** Message de refus lorsqu’un identifiant de compte ne correspond à rien. */
const COMPTE_INTROUVABLE =
  "Ce compte n’existe pas sur cette instance. La liste a peut-être changé — actualisez-la avant de réessayer.";

/** Refus partagé par la création et l’invitation d’un compte portail. */
const PORTAIL_REFUSE =
  "Les accès au portail client s’invitent depuis la fiche du client, pas depuis la console : un compte portail sans fiche liée n’ouvrirait rien.";

/** Tire la lecture d’un compte, ou refuse. Le relevé est rendu pour être réutilisé. */
async function readAccountOrFail(userId: number): Promise<{ role: string }> {
  const role = await readAccountRole(userId);
  if (role === null) {
    throw new TRPCError({ code: "NOT_FOUND", message: COMPTE_INTROUVABLE });
  }
  return { role };
}

export type CreateConsoleAccountInput = {
  actor: ConsoleActor;
  email: string;
  name: string | null;
  role: PersistedAppRole;
  password: string;
};

/**
 * Crée un compte, y compris un compte `systeme`.
 *
 * L’e-mail est la clé de connexion : un doublon est refusé plutôt qu’écrasé.
 * Le mot de passe est fourni par l’administrateur système (il vient d’être
 * saisi à l’écran) et n’est jamais relu : seule son empreinte scrypt est
 * écrite, exactement comme le fait `users.create`.
 */
export async function createConsoleAccount(input: CreateConsoleAccountInput): Promise<{ id: number; openId: string }> {
  let cible: number | null = null;
  return performConsoleAction({
    actor: input.actor,
    action: "compte.creation",
    target: () => accountTarget(cible),
    work: async () => {
      if (input.role === "client") {
        throw new TRPCError({ code: "BAD_REQUEST", message: PORTAIL_REFUSE });
      }
      const existant = await db.getUserByEmail(input.email);
      if (existant) {
        throw new TRPCError({ code: "CONFLICT", message: "Un compte existe déjà avec cet e-mail." });
      }
      const { hashPassword } = await import("./_core/password");
      const passwordHash = await hashPassword(input.password);
      const compte = await db.createLocalUser({
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
        tenantId: input.actor.tenantId ?? undefined,
      });
      cible = compte.id;
      return compte;
    },
  });
}

export type RenameConsoleAccountInput = {
  actor: ConsoleActor;
  userId: number;
  /** Chaîne vide ou espaces = effacer le nom (`null` en base). */
  name: string;
};

/**
 * Change le NOM affiché d’un compte, et rien d’autre.
 *
 * Ni le rôle, ni le mot de passe, ni l’e-mail : le nom identifie, il n’habilite
 * pas. Aucun garde-fou n’est donc requis — se renommer soi-même ne retire aucun
 * droit.
 */
export async function renameConsoleAccount(input: RenameConsoleAccountInput): Promise<{ userId: number }> {
  const nom = input.name.trim().length > 0 ? input.name.trim() : null;
  return performConsoleAction({
    actor: input.actor,
    action: "compte.nom",
    target: () => accountTarget(input.userId),
    work: async () => {
      await readAccountOrFail(input.userId);
      await db.setUserName(input.userId, nom);
      return { userId: input.userId };
    },
  });
}

export type SetConsoleAccountRoleInput = {
  actor: ConsoleActor;
  userId: number;
  role: PersistedAppRole;
};

/**
 * Change le rôle d’un compte.
 *
 * DEUX GARDE-FOUS, DEUX RAISONS DIFFÉRENTES — et l’ordre compte :
 *  1. `assertKeepsOwnSystemRole` protège le COMPTE QUI AGIT : se retirer à
 *     soi-même le rôle système ferme la console en pleine opération, donc le
 *     moyen de revenir en arrière ;
 *  2. `assertNotLastSystemAccount` protège L’INSTANCE : retirer le dernier rôle
 *     système, c’est fermer la porte pour tout le monde, définitivement.
 *
 * Le décompte du second porte sur le relevé RÉEL des comptes, jamais sur une
 * valeur venue du navigateur.
 */
export async function setConsoleAccountRole(input: SetConsoleAccountRoleInput): Promise<{ userId: number; role: PersistedAppRole }> {
  return performConsoleAction({
    actor: input.actor,
    action: "compte.role",
    target: () => accountTarget(input.userId),
    work: async () => {
      const comptes = await db.listUsers();
      const compte = comptes.find(entree => entree.id === input.userId);
      if (!compte) {
        throw new TRPCError({ code: "NOT_FOUND", message: COMPTE_INTROUVABLE });
      }
      assertKeepsOwnSystemRole(input.actor.id, input.userId, input.role);
      if (isSystemRole(compte.role) && !isSystemRole(input.role)) {
        assertNotLastSystemAccount(comptes);
      }
      await db.setUserRole(input.userId, input.role);
      return { userId: input.userId, role: input.role };
    },
  });
}

export type ResetConsoleAccountPasswordInput = {
  actor: ConsoleActor;
  userId: number;
};

export type ResetConsoleAccountPasswordResult = {
  userId: number;
  /** Rôle du compte au moment du geste. Jamais un secret. */
  role: string;
  /**
   * Mot de passe temporaire, RENDU UNE SEULE FOIS.
   *
   * Il n’est ni journalisé, ni stocké, ni relisible : la base n’en garde que
   * l’empreinte scrypt, et aucune procédure ne le rendra à nouveau. Si
   * l’administrateur le perd avant de l’avoir transmis, le seul recours est
   * d’en tirer un autre.
   */
  temporaryPassword: string;
};

/**
 * Réinitialise le mot de passe d’un compte sans connaître l’ancien.
 *
 * Le mot de passe est TIRÉ PAR LE SERVEUR plutôt que saisi par
 * l’administrateur : c’est ce qui permet de garantir qu’il est long et
 * imprévisible, au lieu de dépendre de l’inspiration du moment. Il est rendu
 * une fois, à l’écran, avec la consigne de le transmettre par un canal sûr.
 *
 * CE QUI N’EST PAS FAIT ICI, ET QU’IL FAUT SAVOIR : les sessions déjà ouvertes
 * sur ce compte restent valides. Le changement de mot de passe ne les ferme pas.
 * L’écran voisin « Sessions actives » sait les révoquer ; le faire
 * automatiquement ici serait une décision d’exploitation, pas un détail
 * d’implémentation — et elle n’est pas prise.
 */
export async function resetConsoleAccountPassword(
  input: ResetConsoleAccountPasswordInput,
): Promise<ResetConsoleAccountPasswordResult> {
  return performConsoleAction({
    actor: input.actor,
    action: "compte.mot-de-passe",
    target: () => accountTarget(input.userId),
    work: async () => {
      const compte = await readAccountOrFail(input.userId);
      const temporaryPassword = createTemporaryPassword();
      const { hashPassword } = await import("./_core/password");
      await db.resetUserPassword(input.userId, await hashPassword(temporaryPassword));
      return { userId: input.userId, role: compte.role, temporaryPassword };
    },
  });
}

export type RemoveConsoleAccountInput = {
  actor: ConsoleActor;
  userId: number;
};

/** Traduit le refus de `db.deleteUser` sans inventer une cause qu’il n’a pas donnée. */
function removalMessage(reason: string | undefined): string {
  if (reason === "dernier_admin") {
    return "Impossible de supprimer le dernier administrateur de l’instance : plus personne ne pourrait administrer le commerce.";
  }
  if (reason === "compte_introuvable") return COMPTE_INTROUVABLE;
  return "La suppression n’a pas été enregistrée.";
}

/**
 * Supprime un compte. Geste IRRÉVERSIBLE, donc le plus gardé de tous.
 *
 * Trois refus possibles, et ils ne disent pas la même chose : le compte visé
 * n’existe pas (NOT_FOUND), c’est le compte de l’auteur (BAD_REQUEST, garde-fou
 * de continuité), ou c’est le dernier compte système (BAD_REQUEST, garde-fou
 * d’instance). `db.deleteUser` en ajoute un quatrième, plus bas : le dernier
 * compte `admin`, protégé par la couche de données elle-même.
 */
export async function removeConsoleAccount(input: RemoveConsoleAccountInput): Promise<{ userId: number }> {
  return performConsoleAction({
    actor: input.actor,
    action: "compte.suppression",
    target: () => accountTarget(input.userId),
    work: async () => {
      const comptes = await db.listUsers();
      const compte = comptes.find(entree => entree.id === input.userId);
      if (!compte) {
        throw new TRPCError({ code: "NOT_FOUND", message: COMPTE_INTROUVABLE });
      }
      assertNotSelfRemoval(input.actor.id, input.userId);
      if (isSystemRole(compte.role)) {
        assertNotLastSystemAccount(comptes);
      }
      const resultat = await db.deleteUser(input.userId);
      if (!resultat.deleted) {
        throw new TRPCError({ code: "BAD_REQUEST", message: removalMessage(resultat.reason) });
      }
      return { userId: input.userId };
    },
  });
}

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

/** Requête HTTP minimale dont `invitationIssue` a besoin pour composer le lien. */
export type ConsoleRequest = { protocol?: string; get?: (name: string) => string | undefined };

/**
 * Invitation en attente, telle que l’écran doit la montrer pour proposer
 * « renvoyer » ou « révoquer ».
 *
 * NI JETON, NI EMPREINTE DE JETON : la projection vient de
 * `db.listPendingInvitations()`, écrite colonne par colonne précisément pour
 * qu’une empreinte ne puisse pas s’y glisser. L’adresse e-mail, elle, est bien
 * présente : c’est ce que l’administrateur doit pouvoir lire pour décider.
 */
export type ConsolePendingInvitation = {
  id: number;
  email: string;
  role: string;
  roleLabel: string;
  /** Horodatages ISO 8601 : le transport tRPC ne porte pas d’objet `Date`. */
  expiresAt: string;
  createdAt: string;
  /** Vrai quand l’échéance est passée mais que la ligne est encore `pending`. */
  expired: boolean;
};

/**
 * Invitations en attente de l’instance. LECTURE : elle ne journalise rien (le
 * journal des écritures ne recense que les actes, pas les consultations).
 *
 * Une échéance dépassée n’est PAS retirée de la liste : l’invitation reste
 * `pending` en base, donc elle doit se voir, marquée « expirée ». La faire
 * disparaître laisserait croire qu’il n’y a plus rien à faire.
 */
export async function listConsoleInvitations(deps: { now?: () => Date } = {}): Promise<ConsolePendingInvitation[]> {
  const now = deps.now ?? (() => new Date());
  const invitations = await db.listPendingInvitations();
  return invitations.map(invitation => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    roleLabel: (APP_ROLE_LABELS as Record<string, string | undefined>)[invitation.role] ?? invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
    expired: invitation.expiresAt.getTime() <= now().getTime(),
  }));
}

export type IssueConsoleInvitationInput = {
  actor: ConsoleActor;
  email: string;
  role: PersistedAppRole;
  req: ConsoleRequest;
};

/**
 * Émet une invitation. Aucune règle d’invitation n’est réécrite ici : tout
 * passe par `issueInvitation`, qui garantit déjà un compte par adresse, une
 * seule invitation en attente par adresse, et un jeton jamais stocké en clair.
 *
 * Le LIEN n’est pas journalisé — il porte un jeton en clair. La ligne de
 * journal nomme l’invitation par son identifiant, ce qui suffit à la retrouver.
 */
export async function issueConsoleInvitation(input: IssueConsoleInvitationInput): Promise<IssueInvitationResult> {
  let cible: number | null = null;
  return performConsoleAction({
    actor: input.actor,
    action: "invitation.creation",
    target: () => invitationTarget(cible),
    work: async () => {
      if (input.role === "client") {
        throw new TRPCError({ code: "BAD_REQUEST", message: PORTAIL_REFUSE });
      }
      if (input.actor.tenantId === null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aucune instance associée à cette session." });
      }
      const invitation = await issueInvitation({
        email: input.email,
        role: input.role,
        invitedById: input.actor.id,
        invitedByName: input.actor.name,
        tenantId: input.actor.tenantId,
        req: input.req,
      });
      cible = invitation.invitationId;
      return invitation;
    },
  });
}

export type ResendConsoleInvitationInput = {
  actor: ConsoleActor;
  id: number;
  req: ConsoleRequest;
};

/**
 * Renvoie une invitation en attente. Le jeton est RÉGÉNÉRÉ : l’ancien lien
 * cesse d’être valable, et `resendInvitationEmail` le dit lui-même à l’appelant
 * (que l’interface répercute). Ce module ne fait que journaliser le geste.
 */
export async function resendConsoleInvitation(
  input: ResendConsoleInvitationInput,
): Promise<ResendInvitationOutcome> {
  return performConsoleAction({
    actor: input.actor,
    action: "invitation.renvoi",
    target: () => invitationTarget(input.id),
    work: () =>
      resendInvitationEmail({
        id: input.id,
        req: input.req,
        inviterName: input.actor.name,
      }),
  });
}

export type RevokeConsoleInvitationInput = {
  actor: ConsoleActor;
  id: number;
};

const INVITATION_INTROUVABLE =
  "Cette invitation n’est plus en attente : elle a été acceptée, révoquée, ou a expiré. Actualisez la liste.";

/**
 * Révoque une invitation en attente.
 *
 * L’existence est vérifiée AVANT d’écrire : `db.revokeInvitation` ne se plaint
 * pas d’un identifiant inconnu, et journaliser « ok » sur une ligne qui n’a rien
 * changé serait un faux témoignage. Un identifiant périmé reçoit donc un refus
 * explicite.
 */
export async function revokeConsoleInvitation(input: RevokeConsoleInvitationInput): Promise<{ id: number; email: string }> {
  return performConsoleAction({
    actor: input.actor,
    action: "invitation.revocation",
    target: () => invitationTarget(input.id),
    work: async () => {
      const enAttente = await db.listPendingInvitations();
      const invitation = enAttente.find(entree => entree.id === input.id);
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: INVITATION_INTROUVABLE });
      }
      await db.revokeInvitation(input.id);
      return { id: input.id, email: invitation.email };
    },
  });
}
