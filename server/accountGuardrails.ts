import { TRPCError } from "@trpc/server";
import * as db from "./db";

/**
 * GARDE-FOUS PARTAGÉS SUR LES COMPTES — une seule règle, deux portes.
 *
 * Deux écrans administrent les comptes de l’instance, et ils n’obéissent pas au
 * même découpage :
 *
 *   - le back-office métier (`users.*`, `server/routers.ts`) sépare les
 *     DOMAINES : un `admin` administre les comptes métier, un `systeme` les
 *     comptes système (voir `assertAccountHabilitation`, qui reste là-bas — il
 *     décrit ce découpage, pas autre chose) ;
 *   - la console d’exploitation (`system.accounts.*`,
 *     `server/systemAccounts.ts`) donne à l’administrateur système TOUS les
 *     comptes, parce que c’est son métier d’exploitation.
 *
 * Les règles ci-dessous sont celles qui ne dépendent PAS de ce découpage : elles
 * protègent l’instance elle-même, quel que soit l’écran qui écrit. Ce fichier
 * existe pour qu’elles n’existent qu’une fois : deux implémentations d’un
 * garde-fou de sécurité finissent toujours par diverger, et c’est la moins
 * stricte des deux qui gagne en production.
 *
 * Aucune écriture, aucun schéma : ces fonctions LISENT un relevé de comptes et
 * LÈVENT un refus. Elles ne touchent jamais la base elles-mêmes.
 */

/** Rôle actuel d’un compte de l’instance (`null` s’il n’existe pas). */
export async function readAccountRole(userId: number): Promise<string | null> {
  const comptes = await db.listUsers();
  return comptes.find(compte => compte.id === userId)?.role ?? null;
}

/**
 * Refuse de retirer le DERNIER compte `systeme` de l’instance.
 *
 * Sans lui, plus personne ne peut ouvrir la console ni nommer un remplaçant :
 * la porte se referme définitivement. Le relevé est fourni par l’appelant pour
 * ne pas relire la table une seconde fois.
 *
 * Le décompte porte sur le relevé RÉEL des comptes, jamais sur une valeur
 * transmise par le navigateur : le garde-fou ne peut pas être contourné en
 * mentant sur l’état de l’instance.
 */
export function assertNotLastSystemAccount(comptes: Array<{ role: string }>): void {
  if (comptes.filter(compte => compte.role === "systeme").length <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Impossible de retirer le dernier compte d’administration système de l’instance : plus personne ne pourrait ouvrir la console ni en nommer un.",
    });
  }
}

/**
 * Refuse qu’un compte se retire à lui-même son propre rôle d’administrateur
 * système.
 *
 * Le geste est presque toujours une erreur de clic — on choisit « cadre » dans
 * la ligne où l’on est soi-même —, et sa conséquence est immédiate : l’auteur
 * perd la console en pleine opération, donc le moyen de revenir en arrière.
 * C’est un garde-fou de CONTINUITÉ, distinct du précédent : celui-ci protège le
 * compte qui agit, l’autre protège l’instance.
 *
 * L’identité comparée vient de la session RÉSOLUE (`ctx.user.id`), jamais d’une
 * valeur transmise par le navigateur.
 */
export function assertKeepsOwnSystemRole(
  actorId: number,
  targetUserId: number,
  requestedRole: string,
): void {
  if (actorId === targetUserId && requestedRole !== "systeme") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Vous ne pouvez pas retirer votre propre rôle d’administrateur système. Nommez d’abord un autre compte, puis faites-vous rétrograder depuis celui-ci.",
    });
  }
}

/**
 * Refuse qu’un compte se supprime lui-même.
 *
 * Même raisonnement que ci-dessus, en plus brutal : la suppression révoque
 * l’accès sans retour. Le geste légitime pour fermer son propre accès est de
 * demander à un autre administrateur, pas de se retirer soi-même en pleine
 * session.
 */
export function assertNotSelfRemoval(actorId: number, targetUserId: number): void {
  if (actorId === targetUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vous ne pouvez pas supprimer votre propre compte.",
    });
  }
}
