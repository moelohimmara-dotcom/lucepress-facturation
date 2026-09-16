import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { pingDatabase } from "../db";
import { hashSessionToken } from "../sessionRegistry";
import { collectSystemAccess } from "../systemAccess";
import { collectSystemMetrics } from "../systemMetrics";
import { collectSystemSessions, revokeSessionById } from "../systemSessions";
import { readRequestSessionToken } from "./context";
import { buildHealthPayload } from "./health";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router, systemProcedure } from "./trpc";
import { listLLMModels, pickLLMModel } from "./llm";

/** Identité applicative affichée par la console d’exploitation. */
const APPLICATION_NAME = "Lucepress Facturation";
/** Renseignée par l’hébergeur au déploiement ; `null` si inconnue (jamais inventée). */
const APPLICATION_VERSION = process.env.APP_VERSION?.trim() || null;

export const systemRouter = router({
  // Sans input obligatoire : le moniteur VPS / curl GET doit pouvoir
  // appeler /api/trpc/system.health sans payload.
  health: publicProcedure.query(async () => {
    const dbOk = await pingDatabase();
    return buildHealthPayload({ dbOk });
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
