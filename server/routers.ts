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
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { createHeartbeatJob } from "./_core/heartbeat";
import { buildCampaignSchedule } from "../shared/agentCampaignSchedule";
import { BATCH_REMINDER_LIMIT, normalizeBatchReminderDocumentIds, normalizeBatchReminderInstruction } from "../shared/batchReminders";

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
const quoteDiscountSchema = z.object({ discountPercent: z.number().int().min(0).max(99).optional() });
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
  defaultDiscountPercent: z.number().int().min(0).max(99).optional(),
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

const batchReminderResponseSchema = {
  name: "lucepress_batch_overdue_reminders",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reminders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            subject: { type: "string" },
            greeting: { type: "string" },
            body: { type: "string" },
            closing: { type: "string" },
            tone: { type: "string" },
          },
          required: ["documentId", "subject", "greeting", "body", "closing", "tone"],
          additionalProperties: false,
        },
      },
    },
    required: ["reminders"],
    additionalProperties: false,
  },
} as const;

const agentCopilotResponseSchema = {
  name: "lucepress_margin_collection_copilot",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      marginAlerts: { type: "array", items: { type: "string" } },
      collectionPriorities: { type: "array", items: { type: "string" } },
      suggestedActions: { type: "array", items: { type: "string" } },
      dataToVerify: { type: "array", items: { type: "string" } },
      sourceReferences: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "marginAlerts", "collectionPriorities", "suggestedActions", "dataToVerify", "sourceReferences"],
    additionalProperties: false,
  },
} as const;

const agentOperatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const access = await db.getAgentOperatorAccess(ctx.user.id, ctx.user.role);
  if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "Votre compte ne possède pas d’habilitation active pour administrer l’agent." });
  return next({ ctx: { ...ctx, agentAccess: access } });
});

function requireAgentApproval(access: { canApprove: boolean }) {
  if (!access.canApprove) throw new TRPCError({ code: "FORBIDDEN", message: "Votre habilitation ne permet pas d’approuver cette action de l’agent." });
}

function requireAgentActivation(access: { canActivate: boolean }) {
  if (!access.canActivate) throw new TRPCError({ code: "FORBIDDEN", message: "Votre habilitation ne permet pas d’activer cette simulation." });
}

function agentMutationError(error: unknown, fallback: string) {
  return new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : fallback });
}

function readSessionToken(cookieHeader: string | undefined) {
  return parseCookieHeader(cookieHeader ?? "")[COOKIE_NAME] ?? "";
}

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
      updatePlannedBudget: adminProcedure.input(z.object({ id: z.number().int().positive(), plannedBudget: z.number().int().min(0).max(9_000_000_000) })).mutation(({ input }) => db.updateProjectPlannedBudget(input)),
      updateFinancialTargets: adminProcedure.input(z.object({ id: z.number().int().positive(), plannedBudget: z.number().int().min(0).max(9_000_000_000), minimumMarginRate: z.number().int().min(0).max(100).nullable() })).mutation(({ input }) => db.updateProjectFinancialTargets(input)),
      costs: router({
        list: adminProcedure.input(z.object({ projectId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.listProjectCosts(input?.projectId)),
        create: adminProcedure.input(z.object({ projectId: z.number().int().positive(), category: z.enum(["materiaux", "main_oeuvre", "transport", "equipement", "sous_traitance", "autre"]), description: z.string().trim().min(3).max(500), amount: z.number().int().positive().max(9_000_000_000), incurredAt: dateText })).mutation(({ ctx, input }) => db.createProjectCost({ ...input, createdById: ctx.user.id })),
        delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.deleteProjectCost(input.id)),
        attachments: router({
          list: adminProcedure.input(z.object({ projectCostId: z.number().int().positive() })).query(({ input }) => db.listProjectCostAttachments(input.projectCostId)),
          delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.deleteProjectCostAttachment(input.id)),
        }),
        profitability: adminProcedure.query(() => db.listProjectProfitability()),
      }),
    }),
    receivables: adminProcedure.query(() => db.getReceivablesDashboard()),
    collection: router({
      assignees: adminProcedure.query(() => db.listCollectionAssignees()),
      updateFollowUp: adminProcedure
        .input(z.object({ documentId: z.number().int().positive(), collectionStatus: z.enum(["a_traiter", "contacte", "a_rappeler"]).optional(), collectionReminderDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/, "La date de rappel doit respecter le format AAAA-MM-JJ.").nullable().optional(), collectionOwnerId: z.number().int().positive().nullable().optional() }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.updateCollectionFollowUp({ ...input, updatedById: ctx.user.id }); }
          catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le suivi de recouvrement ne peut pas être mis à jour." }); }
        }),
      monthlyReport: adminProcedure
        .input(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Le mois doit respecter le format AAAA-MM.") }))
        .query(async ({ input }) => {
          try { return await db.getCollectionMonthlyReport(input.month); }
          catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le rapport mensuel est indisponible." }); }
        }),
    }),
    clientPortal: router({
      overview: protectedProcedure.query(({ ctx }) => db.getClientPortalOverview(ctx.user.email)),
      invoice: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getClientPortalInvoice(ctx.user.email, input.id)),
      createPaymentPromise: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), promisedDate: dateText, note: z.string().trim().max(500).optional() })).mutation(({ ctx, input }) => db.createClientPaymentPromise({ ...input, email: ctx.user.email, createdById: ctx.user.id })),
    }),
    agent: router({
      center: agentOperatorProcedure.query(() => db.listAgentDelegationCenter()),
      operators: adminProcedure.query(() => db.listAgentOperators()),
      upsertOperatorGrant: adminProcedure
        .input(z.object({ userId: z.number().int().positive(), role: z.enum(["directeur_general", "responsable_commercial"]), canApprove: z.boolean().default(true), canActivate: z.boolean().default(false), scope: z.enum(["global", "commercial"]).default("commercial"), status: z.enum(["active", "suspendue", "revoquee"]).default("active"), expiresAt: z.coerce.date().nullable().optional() }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.upsertAgentOperatorGrant({ ...input, grantedById: ctx.user.id }); }
          catch (error) { throw agentMutationError(error, "L’habilitation de l’opérateur ne peut pas être enregistrée."); }
        }),
      createDelegation: agentOperatorProcedure
        .input(z.object({ name: z.string().trim().min(3).max(180), purpose: z.enum(["relance_facture", "suivi_devis"]), channel: z.enum(["email", "whatsapp"]), tone: z.enum(["courtois", "professionnel", "ferme", "commercial"]).default("professionnel"), startsAt: z.coerce.date(), expiresAt: z.coerce.date(), dailyLimit: z.number().int().min(1).max(60).default(60), contactCooldownDays: z.number().int().min(1).max(30).default(7) }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.createAgentDelegation({ ...input, ownerId: ctx.user.id }); }
          catch (error) { throw agentMutationError(error, "La délégation de l’agent ne peut pas être créée."); }
        }),
      submitDelegation: agentOperatorProcedure
        .input(z.object({ delegationId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          requireAgentApproval(ctx.agentAccess);
          try { return await db.submitAgentDelegationForApproval(input.delegationId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "La délégation ne peut pas être soumise à approbation."); }
        }),
      approveDelegation: agentOperatorProcedure
        .input(z.object({ delegationId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          requireAgentApproval(ctx.agentAccess);
          try { return await db.approveAgentDelegation(input.delegationId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "La délégation ne peut pas être approuvée."); }
        }),
      suspendDelegation: agentOperatorProcedure
        .input(z.object({ delegationId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.suspendAgentDelegation(input.delegationId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "La délégation ne peut pas être suspendue."); }
        }),
      simulateCampaign: agentOperatorProcedure
        .input(z.object({ delegationId: z.number().int().positive(), name: z.string().trim().min(3).max(180), scheduledFor: z.coerce.date().nullable().optional() }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.createAgentCampaignSimulation({ ...input, preparedById: ctx.user.id }); }
          catch (error) { throw agentMutationError(error, "La campagne ne peut pas être simulée."); }
        }),
      submitCampaign: agentOperatorProcedure
        .input(z.object({ campaignId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          requireAgentApproval(ctx.agentAccess);
          try { return await db.submitAgentCampaignForApproval(input.campaignId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "La campagne ne peut pas être soumise à approbation."); }
        }),
      approveCampaign: agentOperatorProcedure
        .input(z.object({ campaignId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          requireAgentApproval(ctx.agentAccess);
          try { return await db.approveAgentCampaign(input.campaignId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "La campagne ne peut pas être approuvée."); }
        }),
      activateCampaignSimulation: agentOperatorProcedure
        .input(z.object({ campaignId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          requireAgentActivation(ctx.agentAccess);
          try { return await db.activateAgentCampaignSimulation(input.campaignId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "La campagne simulée ne peut pas être activée."); }
        }),
      suspendCampaign: agentOperatorProcedure
        .input(z.object({ campaignId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.suspendAgentCampaign(input.campaignId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "La campagne ne peut pas être suspendue."); }
        }),
      scheduleCampaign: agentOperatorProcedure
        .input(z.object({ campaignId: z.number().int().positive(), frequency: z.enum(["daily", "weekly"]), time: z.string().regex(/^\d{2}:\d{2}$/), weekday: z.number().int().min(0).max(6).optional() }))
        .mutation(async ({ ctx, input }) => {
          requireAgentActivation(ctx.agentAccess);
          try {
            if (process.env.NODE_ENV !== "production") throw new Error("La programmation durable sera disponible après la publication de cette version.");
            await db.assertAgentCampaignCanBeScheduled(input.campaignId);
            const schedule = buildCampaignSchedule(input);
            const job = await createHeartbeatJob({ name: `agent-test-email-${input.campaignId}`, cron: schedule.cron, path: "/api/scheduled/agent-test-email", payload: { campaignId: input.campaignId }, description: `Simulation e-mail Lucepress : campagne ${input.campaignId}` }, readSessionToken(ctx.req.headers.cookie));
            return await db.setAgentCampaignSchedule({ campaignId: input.campaignId, scheduleCronTaskUid: job.taskUid, scheduleCronExpression: schedule.cron, nextExecutionAt: job.nextExecutionAt ? new Date(job.nextExecutionAt) : null, actorId: ctx.user.id });
          } catch (error) { throw agentMutationError(error, "La programmation de la campagne ne peut pas être enregistrée."); }
        }),
      runTestEmailNow: agentOperatorProcedure
        .input(z.object({ campaignId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          requireAgentActivation(ctx.agentAccess);
          try { return await db.deliverAgentCampaignToTestInboxNow(input.campaignId, ctx.user.id); }
          catch (error) { throw agentMutationError(error, "Le test e-mail interne ne peut pas être exécuté."); }
        }),
      copilotBriefing: agentOperatorProcedure
        .mutation(async () => {
          const context = await db.getAgentCopilotContext();
          const models = await listLLMModels();
          const model = models.data.find(entry => entry.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
          if (!model) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Aucun modèle IA n’est actuellement disponible." });
          const result = await invokeLLM({
            model,
            messages: [
              { role: "system", content: "Tu es le Copilote de marge et recouvrement de Lucepress, entreprise guinéenne de BTP, forage et services durables. Analyse seulement les faits du contexte JSON fourni. Rédige en français une aide interne claire, brève et structurée. Ne fabrique aucun montant, client, échéance, statut, promesse, règle ou action réalisée. Les chiffres restent des références à vérifier dans l’application. Priorise les promesses échues, les retards, puis les marges réalisées sous seuil. Propose uniquement des contrôles ou des brouillons de relance à faire approuver. Ne prétends jamais qu’un message a été envoyé, qu’un paiement a été reçu ou qu’une modification a été appliquée. Signale explicitement les données insuffisantes." },
              { role: "user", content: JSON.stringify(context) },
            ],
            response_format: { type: "json_schema", json_schema: agentCopilotResponseSchema },
          });
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le briefing IA est indisponible. Réessayez dans un instant." });
          try { return { briefing: JSON.parse(content) as { summary: string; marginAlerts: string[]; collectionPriorities: string[]; suggestedActions: string[]; dataToVerify: string[]; sourceReferences: string[] }, requiresReview: true, model }; }
          catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le briefing IA ne peut pas être lu. Réessayez dans un instant." }); }
        }),
    }),
    integrations: router({
      list: adminProcedure.query(() => db.listIntegrations()),
      audit: adminProcedure.query(() => db.listIntegrationAuditLogs()),
      runtimeReadiness: adminProcedure.query(() => db.getIntegrationRuntimeReadiness()),
      operationsDashboard: adminProcedure.query(() => db.getIntegrationOperationsDashboard()),
      googleOauthSessions: adminProcedure.query(() => db.listGoogleWorkspaceOauthSessions()),
      prepareConnection: adminProcedure
        .input(z.object({ providerSlug: z.string().trim().min(2).max(80) }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.prepareIntegrationConnection(input.providerSlug, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La préparation de la connexion est impossible." });
          }
        }),
      startGoogleOauth: adminProcedure
        .input(z.object({ clientId: z.string().trim().min(10).max(255), redirectUri: z.string().url().max(512), scopes: z.array(z.string().trim().max(200)).min(1).max(3) }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.startGoogleWorkspaceOAuth({ ...input, userId: ctx.user.id });
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le parcours OAuth Google ne peut pas démarrer." });
          }
        }),
      pendingApprovals: adminProcedure.query(() => db.listPendingIntegrationApprovals()),
      decideApproval: adminProcedure
        .input(z.object({ jobId: z.number().int().positive(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.decideIntegrationApproval({ ...input, userId: ctx.user.id });
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La décision d’approbation est impossible." });
          }
        }),
      disableConnection: adminProcedure
        .input(z.object({ connectionId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.disableIntegrationConnection(input.connectionId, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La désactivation de la connexion est impossible." });
          }
        }),
    }),
    services: router({
      list: adminProcedure.query(() => db.listServices()),
      create: adminProcedure
        .input(z.object({ code: z.string().trim().min(2).max(50), name: z.string().trim().min(2).max(180), category: z.enum(SERVICE_CATEGORIES), description: optionalText, unit: z.string().trim().min(1).max(30), defaultUnitPrice: z.number().int().min(0).max(9_000_000_000), defaultTaxRate: z.number().int().min(0).max(100) }))
        .mutation(({ input }) => db.createService(input)),
      updateTariff: adminProcedure
        .input(z.object({ id: z.number().int().positive(), defaultUnitPrice: z.number().int().min(0).max(9_000_000_000), defaultTaxRate: z.number().int().min(0).max(100) }))
        .mutation(({ ctx, input }) => db.updateServiceTariff({ ...input, changedById: ctx.user.id })),
      priceHistory: adminProcedure
        .input(z.object({ serviceId: z.number().int().positive() }))
        .query(({ input }) => db.listServicePriceRevisions(input.serviceId)),
      priceHistoryExport: adminProcedure
        .query(() => db.listAllServicePriceRevisions()),
    }),
    documents: router({
      list: adminProcedure.input(z.object({ kind: z.enum(["devis", "facture"]).optional() }).optional()).query(({ input }) => db.listDocuments(input?.kind)),
      get: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getDocumentById(input.id)),
      create: adminProcedure
        .input(z.object({ kind: z.enum(["devis", "facture"]), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), relatedDocumentId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES).optional(), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, isAiDraft: z.boolean().optional(), lines: z.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema).and(quoteDiscountSchema))
        .mutation(({ ctx, input }) => db.createDocument({ ...input, createdById: ctx.user.id, lines: input.lines as EditableDocumentLine[] })),
      update: adminProcedure
        .input(z.object({ id: z.number().int().positive(), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, lines: z.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema).and(quoteDiscountSchema))
        .mutation(({ input }) => db.updateDocument({ ...input, lines: input.lines as EditableDocumentLine[] })),
      updateStatus: adminProcedure
        .input(z.object({ id: z.number().int().positive(), status: z.enum(DOCUMENT_STATUSES) }))
        .mutation(({ input }) => db.updateDocumentStatus(input.id, input.status)),
      createDepositInvoice: adminProcedure
        .input(z.object({ quoteId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.createDepositInvoiceFromQuote(input.quoteId, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture d’acompte ne peut pas être générée." });
          }
        }),
      createBalanceInvoice: adminProcedure
        .input(z.object({ depositInvoiceId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.createBalanceInvoiceFromDeposit(input.depositInvoiceId, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture de solde ne peut pas être générée." });
          }
        }),
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
      prepareBatchReminders: adminProcedure
        .input(z.object({ documentIds: z.array(z.number().int().positive()).min(1).max(BATCH_REMINDER_LIMIT), tone: z.enum(["courtois", "ferme"]).default("courtois"), instruction: z.string().trim().max(500).optional() }))
        .mutation(async ({ ctx, input }) => {
          let documentIds: number[];
          try { documentIds = normalizeBatchReminderDocumentIds(input.documentIds); }
          catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La sélection de relance est invalide." }); }
          const instruction = normalizeBatchReminderInstruction(input.instruction);
          const documents = await Promise.all(documentIds.map(documentId => db.getDocumentById(documentId)));
          if (documents.some(document => !document || document.kind !== "facture" || document.balanceDue <= 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Chaque relance doit concerner une facture avec un solde impayé." });
          const invoices = documents as Array<NonNullable<typeof documents[number]>>;
          const models = await listLLMModels();
          const model = models.data.find(entry => entry.id === "gpt-5-mini")?.id ?? models.data[0]?.id;
          if (!model) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Aucun modèle IA n’est actuellement disponible." });
          const result = await invokeLLM({
            model,
            messages: [
              { role: "system", content: "Tu es l’assistant de recouvrement de Lucepress, entreprise guinéenne BTP et forage. Prépare un brouillon d’e-mail distinct et personnalisé pour chaque facture fournie. Chaque texte doit être professionnel, factuel, sans menace ni affirmation juridique, et mentionner exactement le numéro de facture, le solde en GNF et l’échéance connue. Respecte l’instruction interne facultative seulement si elle est compatible avec ces faits. Ces contenus sont des brouillons internes : ne prétends jamais qu’un e-mail a été envoyé ou programmé. Retourne strictement une entrée par documentId fourni, sans en ajouter ni en omettre." },
              { role: "user", content: JSON.stringify({ ton: input.tone, instructionInterne: instruction ?? null, factures: invoices.map(invoice => ({ documentId: invoice.id, facture: invoice.number, client: invoice.clientName, contact: invoice.contactName, echeance: invoice.dueDate, soldeGNF: invoice.balanceDue, dateEmission: invoice.issueDate })) }) },
            ],
            response_format: { type: "json_schema", json_schema: batchReminderResponseSchema },
          });
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Les modèles de relance sont indisponibles. Réessayez dans un instant." });
          try {
            const parsed = JSON.parse(content) as { reminders: Array<{ documentId: number; subject: string; greeting: string; body: string; closing: string; tone: string }> };
            const remindersByDocumentId = new Map(parsed.reminders.map(reminder => [reminder.documentId, reminder]));
            if (parsed.reminders.length !== documentIds.length || documentIds.some(documentId => !remindersByDocumentId.has(documentId))) throw new Error("Le modèle n’a pas préparé tous les brouillons demandés.");
            const reminders = documentIds.map(documentId => remindersByDocumentId.get(documentId)!);
            if (reminders.some(reminder => !reminder.subject.trim() || !reminder.greeting.trim() || !reminder.body.trim() || !reminder.closing.trim())) throw new Error("Le modèle a retourné un brouillon incomplet.");
            await Promise.all(reminders.map(reminder => {
              const invoice = invoices.find(document => document.id === reminder.documentId)!;
              return db.createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "relance_preparee", title: `Relance groupée ${reminder.tone || input.tone} préparée`, description: reminder.subject, createdById: ctx.user.id });
            }));
            return { reminders, requiresReview: true, delivery: "brouillons_uniquement" as const };
          } catch (error) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Les modèles de relance ne peuvent pas être lus. Réessayez dans un instant." }); }
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
