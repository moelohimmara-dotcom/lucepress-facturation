import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { APP_ROLES, STAFF_ASSIGNABLE_ROLES, hasSystemAccess } from "@shared/roles";
import { pingDatabase } from "../db";
import { hashSessionToken } from "../sessionRegistry";
import {
  createConsoleAccount,
  issueConsoleInvitation,
  listConsoleInvitations,
  removeConsoleAccount,
  renameConsoleAccount,
  resendConsoleInvitation,
  resetConsoleAccountPassword,
  revokeConsoleInvitation,
  setConsoleAccountRole,
  type ConsoleActor,
} from "../systemAccounts";
import { collectSystemAccess } from "../systemAccess";
import { logConsoleAttempt } from "../systemAccessLog";
import { collectSystemMetrics } from "../systemMetrics";
import { collectSystemSessions, revokeSessionById } from "../systemSessions";
import { readRequestSessionToken, type TrpcContext } from "./context";
import { buildHealthPayload } from "./health";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router, systemProcedure } from "./trpc";
import { listLLMModels, pickLLMModel } from "./llm";

/** Identité applicative affichée par la console d’exploitation. */
const APPLICATION_NAME = "Lucepress Facturation";
/** Renseignée par l’hébergeur au déploiement ; `null` si inconnue (jamais inventée). */
const APPLICATION_VERSION = process.env.APP_VERSION?.trim() || null;

/**
 * Identité de l’acteur, pour le journal des écritures.
 *
 * Elle vient de la session RÉSOLUE par le serveur, jamais de la requête : un
 * appelant ne peut donc pas signer une ligne de journal à la place d’un autre.
 *
 * `systemProcedure` garantit déjà la présence d’un compte — ce refus n’existe
 * que pour que le type le dise, et pour qu’une évolution du garde ne se traduise
 * pas par une ligne d’audit signée « acteur inconnu ». Un journal qui ne sait
 * plus qui a agi ne sert plus à rien.
 */
function consoleActor(ctx: TrpcContext): ConsoleActor {
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session absente." });
  }
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? user.openId ?? null,
    role: user.role,
    tenantId: ctx.tenantId ?? null,
  };
}

export const systemRouter = router({
  // Sans input obligatoire : le moniteur VPS / curl GET doit pouvoir
  // appeler /api/trpc/system.health sans payload.
  health: publicProcedure.query(async () => {
    const dbOk = await pingDatabase();
    return buildHealthPayload({ dbOk });
  }),

  /**
   * TÉMOIN DE REFUS — pourquoi une procédure PUBLIQUE, et pourquoi elle existe.
   *
   * Le refus d’accès à la console est MUET côté interface : `SystemGate` rend la
   * 404 de l’application sans nommer l’espace protégé (voir
   * `client/src/components/SystemGate.tsx`). Ce silence a une contrepartie : la
   * tentative doit être écrite dans le journal du serveur, sinon l’administrateur
   * système ne voit rien de ce qui se passe.
   *
   * Or un refus rendu par l’interface n’émet AUCUNE requête : le geste le plus
   * réaliste — taper un chemin réservé dans la barre d’adresse — était donc le
   * seul à ne laisser aucune trace. Cette procédure est là pour combler ce trou :
   * le navigateur SIGNALE son refus, le serveur l’inscrit.
   *
   * ELLE N’ACCEPTE AUCUNE ENTRÉE, ET C’EST DÉLIBÉRÉ. L’acteur, son rôle et son
   * tenant viennent de la session RÉSOLUE par le serveur (`_core/context.ts`),
   * jamais de la requête : un appelant ne peut donc pas fabriquer une ligne
   * accusant quelqu’un d’autre. Il ne peut que dire « moi, ici, j’ai été refusé ».
   *
   * ELLE NE MENT PAS NON PLUS SUR ELLE-MÊME : un compte RÉELLEMENT habilité (le
   * rôle système, avec sa MFA active) n’a pas été refusé, et son appel ne
   * produit donc aucune ligne. Sans ce garde-fou, n’importe qui pourrait
   * fabriquer de fausses traces à son propre sujet en appelant la procédure à la
   * main — la ligne cesserait d’être une preuve.
   *
   * CE QU’ELLE N’EST PAS : une seconde porte. Elle ne rend aucune donnée, ne
   * vérifie aucun droit, et n’a d’autre effet qu’une ligne de journal —
   * dédupliquée (une par motif, cible et acteur, par fenêtre de cinq minutes :
   * voir `server/systemAccessLog.ts`), ce qui borne à une ligne l’acharnement
   * d’un client qui boucle.
   */
  reportRefusal: publicProcedure.mutation(({ ctx }) => {
    // Un rôle habilité n’a rien à signaler : la tentative n’a pas été refusée.
    // On rend tout de même un succès — cette procédure informe, elle ne juge pas.
    if (!hasSystemAccess(ctx.user?.role)) {
      logConsoleAttempt({
        outcome: ctx.user ? "role_refuse" : "anonyme",
        target: "/console",
        role: ctx.user?.role ?? null,
        actor: ctx.user?.email ?? ctx.user?.openId ?? null,
        actorId: ctx.user?.id ?? null,
        tenantId: ctx.tenantId,
      });
    }
    return { success: true as const };
  }),

  /**
   * Résumé d’exploitation pour la console (Phase 1 — socle).
   * Réutilise `pingDatabase` et `buildHealthPayload` : aucune donnée inventée,
   * aucune variable d’environnement, aucun secret, aucune stack.
   */
  overview: systemProcedure.query(async () => {
    const dbOk = await pingDatabase();
    return {
      application: {
        name: APPLICATION_NAME,
        version: APPLICATION_VERSION,
      },
      health: buildHealthPayload({ dbOk }),
    };
  }),

  /**
   * Mesures détaillées de supervision (Phase 2 — module 2 « Santé & supervision »).
   * Lecture seule : comptages, tailles (`pg_catalog`), suivi des migrations.
   * Une mesure illisible vaut `null` et est listée dans `unavailable` — la
   * procédure ne remonte ni exception, ni message d’erreur, ni secret.
   */
  metrics: systemProcedure.query(async () => collectSystemMetrics()),

  /**
   * Accès et comptes de l’instance (Phase 3 — module 4, étape A « lecture seule »).
   * Lecture seule : comptes (staff et portail client), répartition par rôle,
   * invitations en attente, moyens d’accès et politique de mot de passe.
   * Aucun secret, aucun jeton : voir `server/systemAccess.ts`.
   */
  access: systemProcedure.query(async ({ ctx }) => collectSystemAccess({ tenantId: ctx.tenantId ?? undefined })),

  /**
   * ÉCRITURE SUR LES COMPTES — l’écran « Accès & comptes » cesse d’être une
   * simple revue et devient agissant (Phase 3, module 4, étape C).
   *
   * CINQ PROCÉDURES, TOUTES SOUS `systemProcedure` : rôle `systeme` ET double
   * authentification active. Le contrôle est donc serveur, à chaque appel —
   * l’interface ne fait que refléter une décision déjà prise ici, et un compte
   * `admin`, `directeur`, `cadre` ou `client` reçoit un 403 sur chacune.
   *
   * AUCUNE RÈGLE N’EST ÉCRITE DANS CE FICHIER : les procédures traduisent une
   * entrée typée et délèguent à `server/systemAccounts.ts`, qui réutilise
   * `db.*`, `accountGuardrails.*` et `invitationIssue.*`. Ce découpage est
   * délibéré — la même règle doit valoir pour les deux écrans qui administrent
   * les comptes, et deux implémentations d’un garde-fou finissent par diverger.
   *
   * LA JOURNALISATION N’EST PAS ICI NON PLUS : `systemAccounts` écrit une ligne
   * par écriture, succès comme refus (voir `server/systemAccessLog.ts`). Une
   * écriture ne peut pas être ajoutée sans sa ligne, puisque c’est le même appel
   * qui exécute et qui journalise.
   *
   * PÉRIMÈTRE VOLONTAIREMENT LARGE : l’administrateur système gère TOUS les
   * comptes, métier comme système (cahier des charges § 5). Le découpage par
   * domaine de `users.*` (un `admin` administre le métier, un `systeme` le
   * système) est celui du back-office ; il ne s’applique pas ici. Seule
   * exception, assumée : un compte portail `client` ne se crée ni ne s’invite
   * depuis la console — c’est la fiche client qui sait le faire.
   */
  accounts: router({
    create: systemProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          name: z.string().trim().min(2).max(180).optional(),
          password: z.string().min(8).max(128),
          // `APP_ROLES` plutôt que `STAFF_ASSIGNABLE_ROLES` : le schéma accepte
          // `client` et le module le refuse avec un message EN FRANÇAIS qui dit
          // pourquoi. C’est exactement le choix de `users.create` — un refus
          // d’énumération rendu par tRPC serait un message technique anglais, là
          // où l’administrateur a besoin d’une raison.
          role: z.enum(APP_ROLES),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        createConsoleAccount({
          actor: consoleActor(ctx),
          email: input.email,
          name: input.name ?? null,
          password: input.password,
          role: input.role,
        }),
      ),

    rename: systemProcedure
      .input(z.object({ userId: z.number().int().positive(), name: z.string().trim().max(180) }))
      .mutation(async ({ ctx, input }) =>
        renameConsoleAccount({ actor: consoleActor(ctx), userId: input.userId, name: input.name }),
      ),

    setRole: systemProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(STAFF_ASSIGNABLE_ROLES) }))
      .mutation(async ({ ctx, input }) =>
        setConsoleAccountRole({ actor: consoleActor(ctx), userId: input.userId, role: input.role }),
      ),

    /**
     * Réinitialise un mot de passe et rend le mot de passe temporaire UNE FOIS.
     * Il n’est ni journalisé, ni relisible : si l’administrateur le perd avant
     * de l’avoir transmis, il doit en tirer un autre.
     */
    resetPassword: systemProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => resetConsoleAccountPassword({ actor: consoleActor(ctx), userId: input.userId })),

    remove: systemProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => removeConsoleAccount({ actor: consoleActor(ctx), userId: input.userId })),
  }),

  invitations: router({
    /**
     * Invitations en attente, avec leur identifiant — c’est ce qui rend le
     * renvoi et la révocation possibles depuis la console. Ni jeton, ni
     * empreinte : la projection vient de `db.listPendingInvitations()`.
     *
     * Lecture : elle ne journalise rien (le journal des écritures ne recense que
     * les actes).
     */
    list: systemProcedure.query(() => listConsoleInvitations()),

    issue: systemProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          // Même choix que pour `create` : le schéma accepte `client`, le module
          // le refuse en français, avec la raison.
          role: z.enum(APP_ROLES),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        issueConsoleInvitation({ actor: consoleActor(ctx), email: input.email, role: input.role, req: ctx.req }),
      ),

    resend: systemProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => resendConsoleInvitation({ actor: consoleActor(ctx), id: input.id, req: ctx.req })),

    revoke: systemProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => revokeConsoleInvitation({ actor: consoleActor(ctx), id: input.id })),
  }),

  /**
   * Sessions révocables (Phase 3 « Protéger », étape B1 — module 4).
   *
   * `list` : les sessions de l’instance, avec l’identité du compte, les dates,
   * l’agent, l’IP et l’état. Ni jeton, ni empreinte (voir `server/systemSessions.ts`).
   * `revoke` : ferme UNE session. Le garde-fou interdit de fermer la sienne.
   *
   * L’empreinte de la session courante est calculée ici, à partir du cookie de la
   * requête, et n’est jamais renvoyée. Elle sert à deux choses : marquer la ligne
   * « session courante » dans la liste (comparaison faite par la base) et refuser
   * l’auto-révocation.
   */
  sessions: router({
    list: systemProcedure.query(async ({ ctx }) => {
      const token = readRequestSessionToken(ctx.req);
      return collectSystemSessions({
        tenantId: ctx.tenantId ?? undefined,
        currentTokenHash: token ? hashSessionToken(token) : null,
      });
    }),

    revoke: systemProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const token = readRequestSessionToken(ctx.req);
        const result = await revokeSessionById({
          id: input.id,
          tenantId: ctx.tenantId ?? undefined,
          actingTokenHash: token ? hashSessionToken(token) : null,
        });

        if (result.outcome === "not_found") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cette session n’existe pas sur cette instance. La liste a peut-être changé — actualisez-la.",
          });
        }

        if (result.outcome === "self") {
          // GARDE-FOU : l’administrateur ne doit pas pouvoir se couper l’accès par
          // erreur. Révoquer la session qui porte cette requête rendrait l’écran
          // inutilisable et l’annulation impossible. Pour fermer sa propre session,
          // le bon geste est « Déconnexion » : il est explicite et réversible.
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Vous ne pouvez pas révoquer la session qui vous authentifie : vous perdriez l’accès à la console sans pouvoir revenir en arrière. Utilisez « Déconnexion » pour fermer votre propre session.",
          });
        }

        if (result.outcome === "unavailable") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "La révocation n’a pas pu être enregistrée : la base de données n’a pas répondu. Aucune session n’a été modifiée.",
          });
        }

        // JOURNALISATION — une ligne structurée, écrite à chaque révocation
        // effectivement enregistrée. Le module 9 (« Journal technique ») n’est pas
        // livré et cette étape n’a pas le droit de créer de schéma : le journal
        // serveur de l’hébergeur est donc la seule trace persistante possible
        // aujourd’hui. Acteur, cible et tenant y figurent — jamais un jeton.
        console.info(
          `[console] session révoquée — acteur=${ctx.user?.email ?? ctx.user?.openId ?? "inconnu"}(id ${ctx.user?.id ?? "?"})` +
            ` tenant=${ctx.tenantId ?? "?"} session=${result.id} compte=${result.userId}`,
        );

        return {
          success: true as const,
          id: result.id,
          userId: result.userId,
          // Révocation idempotente : révoquer une session déjà fermée n’est pas
          // une erreur, mais l’interface le dit plutôt que de le taire.
          alreadyRevoked: result.outcome === "already_revoked",
          revokedAt: result.outcome === "revoked" ? result.revokedAt : null,
        };
      }),
  }),

  llmModels: adminProcedure.query(async () => {
    try {
      const models = await listLLMModels();
      const picked = await pickLLMModel(models);
      return {
        ok: true as const,
        count: models.data.length,
        ids: models.data.map(m => m.id),
        picked,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
