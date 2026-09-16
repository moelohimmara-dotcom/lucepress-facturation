import { z } from "zod";
import { pingDatabase } from "../db";
import { collectSystemAccess } from "../systemAccess";
import { collectSystemMetrics } from "../systemMetrics";
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
