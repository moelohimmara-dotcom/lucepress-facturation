import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DOCUMENT_STATUSES, type EditableDocumentLine } from "../shared/billing";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";

const optionalText = z.string().trim().max(2000).optional();
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const documentLineSchema = z.object({
  description: z.string().trim().min(2).max(1000),
  quantity: z.number().positive().max(999999),
  unit: z.string().trim().min(1).max(30),
  unitPrice: z.number().int().min(0).max(9_000_000_000),
  taxRate: z.number().int().min(0).max(100),
  serviceId: z.number().int().positive().optional(),
});

const proposalSchema = {
  name: "lucepress_quote_proposal",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            unitPrice: { type: "integer" },
            taxRate: { type: "integer" },
            note: { type: "string" },
          },
          required: ["description", "quantity", "unit", "unitPrice", "taxRate", "note"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "summary", "assumptions", "lines"],
    additionalProperties: false,
  },
} as const;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  billing: router({
    dashboard: adminProcedure.query(() => db.getDashboardData()),
    clients: router({
      list: adminProcedure.query(() => db.listClients()),
      create: adminProcedure
        .input(z.object({ companyName: z.string().trim().min(2).max(180), contactName: optionalText, email: z.string().email().optional().or(z.literal("")), phone: z.string().trim().max(64).optional(), address: optionalText, taxId: z.string().trim().max(100).optional(), notes: optionalText }))
        .mutation(({ input }) => db.createClient(input)),
    }),
    projects: router({
      list: adminProcedure.query(() => db.listProjects()),
      create: adminProcedure
        .input(z.object({ clientId: z.number().int().positive(), name: z.string().trim().min(2).max(180), reference: z.string().trim().max(80).optional(), type: z.enum(["btp", "forage", "mixte"]), location: z.string().trim().max(255).optional(), description: optionalText }))
        .mutation(({ input }) => db.createProject(input)),
    }),
    services: router({
      list: adminProcedure.query(() => db.listServices()),
      create: adminProcedure
        .input(z.object({ code: z.string().trim().min(2).max(50), name: z.string().trim().min(2).max(180), category: z.enum(["btp", "forage", "etude", "transport", "autre"]), description: optionalText, unit: z.string().trim().min(1).max(30), defaultUnitPrice: z.number().int().min(0).max(9_000_000_000), defaultTaxRate: z.number().int().min(0).max(100) }))
        .mutation(({ input }) => db.createService(input)),
    }),
    documents: router({
      list: adminProcedure.input(z.object({ kind: z.enum(["devis", "facture"]).optional() }).optional()).query(({ input }) => db.listDocuments(input?.kind)),
      get: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getDocumentById(input.id)),
      create: adminProcedure
        .input(z.object({ kind: z.enum(["devis", "facture"]), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), relatedDocumentId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES).optional(), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, isAiDraft: z.boolean().optional(), lines: z.array(documentLineSchema).min(1).max(100) }))
        .mutation(({ ctx, input }) => db.createDocument({ ...input, createdById: ctx.user.id, lines: input.lines as EditableDocumentLine[] })),
      update: adminProcedure
        .input(z.object({ id: z.number().int().positive(), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, lines: z.array(documentLineSchema).min(1).max(100) }))
        .mutation(({ input }) => db.updateDocument({ ...input, lines: input.lines as EditableDocumentLine[] })),
      updateStatus: adminProcedure
        .input(z.object({ id: z.number().int().positive(), status: z.enum(DOCUMENT_STATUSES) }))
        .mutation(({ input }) => db.updateDocumentStatus(input.id, input.status)),
    }),
    assistant: router({
      proposeQuote: adminProcedure
        .input(z.object({ description: z.string().trim().min(20).max(6000), projectType: z.enum(["btp", "forage", "mixte"]).optional(), taxRate: z.number().int().min(0).max(100).default(0) }))
        .mutation(async ({ input }) => {
          const catalog = await db.listServices();
          const models = await listLLMModels();
          const model = models.data.find(entry => entry.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
          if (!model) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Aucun modèle IA n’est actuellement disponible." });
          const serviceContext = catalog.map(service => ({ code: service.code, name: service.name, unit: service.unit, unitPrice: service.defaultUnitPrice, taxRate: service.defaultTaxRate })).slice(0, 80);
          const result = await invokeLLM({
            model,
            messages: [
              { role: "system", content: "Tu es l’assistant commercial de Lucepress, entreprise guinéenne BTP et forage. Prépare une proposition de devis en français, claire et prudente. Il s’agit toujours d’un brouillon à faire relire : ne prétends jamais qu’il est validé. Réutilise le catalogue fourni quand il correspond. Si un prix fiable n’est pas présent dans le catalogue, utilise 0 comme prix unitaire et mentionne explicitement la vérification requise dans note et assumptions. Tous les montants sont des entiers en francs guinéens (GNF)." },
              { role: "user", content: JSON.stringify({ besoin: input.description, domaine: input.projectType ?? "non précisé", tauxTaxeParDefaut: input.taxRate, cataloguePrestations: serviceContext }) },
            ],
            response_format: { type: "json_schema", json_schema: proposalSchema },
          });
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La proposition IA est indisponible. Réessayez dans un instant." });
          try {
            return { proposal: JSON.parse(content), requiresReview: true };
          } catch {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La proposition IA ne peut pas être lue. Réessayez dans un instant." });
          }
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
