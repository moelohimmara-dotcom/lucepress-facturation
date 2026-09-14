import { z } from "zod";
import { pingDatabase } from "../db";
import { buildHealthPayload } from "./health";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { listLLMModels, pickLLMModel } from "./llm";

export const systemRouter = router({
  // Sans input obligatoire : le moniteur VPS / curl GET doit pouvoir
  // appeler /api/trpc/system.health sans payload.
  health: publicProcedure.query(async () => {
    const dbOk = await pingDatabase();
    return buildHealthPayload({ dbOk });
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
