import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DOCUMENT_STATUSES, type EditableDocumentLine } from "../shared/billing";
import { validateCompanyFinancialDetails } from "../shared/companySettingsValidation";
import { SERVICE_CATEGORIES } from "../shared/defaultServices";
import { validateQuotePaymentSchedule } from "../shared/paymentSchedule";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";

const optionalText = z.string().trim().max(2000).optional();
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const quotePaymentScheduleSchema = z.object({
  depositPercent: z.number().int().min(1).max(99).optional(),
  depositDueDate: dateText.optional(),
  balanceDueDate: dateText.optional(),
}).superRefine((input, context) => {
  const errors = validateQuotePaymentSchedule(input);
  for (const [field, message] of Object.entries(errors)) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
});
const documentLineSchema = z.object({
  description: z.string().trim().min(2).max(1000),
  quantity: z.number().positive().max(999999),
  unit: z.string().trim().min(1).max(30),
  unitPrice: z.number().int().min(0).max(9_000_000_000),
  taxRate: z.number().int().min(0).max(100),
  serviceId: z.number().int().positive().optional(),
});

const clientInputSchema = z.object({
  companyName: z.string().trim().min(2).max(180),
  contactName: optionalText,
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(64).optional(),
  address: optionalText,
  taxId: z.string().trim().max(100).optional(),
  notes: optionalText,
});

const companySettingsInputSchema = z.object({
  legalName: z.string().trim().min(2).max(180),
  legalAddress: optionalText,
  phone: z.string().trim().max(64).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().trim().max(255).optional(),
  taxId: z.string().trim().max(100).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  bankName: z.string().trim().max(180).optional(),
  accountName: z.string().trim().max(180).optional(),
  accountNumber: z.string().trim().max(120).optional(),
  iban: z.string().trim().max(120).optional(),
  swift: z.string().trim().max(32).optional(),
  paymentInstructions: optionalText,
  documentFooter: optionalText,
}).superRefine((input, context) => {
  const errors = validateCompanyFinancialDetails(input);
  for (const [field, message] of Object.entries(errors)) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
});

const extractedClientSchema = z.object({
  companyName: z.string().trim().min(2).max(180),
  contactName: z.string().trim().max(180),
  email: z.string().trim().max(320),
  phone: z.string().trim().max(64),
  address: z.string().trim().max(2000),
  taxId: z.string().trim().max(100),
  notes: z.string().trim().max(2000),
  missingFields: z.array(z.string().trim().max(100)).max(8),
});

const clientExtractionResponseSchema = {
  name: "lucepress_client_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      companyName: { type: "string" },
      contactName: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      address: { type: "string" },
      taxId: { type: "string" },
      notes: { type: "string" },
      missingFields: { type: "array", items: { type: "string" } },
    },
    required: ["companyName", "contactName", "email", "phone", "address", "taxId", "notes", "missingFields"],
    additionalProperties: false,
  },
} as const;

const reminderResponseSchema = {
  name: "lucepress_overdue_reminder",
  strict: true,
  schema: {
    type: "object",
    properties: {
      subject: { type: "string" },
      greeting: { type: "string" },
      body: { type: "string" },
      closing: { type: "string" },
      tone: { type: "string" },
    },
    required: ["subject", "greeting", "body", "closing", "tone"],
    additionalProperties: false,
  },
} as const;

const clientHistorySummarySchema = {
  name: "lucepress_client_history_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      attentionPoints: { type: "array", items: { type: "string" } },
      nextSteps: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "attentionPoints", "nextSteps"],
    additionalProperties: false,
  },
} as const;

const proposalSchema = {
  name: "lucepress_quote_proposal",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      projectName: { type: "string" },
      summary: { type: "string" },
      scope: { type: "array", items: { type: "string" } },
      executionTimeline: { type: "string" },
      paymentTerms: { type: "string" },
      validityDays: { type: "integer" },
      technicalNotes: { type: "array", items: { type: "string" } },
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
    required: ["title", "projectName", "summary", "scope", "executionTimeline", "paymentTerms", "validityDays", "technicalNotes", "assumptions", "lines"],
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
      duplicates: adminProcedure.input(z.object({ companyName: z.string().trim().min(2).max(180), email: z.string().email().optional().or(z.literal("")), phone: z.string().trim().max(64).optional(), excludedId: z.number().int().positive().optional() })).query(({ input }) => db.findClientDuplicates(input, input.excludedId)),
      create: adminProcedure
        .input(clientInputSchema)
        .mutation(({ input }) => db.createClient(input)),
      update: adminProcedure
        .input(clientInputSchema.extend({ id: z.number().int().positive() }))
        .mutation(({ input }) => db.updateClient(input.id, input)),
      attachments: router({
        list: adminProcedure.input(z.object({ clientId: z.number().int().positive() })).query(({ input }) => db.listClientAttachments(input.clientId)),
      }),
      activities: router({
        list: adminProcedure.input(z.object({ clientId: z.number().int().positive() })).query(({ input }) => db.listClientActivities(input.clientId)),
        createNote: adminProcedure.input(z.object({ clientId: z.number().int().positive(), title: z.string().trim().min(2).max(255).default("Note d’appel"), description: z.string().trim().min(3).max(2000) })).mutation(({ ctx, input }) => db.createClientActivity({ ...input, type: "note", createdById: ctx.user.id })),
      }),
    }),
    settings: router({
      get: adminProcedure.query(() => db.getCompanySettings()),
      save: adminProcedure.input(companySettingsInputSchema).mutation(({ input }) => db.saveCompanySettings(input)),
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
        .input(z.object({ code: z.string().trim().min(2).max(50), name: z.string().trim().min(2).max(180), category: z.enum(SERVICE_CATEGORIES), description: optionalText, unit: z.string().trim().min(1).max(30), defaultUnitPrice: z.number().int().min(0).max(9_000_000_000), defaultTaxRate: z.number().int().min(0).max(100) }))
        .mutation(({ input }) => db.createService(input)),
      updateTariff: adminProcedure
        .input(z.object({ id: z.number().int().positive(), defaultUnitPrice: z.number().int().min(0).max(9_000_000_000), defaultTaxRate: z.number().int().min(0).max(100) }))
        .mutation(({ input }) => db.updateServiceTariff(input)),
    }),
    documents: router({
      list: adminProcedure.input(z.object({ kind: z.enum(["devis", "facture"]).optional() }).optional()).query(({ input }) => db.listDocuments(input?.kind)),
      get: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getDocumentById(input.id)),
      create: adminProcedure
        .input(z.object({ kind: z.enum(["devis", "facture"]), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), relatedDocumentId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES).optional(), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, isAiDraft: z.boolean().optional(), lines: z.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema))
        .mutation(({ ctx, input }) => db.createDocument({ ...input, createdById: ctx.user.id, lines: input.lines as EditableDocumentLine[] })),
      update: adminProcedure
        .input(z.object({ id: z.number().int().positive(), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, lines: z.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema))
        .mutation(({ input }) => db.updateDocument({ ...input, lines: input.lines as EditableDocumentLine[] })),
      updateStatus: adminProcedure
        .input(z.object({ id: z.number().int().positive(), status: z.enum(DOCUMENT_STATUSES) }))
        .mutation(({ input }) => db.updateDocumentStatus(input.id, input.status)),
    }),
    payments: router({
      create: adminProcedure
        .input(z.object({ documentId: z.number().int().positive(), amount: z.number().int().positive().max(9_000_000_000), paidAt: dateText, method: z.enum(["especes", "virement", "cheque", "mobile_money", "autre"]), reference: z.string().trim().max(120).optional(), notes: optionalText }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.recordPayment({ ...input, createdById: ctx.user.id });
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le paiement ne peut pas être enregistré." });
          }
        }),
    }),
    assistant: router({
      summarizeClientHistory: adminProcedure
        .input(z.object({ clientId: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          const client = await db.getClientById(input.clientId);
          if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client introuvable." });
          const history = await db.listClientActivities(input.clientId);
          const models = await listLLMModels();
          const model = models.data.find(entry => entry.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
          if (!model) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Aucun modèle IA n’est actuellement disponible." });
          const result = await invokeLLM({
            model,
            messages: [
              { role: "system", content: "Tu es l’assistant de suivi commercial de Lucepress, entreprise BTP et forage. À partir de l’historique fourni, rédige en français une synthèse brève et factuelle pour préparer le prochain échange avec le client. Ne fabrique aucun fait. Signale les éléments financiers ou commerciaux à vérifier et propose des prochaines étapes pragmatiques. Le résultat est une aide interne à relire, jamais un message envoyé au client." },
              { role: "user", content: JSON.stringify({ client: { nom: client.companyName, contact: client.contactName }, historique: history.slice(0, 50).map(event => ({ date: event.createdAt, type: event.type, titre: event.title, detail: event.description })) }) },
            ],
            response_format: { type: "json_schema", json_schema: clientHistorySummarySchema },
          });
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le résumé IA est indisponible. Réessayez dans un instant." });
          try { return { summary: JSON.parse(content) as { summary: string; attentionPoints: string[]; nextSteps: string[] }, requiresReview: true }; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le résumé IA ne peut pas être lu. Réessayez dans un instant." }); }
        }),
      generateReminder: adminProcedure
        .input(z.object({ documentId: z.number().int().positive(), tone: z.enum(["courtois", "ferme"]).default("courtois") }))
        .mutation(async ({ ctx, input }) => {
          const document = await db.getDocumentById(input.documentId);
          if (!document || document.kind !== "facture" || document.balanceDue <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "La relance doit concerner une facture avec un solde impayé." });
          const models = await listLLMModels();
          const model = models.data.find(entry => entry.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
          if (!model) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Aucun modèle IA n’est actuellement disponible." });
          const result = await invokeLLM({
            model,
            messages: [
              { role: "system", content: "Tu es l’assistant de recouvrement de Lucepress, entreprise guinéenne BTP et forage. Rédige en français un modèle d’e-mail de relance professionnel, factuel et prêt à relire, sans menaces ni affirmation juridique. Mentionne le numéro de facture, le montant du solde en GNF et l’échéance connue. Le résultat est un brouillon : ne prétends jamais que l’e-mail a été envoyé." },
              { role: "user", content: JSON.stringify({ ton: input.tone, facture: document.number, client: document.clientName, contact: document.contactName, email: document.clientEmail, echeance: document.dueDate, soldeGNF: document.balanceDue, dateEmission: document.issueDate }) },
            ],
            response_format: { type: "json_schema", json_schema: reminderResponseSchema },
          });
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le modèle de relance est indisponible. Réessayez dans un instant." });
          try {
            const reminder = JSON.parse(content) as { subject: string; greeting: string; body: string; closing: string; tone: string };
            await db.createClientActivity({ clientId: document.clientId, documentId: document.id, type: "relance_preparee", title: `Relance ${reminder.tone || input.tone} préparée`, description: reminder.subject, createdById: ctx.user.id });
            return { reminder, requiresReview: true };
          } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le modèle de relance ne peut pas être lu. Réessayez dans un instant." }); }
        }),
      extractClient: adminProcedure
        .input(z.object({ text: z.string().trim().min(10).max(6000) }))
        .mutation(async ({ input }) => {
          const models = await listLLMModels();
          const model = models.data.find(entry => entry.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
          if (!model) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Aucun modèle IA n’est actuellement disponible." });
          const result = await invokeLLM({
            model,
            messages: [
              { role: "system", content: "Tu es l’assistant administratif de Lucepress. Extrais uniquement les coordonnées d’un prospect ou client contenues dans le texte fourni. Ne fabrique jamais une donnée absente : utilise une chaîne vide et indique le champ dans missingFields. companyName doit être le nom de l’entreprise ou du client, et si aucun nom exploitable n’est mentionné, utilise 'Client à confirmer' et signale-le. notes doit contenir seulement les précisions utiles au répertoire. La sortie est un brouillon à faire relire avant enregistrement." },
              { role: "user", content: input.text },
            ],
            response_format: { type: "json_schema", json_schema: clientExtractionResponseSchema },
          });
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "L’extraction IA est indisponible. Réessayez dans un instant." });
          try {
            return { client: extractedClientSchema.parse(JSON.parse(content)), requiresReview: true };
          } catch {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Les coordonnées extraites ne peuvent pas être lues. Réessayez dans un instant." });
          }
        }),
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
              { role: "system", content: "Tu es l’assistant commercial de Lucepress, entreprise guinéenne BTP et forage. À partir d’une simple description de chantier, prépare un devis complet, structuré et prêt à relire en français. Déduis le domaine, le périmètre, les étapes, les prestations, les hypothèses, la durée d’exécution, les conditions de paiement et une durée de validité raisonnable. Il s’agit toujours d’un brouillon à faire relire : ne prétends jamais qu’il est validé. Réutilise le catalogue fourni quand il correspond. Si un prix fiable n’est pas présent dans le catalogue, utilise 0 comme prix unitaire et mentionne explicitement la vérification requise dans note, technicalNotes et assumptions. Tous les montants sont des entiers en francs guinéens (GNF). Les lignes doivent être exhaustives mais ne dois pas inventer de prix." },
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
