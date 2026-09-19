import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DOCUMENT_STATUSES, type EditableDocumentLine } from "../shared/billing";
import { validateCompanyFinancialDetails } from "../shared/companySettingsValidation";
import { SERVICE_CATEGORIES } from "../shared/defaultServices";
import { validateQuotePaymentSchedule } from "../shared/paymentSchedule";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { getRequestOrigin, issueInvitation } from "./invitationIssue";
import { invokeLLM, invokeLLMWithFallback, listLLMModels, pickLLMModelCandidates } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, directionProcedure, protectedProcedure, publicProcedure, router, staffProcedure, usersProcedure } from "./_core/trpc";
import { sendMail, isMailConfigured, getSmtpUser } from "./_core/mailer";
import { COOKIE_NAME } from "@shared/const";
import { LUCEPRES_PUBLIC_PROFILE } from "../shared/companyProfile";
import { IDENTITY_KINDS, omitOptionalPaperworkMissingFields } from "../shared/identityPaperwork";
import { CLIENT_ACTIVITY_TYPES } from "../shared/clientActivityTypes";
import { APP_ROLES, isClientRole, isSystemRole, STAFF_ASSIGNABLE_ROLES, type AppRole, type PersistedAppRole } from "../shared/roles";
import { parse as parseCookieHeader } from "cookie";
import { createHeartbeatJob } from "./_core/heartbeat";
import { buildCampaignSchedule } from "../shared/agentCampaignSchedule";
import {
  BATCH_REMINDER_LIMIT,
  normalizeBatchReminderDocumentIds,
  normalizeBatchReminderInstruction,
} from "../shared/batchReminders";
import { assertGuestShareRateLimit } from "./_core/guestShareRateLimit";
import { buildDocumentSharePdfBuffer } from "./documentSharePdf";
import { buildDocumentShareDocxBuffer } from "./documentShareDocx";
import { buildDocumentPdfBuffer, renderHtmlToPdfBuffer } from "./pdfService";
import { GUEST_DOCUMENT_INVALID_MESSAGE } from "../shared/documentShare";
import { bootstrapDemoDataset } from "./bootstrapDemo";
import { signMfaChallenge, verifyMfaChallenge } from "./_core/mfaChallenge";
import {
  confirmEnrollment,
  disableMfa,
  readMfaState,
  startEnrollment,
  verifySecondFactor,
  type MfaRefusalReason,
} from "./mfa";
import { recordSession, revokeSessionByToken } from "./sessionRegistry";
import { logConsoleAttempt } from "./systemAccessLog";

/**
 * Message affiché pour chaque motif de refus MFA.
 *
 * Un motif technique (`MfaRefusalReason`) n’est jamais montré tel quel : il est
 * traduit ici, une fois, en une phrase qui dit à l’utilisateur CE QU’IL PEUT
 * FAIRE. Aucune de ces phrases ne contient de secret, de code, ni d’empreinte.
 */
const MFA_REFUSAL_MESSAGES: Record<MfaRefusalReason, string> = {
  indisponible:
    "L’authentification à deux facteurs est momentanément indisponible : la base de données n’a pas répondu. Aucune modification n’a été enregistrée.",
  aucun_enrolement: "Aucun enrôlement en cours pour ce compte. Générez d’abord un secret.",
  deja_active: "L’authentification à deux facteurs est déjà active sur ce compte.",
  non_active: "L’authentification à deux facteurs n’est pas active sur ce compte.",
  code_incorrect:
    "Code refusé. Saisissez le code affiché par votre application d’authentification, ou un code de secours.",
  code_deja_utilise:
    "Ce code a déjà servi. Attendez le code suivant, ou présentez un code de secours qui n’a pas encore été utilisé.",
  echec_ecriture: "L’enregistrement n’a pas abouti : rien n’a été modifié. Réessayez.",
};

/**
 * Traduit un motif de refus MFA en erreur tRPC.
 *
 * `indisponible` et `echec_ecriture` sont des pannes (500) ; un code refusé est
 * un refus d’authentification (401) ; le reste est une demande mal formée (400).
 */
function mfaError(reason: MfaRefusalReason): TRPCError {
  const code =
    reason === "indisponible" || reason === "echec_ecriture"
      ? "INTERNAL_SERVER_ERROR"
      : reason === "code_incorrect" || reason === "code_deja_utilise"
        ? "UNAUTHORIZED"
        : "BAD_REQUEST";
  return new TRPCError({ code, message: MFA_REFUSAL_MESSAGES[reason] });
}

const reminderEmailInputSchema = z.object({
  documentId: z.number().int().positive(),
  subject: z.string().trim().min(3).max(255),
  greeting: z.string().trim().min(1).max(500),
  body: z.string().trim().min(3).max(8000),
  closing: z.string().trim().min(1).max(1000),
  to: z.string().email().max(320).optional(),
});

async function dispatchReminderEmail(input: z.infer<typeof reminderEmailInputSchema>, actorId: number) {
  const document = await db.getDocumentById(input.documentId);
  if (!document || document.kind !== "facture" || document.balanceDue <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "La relance doit concerner une facture avec un solde impayé." });
  }
  const to = (input.to ?? document.clientEmail ?? "").trim();
  if (!to) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Aucune adresse e-mail client. Renseignez l’e-mail sur la fiche client.",
    });
  }
  const text = `${input.greeting}\n\n${input.body}\n\n${input.closing}`;
  const html = `<p>${input.greeting.replace(/\n/g, "<br/>")}</p><p>${input.body.replace(/\n/g, "<br/>")}</p><p>${input.closing.replace(/\n/g, "<br/>")}</p>`;
  try {
    await sendMail({ to, subject: input.subject, text, html });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Échec d’envoi de la relance.",
    });
  }
  await db.createClientActivity({
    clientId: document.clientId,
    documentId: document.id,
    type: "email_envoye",
    title: "Relance envoyée par e-mail",
    description: `${document.number} → ${to} · ${input.subject}`,
    createdById: actorId,
  });
  return { success: true as const, emailed: true as const, to, documentId: document.id };
}

const optionalText = z.string().trim().max(2000).optional();
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ------------------------------------------------------------------ */
/* Habilitation sur les comptes — protection contre l’escalade         */
/* ------------------------------------------------------------------ */

/**
 * Le rôle `systeme` est un DOMAINE À PART.
 *
 * La console d’exploitation n’appartient qu’à lui (`systemProcedure` →
 * `systeme` seul). La conséquence à traiter côté comptes est directe : créer un
 * compte `systeme`, promouvoir vers lui, le rétrograder, réinitialiser son mot
 * de passe ou le supprimer sont autant de moyens pour un `admin` de s’octroyer
 * la console. Aucun de ces gestes ne lui appartient.
 *
 * Règle unique appliquée ici : une opération est autorisée si et seulement si
 * l’acteur et le compte visé sont DU MÊME CÔTÉ de la frontière —
 *   - compte `systeme` visé (ou rôle `systeme` demandé) → acteur `systeme` ;
 *   - compte métier visé (ou rôle métier demandé) → acteur `admin`.
 * Réciproquement, un compte `systeme` ne distribue pas les rôles du commerce et
 * un `admin` n’administre pas les comptes système : séparation des devoirs.
 *
 * Défaut sûr : toute combinaison qui n’est pas explicitement du même côté est
 * refusée.
 */
function assertAccountHabilitation(
  actorRole: AppRole | string,
  options: { currentRole?: string | null; requestedRole?: string | null },
): void {
  const viseUnCompteSysteme = options.currentRole === "systeme" || options.requestedRole === "systeme";
  if (viseUnCompteSysteme === isSystemRole(actorRole)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: viseUnCompteSysteme
      ? "Seul un compte d’administration système peut créer, promouvoir, modifier ou supprimer un compte système."
      : "Un compte d’administration système n’administre pas les comptes métier.",
  });
}

/** Rôle actuel d’un compte de l’instance (`null` s’il n’existe pas). */
async function readAccountRole(userId: number): Promise<string | null> {
  const comptes = await db.listUsers();
  return comptes.find(compte => compte.id === userId)?.role ?? null;
}

/**
 * Refuse de retirer le DERNIER compte `systeme` de l’instance.
 *
 * Sans lui, plus personne ne peut ouvrir la console ni nommer un remplaçant :
 * la porte se referme définitivement. Le relevé est fourni par l’appelant pour
 * ne pas relire la table une seconde fois.
 */
function assertNotLastSystemAccount(comptes: Array<{ role: string }>): void {
  if (comptes.filter(compte => compte.role === "systeme").length <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Impossible de retirer le dernier compte d’administration système de l’instance : plus personne ne pourrait ouvrir la console ni en nommer un.",
    });
  }
}

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

const identityKindSchema = z.enum(IDENTITY_KINDS);

const clientInputSchema = z.object({
  companyName: z.string().trim().min(2).max(180),
  contactName: optionalText,
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(64).optional(),
  address: optionalText,
  identityKind: identityKindSchema.optional(),
  taxId: z.string().trim().max(100).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  notes: optionalText,
  defaultDiscountPercent: z.number().int().min(0).max(99).optional(),
});

const companySettingsInputSchema = z.object({
  legalName: z.string().trim().min(2).max(180),
  legalAddress: optionalText,
  phone: z.string().trim().max(64).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().trim().max(255).optional(),
  identityKind: identityKindSchema.optional(),
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
  contactName: z.string().trim().max(180).optional().default(""),
  email: z.string().trim().max(320).optional().default(""),
  phone: z.string().trim().max(64).optional().default(""),
  address: z.string().trim().max(2000).optional().default(""),
  taxId: z.string().trim().max(100).optional().default(""),
  registrationNumber: z.string().trim().max(100).optional().default(""),
  identityKind: identityKindSchema.optional().default("immatriculee"),
  notes: z.string().trim().max(2000).optional().default(""),
  missingFields: z.array(z.string().trim().max(100)).max(8).optional().default([]),
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
  guest: router({
    getDocument: publicProcedure
      .input(z.object({ token: z.string().trim().min(32).max(128) }))
      .query(async ({ ctx, input }) => {
        const { resolveClientIp } = await import("./_core/clientIp");
        const verdict = assertGuestShareRateLimit(resolveClientIp(ctx.req));
        if (!verdict.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Trop de tentatives. Réessayez dans ${verdict.retryAfterSeconds} seconde(s).`,
          });
        }
        try {
          return await db.getGuestDocumentByShareToken(input.token);
        } catch (error) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error instanceof Error ? error.message : GUEST_DOCUMENT_INVALID_MESSAGE,
          });
        }
      }),
    respondToQuote: publicProcedure
      .input(z.object({
        token: z.string().trim().min(32).max(128),
        decision: z.enum(["accepte", "refuse"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { resolveClientIp } = await import("./_core/clientIp");
        const verdict = assertGuestShareRateLimit(resolveClientIp(ctx.req));
        if (!verdict.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Trop de tentatives. Réessayez dans ${verdict.retryAfterSeconds} seconde(s).`,
          });
        }
        try {
          return await db.respondToGuestQuoteByShareToken(input);
        } catch (error) {
          const message = error instanceof Error ? error.message : GUEST_DOCUMENT_INVALID_MESSAGE;
          throw new TRPCError({
            code: message.includes("expire") || message.includes("attente") ? "BAD_REQUEST" : "NOT_FOUND",
            message,
          });
        }
      }),
  }),
  auth: router({
    register: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
        password: z.string().min(8).max(128),
        name: z.string().trim().min(2).max(180).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Freine le spam de création de comptes (quota plus permissif que login).
        const { registerRateLimiter } = await import("./_core/loginRateLimit");
        const { resolveClientIp } = await import("./_core/clientIp");
        const ip = resolveClientIp(ctx.req);

        const verdict = registerRateLimiter.check({ email: input.email, ip });
        if (!verdict.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Trop de tentatives d'inscription. Réessayez dans ${verdict.retryAfterSeconds} seconde(s).`,
          });
        }

        // GARDE-FOU D'AMORÇAGE : `auth.register` est public. Sans ce verrou,
        // n'importe quel visiteur d'Internet peut se créer un compte sur une
        // instance déjà en service. L'inscription libre n'est donc autorisée que
        // pour créer le PREMIER compte (amorçage). Ensuite, la création de
        // comptes passe par un administrateur.
        const existingCount = await db.countUsersWithPassword();
        if (existingCount > 0) {
          registerRateLimiter.recordFailure({ email: input.email, ip });
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "L'inscription libre est fermée. Demandez à un administrateur de créer votre compte.",
          });
        }

        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          registerRateLimiter.recordFailure({ email: input.email, ip });
          throw new TRPCError({ code: "CONFLICT", message: "Un compte existe déjà avec cet e-mail." });
        }
        const { hashPassword } = await import("./_core/password");
        const passwordHash = await hashPassword(input.password);
        const user = await db.createLocalUser({
          email: input.email,
          passwordHash,
          name: input.name ?? null,
          // Premier compte de l'instance : il doit être administrateur pour
          // pouvoir ensuite gérer les autres.
          role: "admin",
        });
        registerRateLimiter.recordSuccess({ email: input.email });
        return { success: true, openId: user.openId };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
        password: z.string().min(1).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        // Anti-brute-force. Le rate-limit HTTP de `_core/index.ts` ne suffit pas :
        // `httpBatchLink` permet d'empaqueter N tentatives dans 1 requête HTTP.
        // Le comptage doit donc vivre ici, dans la procédure. Voir
        // `_core/loginRateLimit.ts` et `docs/AUTH-email-password.md`.
        const { loginRateLimiter } = await import("./_core/loginRateLimit");
        const { resolveClientIp } = await import("./_core/clientIp");
        const ip = resolveClientIp(ctx.req);

        const verdict = loginRateLimiter.check({ email: input.email, ip });
        if (!verdict.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Trop de tentatives de connexion. Réessayez dans ${verdict.retryAfterSeconds} seconde(s).`,
          });
        }

        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          loginRateLimiter.recordFailure({ email: input.email, ip });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });
        }
        const { verifyPassword } = await import("./_core/password");
        const ok = await verifyPassword(input.password, user.passwordHash);
        if (!ok) {
          loginRateLimiter.recordFailure({ email: input.email, ip });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });
        }

        // ---------------------------------------------------------------
        // SECOND FACTEUR — le mot de passe seul ne suffit plus si le compte
        // porte une MFA.
        // ---------------------------------------------------------------
        //
        // Le mot de passe est correct. Reste à savoir s’il suffit.
        //
        // POURQUOI UNE LECTURE IMPOSSIBLE VAUT « PAS DE MFA » ICI
        // -------------------------------------------------------
        // Le défaut sûr d’un contrôle d’accès est le refus. Ici, pourtant, on
        // choisit l’inverse — et c’est délibéré : la quasi-totalité des comptes
        // n’a PAS de MFA, et une colonne illisible ou une base momentanément
        // muette ne doit pas fermer la connexion de tout le monde. Un compte
        // sans MFA se connecte donc exactement comme avant, y compris quand la
        // lecture échoue.
        //
        // Ce fail-open ne décide QUE d’une chose : si un second temps est
        // demandé. Ce qu’il laisse passer est un mot de passe SEUL, et
        // uniquement quand l’état MFA n’a pas pu être lu — colonne absente, ou
        // base devenue muette entre la lecture du compte et celle de son état.
        // Le résidu est donc réel, et il est assumé : un compte qui a activé la
        // MFA pourrait, dans cette fenêtre, se connecter sans son second
        // facteur. L’alternative — refuser la connexion sur une lecture
        // impossible — fermerait l’application à TOUT LE MONDE pour un incident
        // qui ne concerne que les comptes enrôlés ; c’est ce que le
        // propriétaire de l’instance a écarté. Rien ne compense plus ce choix
        // ailleurs : depuis que la console n’exige plus la MFA
        // (`_core/trpc.ts`), elle est PROPOSÉE partout, jamais imposée.
        const mfa = await readMfaState(user.id);
        if (mfa.readable && mfa.enabled) {
          // PAS DE `recordSuccess` ICI — C’EST VOLONTAIRE, ET C’EST IMPORTANT.
          //
          // `check()` a RÉSERVÉ la tentative (voir `_core/loginRateLimit.ts`) :
          // tant que `recordSuccess` n’est pas appelée, elle reste comptée pour
          // ce compte. Or l’authentification n’est PAS terminée — il manque le
          // second facteur.
          //
          // Libérer le compteur ici ouvrirait exactement la faille que la MFA
          // est censée fermer : un attaquant qui connaît le mot de passe (c’est
          // l’hypothèse de travail) ferait, en boucle,
          //   1. `auth.login` — mot de passe juste → compteur purgé ;
          //   2. `auth.mfaLogin` — code deviné → une seule tentative comptée.
          // Il ne resterait que le quota par IP, contournable en répartissant la
          // source. Le verrou par COMPTE — la défense principale, et la seule
          // qui ne dépende pas de l’adresse — serait neutralisé.
          //
          // Le compteur est donc libéré au seul endroit qui atteste d’une
          // authentification COMPLÈTE : la fin de `auth.mfaLogin`. Conséquence
          // assumée : une tentative de connexion interrompue au second facteur
          // coûte DEUX réservations (mot de passe puis code) — c’est le prix de
          // ne pas rendre un mot de passe connu suffisant pour repartir à zéro.
          //
          // Et AUCUNE SESSION N’EST DÉLIVRÉE ICI : ni cookie, ni ligne
          // `sessions`. Le jeton rendu n’ouvre qu’une chose — présenter le
          // second facteur — et il est signé d’une clé DIFFÉRENTE de celle des
          // sessions (`_core/mfaChallenge.ts`).
          const challenge = await signMfaChallenge({
            openId: user.openId,
            tenantId: user.tenantId ?? 1,
          });
          return {
            mfaRequired: true as const,
            challengeToken: challenge.token,
            expiresInSeconds: challenge.expiresInSeconds,
          };
        }

        loginRateLimiter.recordSuccess({ email: input.email });
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const { signLocalSession, SESSION_TTL_MS } = await import("./_core/localAuth");
        const token = await signLocalSession({
          openId: user.openId,
          email: user.email ?? "",
          name: user.name ?? "",
          tenantId: user.tenantId ?? 1,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });

        // Enregistrement de la session (Phase 3, étape B1) — MEILLEUR EFFORT.
        //
        // L’ÉCHEC EST POSSIBLE ET SANS CONSÉQUENCE POUR L’UTILISATEUR : la table
        // vient d’être posée sur une application en production, et la connexion
        // doit aboutir même si elle est absente, si la base est momentanément
        // injoignable ou si le rôle applicatif n’a pas les droits d’écriture.
        // `recordSession` ne lève jamais : elle journalise et rend compte. On
        // n’attend d’elle qu’une chose — ne pas faire échouer ce `login`.
        //
        // Une session non enregistrée reste une session valable (voir
        // `readSessionState` : absence de ligne = non révoquée). Elle n’apparaîtra
        // simplement pas dans l’écran « Sessions actives » et ne sera pas
        // révocable à distance — c’est le compromis assumé de la disponibilité.
        await recordSession({
          userId: user.id,
          tenantId: user.tenantId ?? null,
          token,
          userAgent: ctx.req.headers?.["user-agent"] ?? null,
          ip: resolveClientIp(ctx.req),
        });
        return { success: true };
      }),
    /**
     * SECOND TEMPS DE LA CONNEXION — présentation du second facteur.
     *
     * Reçoit le défi ouvert par `auth.login` et un code : code TOTP à six
     * chiffres, ou code de secours. En cas de succès, la session est délivrée
     * EXACTEMENT comme au chemin direct — même cookie, même durée de vie, même
     * ligne `sessions` —, si bien que la révocation à distance, l’écran
     * « Sessions actives » et le contrôle de `_core/context.ts` s’appliquent
     * sans rien savoir de la MFA.
     *
     * ANTI-FORCE BRUTE : un code à six chiffres n’a qu’un million de valeurs, et
     * la fenêtre ±1 en rend trois acceptables. C’est peu, mais c’est
     * exactement le même verrou que pour les mots de passe qui compte :
     * `loginRateLimiter`, compté par compte ET par IP, alimenté aussi bien par
     * les échecs de ce chemin que par ceux de `auth.login`.
     */
    mfaLogin: publicProcedure
      .input(z.object({
        challengeToken: z.string().min(20).max(4096),
        code: z.string().trim().min(1).max(64),
      }))
      .mutation(async ({ ctx, input }) => {
        const { loginRateLimiter } = await import("./_core/loginRateLimit");
        const { resolveClientIp } = await import("./_core/clientIp");
        const ip = resolveClientIp(ctx.req);

        const challenge = await verifyMfaChallenge(input.challengeToken);
        if (!challenge) {
          // Expiré, signé d’une autre clé, ou fabriqué : les trois se valent du
          // point de vue de l’appelant, qui doit simplement recommencer.
          logConsoleAttempt({ outcome: "defi_refuse", target: "auth.mfaLogin" });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Ce défi a expiré ou n’est plus valable. Reconnectez-vous.",
          });
        }

        const user = await db.getUserByOpenId(challenge.openId);
        if (!user) {
          logConsoleAttempt({
            outcome: "defi_refuse",
            target: "auth.mfaLogin",
            tenantId: challenge.tenantId,
          });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Ce défi a expiré ou n’est plus valable. Reconnectez-vous.",
          });
        }

        // Le compteur est indexé sur le compte, pas sur le défi : rouvrir un
        // défi ne remet pas le compteur à zéro.
        const email = user.email ?? user.openId;
        const verdict = loginRateLimiter.check({ email, ip });
        if (!verdict.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Trop de tentatives de connexion. Réessayez dans ${verdict.retryAfterSeconds} seconde(s).`,
          });
        }

        const verified = await verifySecondFactor(user.id, input.code);
        if (!verified.ok) {
          loginRateLimiter.recordFailure({ email, ip });
          logConsoleAttempt({
            outcome: "defi_refuse",
            target: "auth.mfaLogin",
            role: user.role,
            actor: user.email ?? user.openId,
            actorId: user.id,
            tenantId: user.tenantId ?? null,
          });
          throw mfaError(verified.reason);
        }

        loginRateLimiter.recordSuccess({ email });
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const { signLocalSession, SESSION_TTL_MS } = await import("./_core/localAuth");
        const token = await signLocalSession({
          openId: user.openId,
          email: user.email ?? "",
          name: user.name ?? "",
          tenantId: user.tenantId ?? 1,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });

        // Même enregistrement que le chemin direct, au même titre : la MFA ne
        // change rien à la façon dont la session vit ensuite.
        await recordSession({
          userId: user.id,
          tenantId: user.tenantId ?? null,
          token,
          userAgent: ctx.req.headers?.["user-agent"] ?? null,
          ip,
        });

        return { success: true as const, method: verified.value.method };
      }),
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { passwordHash: _passwordHash, ...safeUser } = ctx.user;
      return safeUser;
    }),
    /**
     * Changement de mot de passe par l'utilisateur connecté.
     *
     * Procédure PROTÉGÉE : on impose de connaître l'ancien mot de passe. Cela
     * empêche qu'un attaquant ayant momentanément accès à la session (cookie
     * volé non encore expiré) ne la verrouille pas en silence. Le nouveau mot de
     * passe doit être suffisamment robuste.
     */
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Session introuvable." });
        }

        const db_user = await db.getUserByOpenId(user.openId);
        if (!db_user || !db_user.passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ce compte n'utilise pas l'authentification par mot de passe.",
          });
        }

        const { verifyPassword, hashPassword } = await import("./_core/password");
        const ok = await verifyPassword(input.currentPassword, db_user.passwordHash);
        if (!ok) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Mot de passe actuel incorrect." });
        }

        if (input.currentPassword === input.newPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Le nouveau mot de passe doit être différent de l'actuel.",
          });
        }

        const passwordHash = await hashPassword(input.newPassword);
        await db.setUserPasswordHash(db_user.id, passwordHash);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Révocation côté base AVANT l’effacement du cookie : c’est le seul moment
      // où l’on dispose encore du jeton. Meilleur effort — se déconnecter doit
      // réussir même si la base ne répond pas, le cookie part de toute façon.
      const presented = readSessionToken(ctx.req.headers?.cookie);
      if (presented) await revokeSessionByToken(presented);

      const cookieOptions = getSessionCookieOptions(ctx.req);
      // Effacer le cookie en définissant maxAge à 0 (expiration immédiate)
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
      return { success: true, redirectTo: "/login" } as const;
    }),
    /**
     * Demande de réinitialisation du mot de passe (flux "Mot de passe oublié").
     * Toujours retourner {success: true} pour éviter de révéler si l'email existe.
     */
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email().max(320) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          // Ne pas révéler si l'email existe ou pas
          return { success: true };
        }
        if (!user.passwordHash) {
          // Compte OAuth, pas de mot de passe local
          return { success: true };
        }
        const crypto = await import("node:crypto");
        const { hashPassword } = await import("./_core/password");
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = await hashPassword(token);
        await db.createPasswordReset({
          userId: user.id,
          tokenHash,
          tenantId: user.tenantId ?? undefined,
        });
        const origin = getRequestOrigin(ctx.req);
        const resetLink = `${origin}/reset-password?token=${token}`;
        const rendered = await db.renderEmailTemplate("password-reset", { resetLink });
        await sendMail({
          to: input.email,
          subject: rendered?.subject ?? "Réinitialisation de votre mot de passe Lucepress",
          html: rendered?.html ?? "",
          text: rendered?.text ?? `Réinitialisation de votre mot de passe Lucepress\n\nCliquez sur ce lien pour créer un nouveau mot de passe : ${resetLink}\n\nCe lien expirera dans 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.`,
        }).catch(() => {
          // Ne pas bloquer si l'envoi échoue, mais logger
          console.warn(`[auth] Échec envoi email reset à ${input.email}`);
        });
        return { success: true };
      }),
    /**
     * Réinitialisation effective : vérifie le token et définit un nouveau mot de passe.
     * Publique (l'utilisateur n'est pas connecté). Le token est à usage unique.
     */
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(8).max(128),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ input }) => {
        const reset = await db.findPasswordResetByToken(input.token);
        if (!reset) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.",
          });
        }
        const { hashPassword } = await import("./_core/password");
        const passwordHash = await hashPassword(input.newPassword);
        await db.resetUserPassword(reset.userId, passwordHash);
        // Marquer le reset comme utilisé (à usage unique)
        await db.markPasswordResetUsed(reset.id);
        return { success: true };
      }),
  }),
  /**
   * AUTHENTIFICATION À DEUX FACTEURS (TOTP) — gestion du compte CONNECTÉ.
   *
   * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : chacun ne gère QUE sa propre MFA. Aucune
   * de ces procédures ne prend d’identifiant de compte en entrée — il n’y a donc
   * pas de paramètre à falsifier pour toucher la MFA d’un autre. Un
   * administrateur système qui voudrait réenrôler un collègue ne le peut pas
   * d’ici : ce serait un pouvoir de prise de contrôle, et il n’est pas ouvert.
   *
   * POURQUOI `protectedProcedure` ET NON `systemProcedure` : la MFA appartient
   * à TOUT compte connecté, pas seulement au compte d’exploitation. La placer
   * sous le garde de la console la rendrait inaccessible aux `admin`,
   * `directeur` et `cadre`, alors qu’elle ne dépend d’aucune habilitation.
   *
   * MFA FACULTATIVE PARTOUT : rien ici n’impose la MFA, à personne. Tout
   * utilisateur authentifié PEUT l’activer ; personne n’y est forcé — y compris
   * pour ouvrir la console, qui n’exige plus que le rôle `systeme`
   * (`server/_core/trpc.ts`). Activer reste un choix, et le désactiver aussi.
   */
  mfa: router({
    /**
     * État de sa propre MFA. Ne lève jamais : une base injoignable rend
     * `readable: false`, ce que l’interface affiche comme « état inconnu » au
     * lieu de prétendre que la MFA est absente.
     */
    status: protectedProcedure.query(async ({ ctx }) => {
      const state = await readMfaState(ctx.user!.id);
      return {
        readable: state.readable,
        enabled: state.enabled,
        pending: state.pending,
        enrolledAt: state.enrolledAt ? state.enrolledAt.toISOString() : null,
        recoveryCodesRemaining: state.recoveryCodesRemaining,
      };
    }),

    /**
     * Ouvre (ou rouvre) un enrôlement : tire un secret, le CHIFFRE et
     * l’enregistre, SANS activer la MFA.
     *
     * Le secret n’est rendu QU’ICI, une seule fois. Il n’est jamais relu depuis
     * la base par une procédure : la colonne ne contient qu’une enveloppe
     * chiffrée, et aucune interface ne la déchiffre pour l’afficher.
     */
    enrollStart: protectedProcedure.mutation(async ({ ctx }) => {
      const user = ctx.user!;
      const account = user.email ?? user.name ?? user.openId;
      const result = await startEnrollment(user.id, account);
      if (!result.ok) throw mfaError(result.reason);

      logConsoleAttempt({
        outcome: "enrolement_demarre",
        target: "mfa.enrollStart",
        role: user.role,
        actor: user.email ?? user.openId,
        actorId: user.id,
        tenantId: user.tenantId ?? null,
      });

      // Ni le secret ni l’URI ne sont journalisés : le journal nomme l’acteur et
      // l’étape, jamais de quoi fabriquer un code.
      return {
        secret: result.value.secret,
        otpauthUri: result.value.otpauthUri,
        issuer: result.value.issuer,
        account: result.value.account,
        digits: result.value.digits,
        periodSeconds: result.value.periodSeconds,
        algorithm: result.value.algorithm,
      };
    }),

    /**
     * Confirme l’enrôlement avec un PREMIER code, puis active la MFA et remet
     * les dix codes de secours — une seule fois, en clair, jamais relisibles.
     */
    enrollConfirm: protectedProcedure
      .input(z.object({ code: z.string().trim().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user!;
        const result = await confirmEnrollment(user.id, input.code);
        if (!result.ok) throw mfaError(result.reason);

        logConsoleAttempt({
          outcome: "enrolement_confirme",
          target: "mfa.enrollConfirm",
          role: user.role,
          actor: user.email ?? user.openId,
          actorId: user.id,
          tenantId: user.tenantId ?? null,
        });

        const { formatRecoveryCode } = await import("../shared/mfa");
        return {
          success: true as const,
          // Présentés groupés pour être recopiables sans erreur. La base n’en
          // garde que les empreintes scrypt : ces codes ne seront plus affichés.
          recoveryCodes: result.value.recoveryCodes.map(formatRecoveryCode),
          enrolledAt: result.value.enrolledAt.toISOString(),
        };
      }),

    /**
     * Désactive la MFA. EXIGE un code valide — TOTP ou code de secours.
     *
     * Sans cette exigence, une session volée suffirait à retirer le second
     * facteur, c’est-à-dire à annuler la protection qu’il apporte.
     *
     * ANTI-FORCE BRUTE, COMME À LA CONNEXION. Ce point a failli manquer : une
     * session volée (sans le téléphone, sans le mot de passe) pourrait sinon
     * faire défiler des codes à six chiffres sans autre frein que le quota HTTP
     * global — lequel ne compte pas PAR COMPTE et se contourne en répartissant
     * la source. UN MILLION de codes, trois acceptables à tout instant : sans
     * verrou, c’est une question d’heures. Le même limiteur que `auth.login` est
     * donc appliqué ici, indexé sur le compte, et l’échec est journalisé — une
     * tentative de retrait du second facteur est un signal que l’administrateur
     * système doit voir.
     *
     * CONSÉQUENCE ASSUMÉE DU COMPTEUR PARTAGÉ : cinq codes faux ici retardent
     * aussi la prochaine CONNEXION du compte (repli exponentiel, une minute).
     * C’est voulu — un compte qu’on attaque doit se défendre, et la personne qui
     * subit ce retard est celle dont la session est déjà entre d’autres mains.
     */
    disable: protectedProcedure
      .input(z.object({ code: z.string().trim().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user!;
        const { loginRateLimiter } = await import("./_core/loginRateLimit");
        const { resolveClientIp } = await import("./_core/clientIp");
        const ip = resolveClientIp(ctx.req);
        const email = user.email ?? user.openId;

        const verdict = loginRateLimiter.check({ email, ip });
        if (!verdict.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Trop de tentatives. Réessayez dans ${verdict.retryAfterSeconds} seconde(s).`,
          });
        }

        const result = await disableMfa(user.id, input.code);
        if (!result.ok) {
          loginRateLimiter.recordFailure({ email, ip });
          // On ne journalise QUE le refus d’un code. Une panne de base ou une
          // MFA déjà inactive n’est pas une tentative d’attaque : les confondre
          // enverrait l’administrateur système sur une fausse piste.
          if (result.reason === "code_incorrect" || result.reason === "code_deja_utilise") {
            logConsoleAttempt({
              outcome: "defi_refuse",
              target: "mfa.disable",
              role: user.role,
              actor: email,
              actorId: user.id,
              tenantId: user.tenantId ?? null,
            });
          }
          throw mfaError(result.reason);
        }

        // La réservation prise par `check()` est libérée : la désactivation a
        // abouti, l’opération n’a pas échoué. Sans cette libération, chaque
        // désactivation réussie laisserait un cran de plus dans le compteur du
        // compte — et referait, par un autre chemin, ce que l’on vient
        // précisément d’interdire à la connexion.
        loginRateLimiter.recordSuccess({ email });

        logConsoleAttempt({
          outcome: "mfa_desactivee",
          target: "mfa.disable",
          role: user.role,
          actor: email,
          actorId: user.id,
          tenantId: user.tenantId ?? null,
        });

        return { success: true as const, disabledAt: result.value.disabledAt.toISOString() };
      }),
  }),
  /**
   * Gestion des collaborateurs (réservée aux administrateurs).
   * Dans l'architecture mono-tenant actuelle, un « collaborateur » est un compte
   * `users` avec un rôle `admin`, `directeur`, `cadre` ou `systeme`. Les procédures ci-dessous permettent d'administrer
   * ces comptes — sans jamais exposer le hash des mots de passe.
   *
   * HABILITATION — voir `assertAccountHabilitation` : le rôle `systeme` est un
   * domaine à part, que seul un compte `systeme` peut administrer.
   */
  users: router({
    list: adminProcedure.query(() => db.listUsers()),
    create: usersProcedure
      .input(z.object({
        email: z.string().email().max(320),
        name: z.string().trim().min(2).max(180).optional(),
        password: z.string().min(8).max(128),
        role: z.enum(APP_ROLES).default("cadre"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.role === "client") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Les accès portail client s’invitent depuis la fiche client.",
          });
        }
        assertAccountHabilitation(ctx.user.role, { requestedRole: input.role });
        const existant = await db.getUserByEmail(input.email);
        if (existant) {
          throw new TRPCError({ code: "CONFLICT", message: "Un compte existe déjà avec cet e-mail." });
        }
        const { hashPassword } = await import("./_core/password");
        const passwordHash = await hashPassword(input.password);
        const user = await db.createLocalUser({
          email: input.email,
          passwordHash,
          name: input.name ?? null,
          role: input.role,
        });
        return { success: true, openId: user.openId, id: user.id } as const;
      }),
    setRole: usersProcedure
      // `STAFF_ASSIGNABLE_ROLES` (cadre/directeur/admin/systeme) : tous les rôles
      // internes persistables. `client` reste exclu — il s’attribue depuis la
      // fiche client, pas depuis la gestion des collaborateurs.
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(STAFF_ASSIGNABLE_ROLES) }))
      .mutation(async ({ ctx, input }) => {
        // Garde-fou : un admin ne peut pas se rétrograder lui-même et laisser
        // l'instance sans administrateur.
        if (ctx.user.id === input.userId && input.role !== "admin") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vous ne pouvez pas retirer votre propre rôle d'administrateur.",
          });
        }
        const comptes = await db.listUsers();
        const roleActuel = comptes.find(compte => compte.id === input.userId)?.role ?? null;
        assertAccountHabilitation(ctx.user.role, { currentRole: roleActuel, requestedRole: input.role });
        // Garde-fou : ne jamais laisser l’instance sans administrateur système —
        // plus personne ne pourrait alors ouvrir la console ni en nommer un.
        if (roleActuel === "systeme" && input.role !== "systeme") {
          assertNotLastSystemAccount(comptes);
        }
        await db.setUserRole(input.userId, input.role);
        return { success: true } as const;
      }),
    resetPassword: usersProcedure
      .input(z.object({ userId: z.number().int().positive(), newPassword: z.string().min(8).max(128) }))
      .mutation(async ({ ctx, input }) => {
        // Réinitialiser le mot de passe d’un compte `systeme` reviendrait à en
        // prendre la main, donc à s’octroyer la console : même règle de domaine.
        const roleActuel = await readAccountRole(input.userId);
        assertAccountHabilitation(ctx.user.role, { currentRole: roleActuel });
        const { hashPassword } = await import("./_core/password");
        const passwordHash = await hashPassword(input.newPassword);
        await db.resetUserPassword(input.userId, passwordHash);
        return { success: true } as const;
      }),
    remove: usersProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        // Un admin ne peut pas se supprimer lui-même.
        if (ctx.user.id === input.userId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas supprimer votre propre compte." });
        }
        const comptes = await db.listUsers();
        const roleActuel = comptes.find(compte => compte.id === input.userId)?.role ?? null;
        assertAccountHabilitation(ctx.user.role, { currentRole: roleActuel });
        // Même garde-fou que pour la rétrogradation : la suppression aussi peut
        // vider l’instance de son administrateur système.
        if (roleActuel === "systeme") {
          assertNotLastSystemAccount(comptes);
        }
        const result = await db.deleteUser(input.userId);
        if (!result.deleted) {
          const msg =
            result.reason === "dernier_admin"
              ? "Impossible de supprimer le dernier administrateur de l'instance."
              : result.reason === "compte_introuvable"
                ? "Compte introuvable."
                : "Suppression impossible.";
          throw new TRPCError({ code: "BAD_REQUEST", message: msg });
        }
        return { success: true } as const;
      }),
    /**
     * Invitation par e-mail : génère un token sécurisé (jamais stocké en clair),
     * renvoie le lien complet à l'admin qui le transmet lui-même à l'invité.
     * L'admin ne saisit PAS le mot de passe du collaborateur — l'invité le définit
     * à l'acceptation (procédure `acceptInvitation`, publique).
     */
    invite: usersProcedure
      .input(z.object({
        email: z.string().email().max(320),
        name: z.string().trim().min(2).max(180).optional(),
        role: z.enum(APP_ROLES).default("cadre"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.role === "client") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Les accès portail client s’invitent depuis la fiche client, pas depuis les comptes internes.",
          });
        }
        // Inviter revient à créer : la même habilitation s’applique. Le rôle de
        // l’invitation est celui que le compte recevra à l’acceptation.
        assertAccountHabilitation(ctx.user.role, { requestedRole: input.role });
        return issueInvitation({
          email: input.email,
          role: input.role,
          invitedById: ctx.user.id,
          invitedByName: ctx.user.name,
          tenantId: ctx.tenantId,
          req: ctx.req,
        });
      }),
    listInvitations: adminProcedure.query(() => db.listInvitations()),
    resendInvitation: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!isMailConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "SMTP non configuré. Impossible de renvoyer l’invitation par e-mail.",
          });
        }
        const rotated = await db.rotateInvitationToken(input.id);
        if (!rotated) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invitation introuvable, déjà utilisée, révoquée ou expirée.",
          });
        }
        const origin = getRequestOrigin(ctx.req);
        const inviteLink = `${origin}/invitation?token=${rotated.token}`;
        try {
          const rendered = await db.renderEmailTemplate("invitation", {
            inviterName: ctx.user.name ?? "Lucepres",
            inviteLink,
            organization: LUCEPRES_PUBLIC_PROFILE.legalName,
            expiresAt: rotated.expiresAt.toLocaleString("fr-FR"),
          });
          await sendMail({
            to: rotated.email,
            bcc: (() => {
              const smtpUser = getSmtpUser();
              if (!smtpUser) return undefined;
              if (smtpUser.toLowerCase() === rotated.email.trim().toLowerCase()) return undefined;
              return smtpUser;
            })(),
            subject: rendered?.subject ?? `Invitation à rejoindre ${LUCEPRES_PUBLIC_PROFILE.legalName}`,
            html: rendered?.html ?? "",
            text: rendered?.text ?? `Invitation Lucepress : ${inviteLink}`,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Échec d’envoi de l’e-mail d’invitation.",
          });
        }
        return {
          success: true as const,
          emailed: true as const,
          email: rotated.email,
          invitationLink: inviteLink,
        };
      }),
    revokeInvitation: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.revokeInvitation(input.id);
        return { success: true } as const;
      }),
    deleteInvitation: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.deleteInvitation(input.id);
        return { success: true } as const;
      }),
  }),
  /**
   * Aperçu public d’un lien d’invitation (sans créer le compte).
   * Permet d’afficher immédiatement si le lien est périmé / déjà utilisé.
   */
  previewInvitation: publicProcedure
    .input(z.object({ token: z.string().min(8).max(128) }))
    .query(async ({ input }) => {
      const result = await db.findInvitationByToken(input.token);
      if (result.reason !== "pending" || !result.invitation) {
        return {
          valid: false as const,
          reason: result.reason,
        };
      }
      const email = result.invitation.email;
      const at = email.indexOf("@");
      const emailHint = at > 1
        ? `${email[0]}***${email.slice(at)}`
        : "***";
      return {
        valid: true as const,
        reason: "pending" as const,
        emailHint,
        role: result.invitation.role,
        expiresAt: result.invitation.expiresAt,
      };
    }),
  /**
   * Acceptation d'une invitation (publique : l'invité n'est pas encore connecté).
   * Le collaborateur définit son nom + mot de passe ; le compte est créé à ce
   * moment-là. Le token est vérifié (empreinte SHA-256) et à usage unique.
   */
  acceptInvitation: publicProcedure
    .input(z.object({
      token: z.string().min(8).max(128),
      name: z.string().trim().min(2).max(180),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ input }) => {
      // #region agent log
      const __dbg = (hypothesisId: string, location: string, message: string, data: Record<string, unknown>) => {
        const payload = { sessionId: "9c0039", runId: "pre-fix", hypothesisId, location, message, data, timestamp: Date.now() };
        console.log("DEBUG_ACCEPT_9c0039", JSON.stringify(payload));
        fetch("http://127.0.0.1:7581/ingest/cbc96c89-ed00-4715-9c49-6a3427fcaddd", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9c0039" }, body: JSON.stringify(payload) }).catch(() => {});
      };
      __dbg("A", "routers.ts:acceptInvitation:entry", "acceptInvitation called", { tokenLen: input.token?.length ?? 0, tokenPrefix: String(input.token || "").slice(0, 8), nameLen: input.name?.trim()?.length ?? 0, passwordLen: input.password?.length ?? 0 });
      // #endregion
      const result = await db.findInvitationByToken(input.token);
      // #region agent log
      __dbg("A", "routers.ts:acceptInvitation:lookup", "findInvitationByToken result", { reason: result.reason, inviteId: result.invitation?.id ?? null, inviteStatus: result.invitation?.status ?? null, inviteEmailDomain: result.invitation?.email?.split("@")[1] ?? null, tenantId: result.invitation?.tenantId ?? null, role: result.invitation?.role ?? null });
      // #endregion
      if (result.reason === "not_found") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ce lien d’invitation n’est plus valide (déjà renvoyé, révoqué ou incorrect). Demandez un nouvel envoi à un administrateur, puis utilisez uniquement le dernier lien." });
      }
      if (result.reason === "already_accepted") {
        throw new TRPCError({ code: "CONFLICT", message: "Cette invitation a déjà été utilisée. Demandez une nouvelle invitation." });
      }
      if (result.reason === "revoked") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cette invitation a été révoquée par un administrateur." });
      }
      if (result.reason === "expired") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cette invitation a expiré. Demandez une nouvelle invitation." });
      }
      const cible = result.invitation!;
      const existant = await db.getUserByEmail(cible.email);
      // #region agent log
      __dbg("B", "routers.ts:acceptInvitation:emailCheck", "existing user check", { exists: Boolean(existant), existingUserId: existant?.id ?? null });
      // #endregion
      if (existant) {
        try {
          const { runWithTenant } = await import("./_core/tenantContext");
          await runWithTenant(cible.tenantId, () => db.revokeInvitation(cible.id));
        } catch {
          /* best-effort revoke */
        }
        throw new TRPCError({ code: "CONFLICT", message: "Un compte existe déjà avec cet e-mail." });
      }
      try {
        const { hashPassword } = await import("./_core/password");
        const passwordHash = await hashPassword(input.password);
        const user = await db.createLocalUser({
          email: cible.email,
          passwordHash,
          name: input.name,
          role: cible.role,
          tenantId: cible.tenantId,
        });
        await db.markInvitationAccepted(cible.tokenHash, user.id);
        // #region agent log
        __dbg("C", "routers.ts:acceptInvitation:success", "account created", { userId: user.id, role: cible.role, tenantId: cible.tenantId });
        // #endregion
        return { success: true, openId: user.openId, id: user.id } as const;
      } catch (error) {
        // #region agent log
        __dbg("C", "routers.ts:acceptInvitation:createError", "create/mark failed", { errorName: error instanceof Error ? error.name : "unknown", errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) });
        // #endregion
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Impossible de créer le compte.",
        });
      }
    }),

  /**
   * Gestion des templates d'e-mail (admin).
   * Permet de lister, créer, mettre à jour et supprimer les templates.
   * Les templates globaux (tenantId NULL) sont visibles par tous,
   * les templates tenant-spécifiques sont prioritaires.
   */
  emailTemplates: router({
    list: adminProcedure.query(() => db.listEmailTemplates()),
    create: adminProcedure
      .input(z.object({
        slug: z.string().trim().min(1).max(100),
        name: z.string().trim().min(1).max(255),
        subject: z.string().trim().min(1).max(500),
        html: z.string().min(1),
        text: z.string().optional(),
        tenantId: z.number().int().positive().nullable().optional(),
      }))
      .mutation(({ input }) => db.createEmailTemplate(input)),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(255).optional(),
        subject: z.string().trim().min(1).max(500).optional(),
        html: z.string().min(1).optional(),
        text: z.string().optional(),
        enabled: z.enum(["oui", "non"]).optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateEmailTemplate(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => db.deleteEmailTemplate(input.id)),
    preview: adminProcedure
      .input(z.object({
        slug: z.string(),
        variables: z.record(z.string(), z.string()),
      }))
      .query(({ input }) => db.renderEmailTemplate(input.slug, input.variables)),
    generate: adminProcedure
      .input(z.object({
        brief: z.string().trim().min(8).max(2000),
        variables: z.array(z.string()).max(20).optional(),
      }))
      .mutation(async ({ input }) => {
        const models = await listLLMModels();
        const candidates = await pickLLMModelCandidates(models);
        const varsHint = input.variables && input.variables.length > 0
          ? `Variables disponibles (placeholders {{nom}}): ${input.variables.join(", ")}. Utilisez-les dans le HTML et le sujet.`
          : "Aucune variable dynamique requise.";
        const systemPrompt = `Tu es le rédacteur de modèles d'e-mail de Lucepress Sarl, entreprise guinéenne de BTP, forage et services durables. Tu génères un modèle d'e-mail HTML professional, chaleureux et lisible (style Mailchimp « warm humanist » : carte sur fond ivoire, hero dégradé vert #1a4d44, barre accent or #d4a24e, pied de page vert clair). RèGLES : (1) HTML table-based pour compatibilité mail (pas de div/flex/grid). (2) CSS inline dans les <style> du <head>. (3) Responsive (media query <580px). (4) Police system-ui. (5) Boutons en <a> avec background, pas de JS. (6) Tutoiement chaleureux, phrases courtes orientées action. (7) Variables sous forme {{nom}}. RÉPONDS UNIQUEMENT par un objet JSON valide : {"name": "...", "subject": "...", "html": "...", "text": "..."} sans texte autour.`;
        try {
          const result = await invokeLLMWithFallback({
            max_tokens: 1200,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Demande: ${input.brief}\n\n${varsHint}` },
            ],
            response_format: { type: "json_schema", json_schema: { name: "email_template", schema: { type: "object", properties: { name: { type: "string" }, subject: { type: "string" }, html: { type: "string" }, text: { type: "string" } }, required: ["name", "subject", "html", "text"], additionalProperties: false } } },
          },
          candidates);
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le modèle IA est indisponible. Réessayez dans un instant." });
          let parsed: { name: string; subject: string; html: string; text: string };
          try { parsed = JSON.parse(content); }
          catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le modèle IA ne peut pas être lu. Réessayez dans un instant." }); }
          return { name: String(parsed.name), subject: String(parsed.subject), html: String(parsed.html), text: String(parsed.text ?? ""), model: result.model };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "La génération IA a échoué." });
        }
      }),
  }),

  billing: router({
    dashboard: staffProcedure.query(() => db.getDashboardData()),
    mailStatus: staffProcedure.query(() => ({ smtpConfigured: isMailConfigured() })),
    bootstrapDemo: staffProcedure.mutation(async ({ ctx }) => {
      try {
        return await bootstrapDemoDataset(ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Le jeu demo n’a pas pu être créé.",
        });
      }
    }),
    audit: router({
      list: directionProcedure
        .input(z.object({
          type: z.enum(CLIENT_ACTIVITY_TYPES).optional(),
          limit: z.number().int().min(1).max(500).optional(),
        }).optional())
        .query(({ input }) => db.listStaffAuditJournal(input)),
    }),
    clients: router({
      list: staffProcedure.query(() => db.listClients()),
      duplicates: staffProcedure.input(z.object({ companyName: z.string().trim().min(2).max(180), email: z.string().email().optional().or(z.literal("")), phone: z.string().trim().max(64).optional(), excludedId: z.number().int().positive().optional() })).query(({ input }) => db.findClientDuplicates(input, input.excludedId)),
      create: staffProcedure
        .input(clientInputSchema)
        .mutation(({ input }) => db.createClient(input)),
      update: staffProcedure
        .input(clientInputSchema.extend({ id: z.number().int().positive() }))
        .mutation(({ input }) => db.updateClient(input.id, input)),
      delete: staffProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          try {
            return await db.deleteClient(input.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le client n’a pas pu être supprimé." });
          }
        }),
      invitePortal: staffProcedure
        .input(z.object({ clientId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const client = await db.getClientById(input.clientId);
          if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client introuvable." });
          const email = client.email?.trim();
          if (!email) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Renseignez l’e-mail sur la fiche client avant d’inviter au portail.",
            });
          }
          const existant = await db.getUserByEmail(email);
          // Tout compte existant qui n’est PAS un compte portail est un compte
          // interne (`admin`, `directeur`, `cadre`, `systeme`) : on refuse.
          // Le filtre inverse (`isStaffRole`) ne suffirait plus depuis que
          // `systeme` est persistable — le rôle système n’est pas un compte
          // commercial, mais reste un compte interne.
          if (existant && !isClientRole(existant.role)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Cet e-mail appartient déjà à un compte interne Lucepres. Utilisez une autre adresse sur la fiche client.",
            });
          }
          if (existant?.role === "client") {
            return {
              success: true as const,
              alreadyHasAccess: true,
              email,
              invitationLink: null as string | null,
              emailed: false,
              smtpConfigured: isMailConfigured(),
            };
          }
          const issued = await issueInvitation({
            email,
            role: "client",
            invitedById: ctx.user.id,
            invitedByName: ctx.user.name,
            tenantId: ctx.tenantId,
            req: ctx.req,
          });
          await db.createClientActivity({
            clientId: client.id,
            type: "email_envoye",
            title: "Invitation portail client",
            description: `${email}${issued.emailed ? " — e-mail envoyé" : " — lien à transmettre"}`,
            createdById: ctx.user.id,
          });
          return { ...issued, alreadyHasAccess: false, invitationLink: issued.invitationLink };
        }),
      attachments: router({
        list: staffProcedure.input(z.object({ clientId: z.number().int().positive() })).query(({ input }) => db.listClientAttachments(input.clientId)),
      }),
      activities: router({
        list: staffProcedure.input(z.object({ clientId: z.number().int().positive() })).query(({ input }) => db.listClientActivities(input.clientId)),
        createNote: staffProcedure.input(z.object({ clientId: z.number().int().positive(), title: z.string().trim().min(2).max(255).default("Note d’appel"), description: z.string().trim().min(3).max(2000) })).mutation(({ ctx, input }) => db.createClientActivity({ ...input, type: "note", createdById: ctx.user.id })),
      }),
    }),
    settings: router({
      get: staffProcedure.query(() => db.getCompanySettings()),
      save: adminProcedure.input(companySettingsInputSchema).mutation(({ input }) => db.saveCompanySettings(input)),
    }),
    projects: router({
      list: staffProcedure.query(() => db.listProjects()),
      create: staffProcedure
        .input(z.object({ clientId: z.number().int().positive(), name: z.string().trim().min(2).max(180), reference: z.string().trim().max(80).optional(), type: z.enum(["btp", "forage", "mixte"]), location: z.string().trim().max(255).optional(), description: optionalText }))
        .mutation(({ input }) => db.createProject(input)),
      updatePlannedBudget: staffProcedure.input(z.object({ id: z.number().int().positive(), plannedBudget: z.number().int().min(0).max(9_000_000_000) })).mutation(({ input }) => db.updateProjectPlannedBudget(input)),
      updateFinancialTargets: staffProcedure.input(z.object({ id: z.number().int().positive(), plannedBudget: z.number().int().min(0).max(9_000_000_000), minimumMarginRate: z.number().int().min(0).max(100).nullable() })).mutation(({ input }) => db.updateProjectFinancialTargets(input)),
      costs: router({
        list: staffProcedure.input(z.object({ projectId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.listProjectCosts(input?.projectId)),
        create: staffProcedure.input(z.object({ projectId: z.number().int().positive(), category: z.enum(["materiaux", "main_oeuvre", "transport", "equipement", "sous_traitance", "autre"]), description: z.string().trim().min(3).max(500), amount: z.number().int().positive().max(9_000_000_000), incurredAt: dateText })).mutation(({ ctx, input }) => db.createProjectCost({ ...input, createdById: ctx.user.id })),
        delete: staffProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.deleteProjectCost(input.id)),
        attachments: router({
          list: staffProcedure.input(z.object({ projectCostId: z.number().int().positive() })).query(({ input }) => db.listProjectCostAttachments(input.projectCostId)),
          delete: staffProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.deleteProjectCostAttachment(input.id)),
        }),
        profitability: staffProcedure.query(() => db.listProjectProfitability()),
      }),
    }),
    receivables: staffProcedure.query(() => db.getReceivablesDashboard()),
    workspaceSearch: staffProcedure
      .input(z.object({
        query: z.string().trim().max(80),
        filters: z.object({
          kind: z.enum(["client", "devis", "facture", "creance"]).optional(),
          dateFrom: z.string().regex(/^\\d{4}-(0[1-9]|1[0-2])-([0-2]\\d|3[01])$/).optional(),
          dateTo: z.string().regex(/^\\d{4}-(0[1-9]|1[0-2])-([0-2]\\d|3[01])$/).optional(),
          status: z.string().trim().max(40).optional(),
          amountMin: z.number().int().nonnegative().max(1_000_000_000_000_000).optional(),
          amountMax: z.number().int().nonnegative().max(1_000_000_000_000_000).optional(),
          sortBy: z.enum(["relevance", "date", "status", "amount"]).optional(),
          sortDirection: z.enum(["asc", "desc"]).optional(),
        }).optional(),
      }))
      .query(({ input }) => db.searchWorkspace({ query: input.query, filters: input.filters })),
    collection: router({
      assignees: staffProcedure.query(() => db.listCollectionAssignees()),
      updateFollowUp: staffProcedure
        .input(z.object({ documentId: z.number().int().positive(), collectionStatus: z.enum(["a_traiter", "contacte", "a_rappeler"]).optional(), collectionReminderDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/, "La date de rappel doit respecter le format AAAA-MM-JJ.").nullable().optional(), collectionOwnerId: z.number().int().positive().nullable().optional() }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.updateCollectionFollowUp({ ...input, updatedById: ctx.user.id }); }
          catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le suivi de recouvrement ne peut pas être mis à jour." }); }
        }),
      reassign: directionProcedure
        .input(z.object({ documentIds: z.array(z.number().int().positive()).min(1).max(20).refine(ids => new Set(ids).size === ids.length, "Une créance ne peut être sélectionnée qu’une fois."), collectionOwnerId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try { return await db.reassignCollectionFollowUps({ ...input, updatedById: ctx.user.id }); }
          catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Les créances ne peuvent pas être réattribuées." }); }
        }),
      monthlyReport: directionProcedure
        .input(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Le mois doit respecter le format AAAA-MM.") }))
        .query(async ({ input }) => {
          try { return await db.getCollectionMonthlyReport(input.month); }
          catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le rapport mensuel est indisponible." }); }
        }),
    }),
    clientPortal: router({
      overview: protectedProcedure.query(({ ctx }) => db.getClientPortalOverview(ctx.user.email)),
      invoice: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getClientPortalInvoice(ctx.user.email, input.id)),
      quote: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getClientPortalQuote(ctx.user.email, input.id)),
      respondToQuote: protectedProcedure
        .input(z.object({
          documentId: z.number().int().positive(),
          decision: z.enum(["accepte", "refuse"]),
        }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.respondToClientPortalQuote({
              email: ctx.user.email,
              documentId: input.documentId,
              decision: input.decision,
              createdById: ctx.user.id,
            });
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error instanceof Error ? error.message : "La décision sur le devis n’a pas pu être enregistrée.",
            });
          }
        }),
      createPaymentPromise: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), promisedDate: dateText, note: z.string().trim().max(500).optional() })).mutation(({ ctx, input }) => db.createClientPaymentPromise({ ...input, email: ctx.user.email, createdById: ctx.user.id })),
      exportFile: protectedProcedure
        .input(z.object({ id: z.number().int().positive(), kind: z.enum(["facture", "devis"]), format: z.enum(["pdf", "docx"]) }))
        .mutation(async ({ ctx, input }) => {
          const document = input.kind === "facture"
            ? await db.getClientPortalInvoice(ctx.user.email, input.id)
            : await db.getClientPortalQuote(ctx.user.email, input.id);
          if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Ce document n\u2019est pas accessible depuis votre compte." });
          const company = await db.getCompanySettings();
          const payload = {
            kind: document.kind,
            number: document.number,
            issueDate: document.issueDate,
            validUntil: document.validUntil,
            dueDate: document.dueDate,
            clientName: document.clientName,
            contactName: document.contactName,
            clientAddress: document.clientAddress,
            clientEmail: document.clientEmail,
            clientIdentityKind: document.clientIdentityKind,
            clientTaxId: document.clientTaxId,
            clientRegistrationNumber: document.clientRegistrationNumber,
            projectName: document.projectName,
            notes: document.notes,
            discountPercent: document.discountPercent,
            discountAmount: document.discountAmount,
            depositPercent: document.depositPercent,
            depositDueDate: document.depositDueDate,
            balanceDueDate: document.balanceDueDate,
            paidAmount: document.paidAmount,
            balanceDue: document.balanceDue,
            subtotal: document.subtotal,
            taxTotal: document.taxTotal,
            total: document.total,
            lines: document.lines,
          };
          if (input.format === "docx") {
            const buf = await buildDocumentShareDocxBuffer(payload, company);
            return { filename: `${document.number}.docx`, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", base64: buf.toString("base64") };
          }
          const buf = await buildDocumentPdfBuffer({ document: payload, company });
          return { filename: `${document.number}.pdf`, mime: "application/pdf", base64: buf.toString("base64") };
        }),
      exportFileFromHtml: protectedProcedure
        .input(z.object({ id: z.number().int().positive(), kind: z.enum(["facture", "devis"]), html: z.string().min(1).max(2_000_000), slogan: z.string().max(300), legalLine: z.string().max(500) }))
        .mutation(async ({ ctx, input }) => {
          const document = input.kind === "facture"
            ? await db.getClientPortalInvoice(ctx.user.email, input.id)
            : await db.getClientPortalQuote(ctx.user.email, input.id);
          if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Ce document n’est pas accessible depuis votre compte." });
          const buf = await renderHtmlToPdfBuffer(input.html, { slogan: input.slogan, legalLine: input.legalLine });
          return { filename: `${document.number}.pdf`, mime: "application/pdf", base64: buf.toString("base64") };
        }),
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
                const candidates = await pickLLMModelCandidates(models);
                const result = await invokeLLMWithFallback({
                  max_tokens: 1200,
                  messages: [
                    { role: "system", content: "Tu es le Copilote de marge et recouvrement de Lucepress, entreprise guineenne de BTP, forage et services durables. Analyse seulement les faits du contexte JSON fourni. Redige en francais une aide interne claire, breve et structuree. Ne fabrique aucun montant, client, echeance, statut, promesse, regle ou action realisee. Les chiffres restent des references a verifier dans l'application. Priorise les promesses echues, les retards, puis les marges realisees sous seuil. Propose uniquement des controles ou des brouillons de relance a faire approuver. Ne pretends jamais qu'un message a ete envoye, qu'un paiement a ete recu ou qu'une modification a ete appliquee. Signale explicitement les donnees insuffisantes." },
                    { role: "user", content: JSON.stringify(context) },
                  ],
                  response_format: { type: "json_schema", json_schema: agentCopilotResponseSchema },
                },
          candidates);
                const content = result.choices[0]?.message.content;
                if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le briefing IA est indisponible. Reessayez dans un instant." });
                try { return { briefing: JSON.parse(content) as { summary: string; marginAlerts: string[]; collectionPriorities: string[]; suggestedActions: string[]; dataToVerify: string[]; sourceReferences: string[] }, requiresReview: true, model: result.model }; }
                catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le briefing IA ne peut pas etre lu. Reessayez dans un instant." }); }
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
      list: staffProcedure.query(() => db.listServices()),
      create: staffProcedure
        .input(z.object({ code: z.string().trim().min(2).max(50), name: z.string().trim().min(2).max(180), category: z.enum(SERVICE_CATEGORIES), description: optionalText, unit: z.string().trim().min(1).max(30), defaultUnitPrice: z.number().int().min(0).max(9_000_000_000), defaultTaxRate: z.number().int().min(0).max(100) }))
        .mutation(({ input }) => db.createService(input)),
      updateTariff: staffProcedure
        .input(z.object({ id: z.number().int().positive(), defaultUnitPrice: z.number().int().min(0).max(9_000_000_000), defaultTaxRate: z.number().int().min(0).max(100) }))
        .mutation(({ ctx, input }) => db.updateServiceTariff({ ...input, changedById: ctx.user.id })),
      priceHistory: staffProcedure
        .input(z.object({ serviceId: z.number().int().positive() }))
        .query(({ input }) => db.listServicePriceRevisions(input.serviceId)),
      priceHistoryExport: staffProcedure
        .query(() => db.listAllServicePriceRevisions()),
    }),
    documents: router({
      list: staffProcedure.input(z.object({ kind: z.enum(["devis", "facture"]).optional() }).optional()).query(({ input }) => db.listDocuments(input?.kind)),
      get: staffProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getDocumentById(input.id)),
      create: staffProcedure
        .input(z.object({ kind: z.enum(["devis", "facture"]), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), relatedDocumentId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES).optional(), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, isAiDraft: z.boolean().optional(), lines: z.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema).and(quoteDiscountSchema))
        .mutation(({ ctx, input }) => db.createDocument({ ...input, createdById: ctx.user.id, lines: input.lines as EditableDocumentLine[] })),
      update: staffProcedure
        .input(z.object({ id: z.number().int().positive(), clientId: z.number().int().positive(), projectId: z.number().int().positive().optional(), status: z.enum(DOCUMENT_STATUSES), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, expectedUpdatedAt: z.string().min(10).max(40).optional(), lines: z.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema).and(quoteDiscountSchema))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.updateDocument({ ...input, updatedById: ctx.user.id, lines: input.lines as EditableDocumentLine[] });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Le document n’a pas pu être enregistré.";
            throw new TRPCError({ code: message.includes("modifié ailleurs") ? "CONFLICT" : "BAD_REQUEST", message });
          }
        }),
      updateStatus: staffProcedure
        .input(z.object({ id: z.number().int().positive(), status: z.enum(DOCUMENT_STATUSES) }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.updateDocumentStatus(input.id, input.status, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le statut n’a pas pu être mis à jour." });
          }
        }),
      delete: staffProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.deleteDocument(input.id, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le document n’a pas pu être supprimé." });
          }
        }),
      createDepositInvoice: staffProcedure
        .input(z.object({ quoteId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.createDepositInvoiceFromQuote(input.quoteId, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture d’acompte ne peut pas être générée." });
          }
        }),
      createBalanceInvoice: staffProcedure
        .input(z.object({ depositInvoiceId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.createBalanceInvoiceFromDeposit(input.depositInvoiceId, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture de solde ne peut pas être générée." });
          }
        }),
      createInvoiceFromQuote: staffProcedure
        .input(z.object({ quoteId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await db.createInvoiceFromQuote(input.quoteId, ctx.user.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture ne peut pas être générée depuis ce devis." });
          }
        }),
      /**
       * Envoie le devis/facture au client par SMTP (templates quote-sent / invoice-sent).
       * Passe le statut à « envoye » si l’envoi réussit.
       */
      sendByEmail: staffProcedure
        .input(z.object({
          id: z.number().int().positive(),
          to: z.string().email().max(320).optional(),
          attachPdf: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (!isMailConfigured()) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "SMTP non configuré. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS.",
            });
          }
          const document = await db.getDocumentById(input.id);
          if (!document) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
          }
          const to = (input.to ?? document.clientEmail ?? "").trim();
          if (!to) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Aucune adresse e-mail client. Renseignez l’e-mail sur la fiche client ou indiquez un destinataire.",
            });
          }

          const company = await db.getCompanySettings();
          const origin = getRequestOrigin(ctx.req);
          const share = await db.issueDocumentShareLink({
            documentId: document.id,
            recipientEmail: to,
            createdById: ctx.user.id,
            validUntil: document.validUntil,
            dueDate: document.dueDate,
          });
          const documentLink = `${origin}/d/${share.token}`;
          const pdfDownloadLink = `${origin}/api/d/${share.token}.pdf`;
          const amount = new Intl.NumberFormat("fr-GN").format(document.total);
          const dueDate = document.dueDate
            ? new Date(document.dueDate).toLocaleDateString("fr-FR")
            : "—";
          const validUntil = document.validUntil
            ? new Date(document.validUntil).toLocaleDateString("fr-FR")
            : "—";
          const slug = document.kind === "facture" ? "invoice-sent" : "quote-sent";
          const variables: Record<string, string> = {
            clientName: document.contactName || document.clientName || "Client",
            documentNumber: document.number,
            amount,
            dueDate,
            validUntil,
            documentLink,
            pdfDownloadLink,
            companyEmail: company?.email || LUCEPRES_PUBLIC_PROFILE.email,
            organization: company?.legalName || LUCEPRES_PUBLIC_PROFILE.legalName,
            paymentMethod: "selon les modalités indiquées sur le document",
            linkExpiresAt: share.expiresAt.toLocaleDateString("fr-FR"),
          };

          const rendered = await db.renderEmailTemplate(slug, variables);
          if (!rendered?.html && !rendered?.text) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Modèle e-mail « ${slug} » introuvable.`,
            });
          }

          const attachments = input.attachPdf === false ? undefined : [{
            filename: `${document.number}.pdf`,
            content: await buildDocumentPdfBuffer({
              document: {
                kind: document.kind,
                number: document.number,
                issueDate: document.issueDate,
                validUntil: document.validUntil,
                dueDate: document.dueDate,
                clientName: document.clientName,
                contactName: document.contactName,
                clientAddress: document.clientAddress,
                clientEmail: document.clientEmail,
                clientIdentityKind: document.clientIdentityKind,
                clientTaxId: document.clientTaxId,
                clientRegistrationNumber: document.clientRegistrationNumber,
                projectName: document.projectName,
                notes: document.notes,
                discountPercent: document.discountPercent,
                discountAmount: document.discountAmount,
                depositPercent: document.depositPercent,
                depositDueDate: document.depositDueDate,
                balanceDueDate: document.balanceDueDate,
                paidAmount: document.paidAmount,
                balanceDue: document.balanceDue,
                subtotal: document.subtotal,
                taxTotal: document.taxTotal,
                total: document.total,
                lines: document.lines,
              },
              company,
            }),
            contentType: "application/pdf",
          }];

          if (document.status === "brouillon" || document.status === "a_envoyer") {
            await db.updateDocumentStatus(document.id, "envoye", ctx.user.id);
          }

          try {
            await sendMail({
              to,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
              attachments,
            });
          } catch (error) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: error instanceof Error ? error.message : "Échec d’envoi de l’e-mail.",
            });
          }

          await db.createClientActivity({
            clientId: document.clientId,
            documentId: document.id,
            type: "email_envoye",
            title: `${document.kind === "facture" ? "Facture" : "Devis"} envoyé par e-mail`,
            description: `${document.number} → ${to} · lien guest`,
            createdById: ctx.user.id,
          });

          return {
            success: true,
            emailed: true,
            to,
            documentLink,
            attachPdf: Boolean(attachments?.length),
            status: "envoye" as const,
          };
        }),
      exportFile: staffProcedure
        .input(z.object({ id: z.number().int().positive(), format: z.enum(["pdf", "docx"]) }))
        .mutation(async ({ input }) => {
          const document = await db.getDocumentById(input.id);
          if (!document) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
          }
          const company = await db.getCompanySettings();
          const payload = {
            kind: document.kind,
            number: document.number,
            issueDate: document.issueDate,
            validUntil: document.validUntil,
            dueDate: document.dueDate,
            clientName: document.clientName,
            contactName: document.contactName,
            clientAddress: document.clientAddress,
            clientEmail: document.clientEmail,
            clientIdentityKind: document.clientIdentityKind,
            clientTaxId: document.clientTaxId,
            clientRegistrationNumber: document.clientRegistrationNumber,
            projectName: document.projectName,
            notes: document.notes,
            discountPercent: document.discountPercent,
            discountAmount: document.discountAmount,
            depositPercent: document.depositPercent,
            depositDueDate: document.depositDueDate,
            balanceDueDate: document.balanceDueDate,
            paidAmount: document.paidAmount,
            balanceDue: document.balanceDue,
            subtotal: document.subtotal,
            taxTotal: document.taxTotal,
            total: document.total,
            lines: document.lines,
          };
          if (input.format === "docx") {
            const buf = await buildDocumentShareDocxBuffer(payload, company);
            return { filename: `${document.number}.docx`, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", base64: buf.toString("base64") };
          }
          const buf = await buildDocumentPdfBuffer({ document: payload, company });
          return { filename: `${document.number}.pdf`, mime: "application/pdf", base64: buf.toString("base64") };
        }),
      exportFileFromHtml: staffProcedure
        .input(z.object({ id: z.number().int().positive(), html: z.string().min(1).max(2_000_000), slogan: z.string().max(300), legalLine: z.string().max(500) }))
        .mutation(async ({ input }) => {
          const document = await db.getDocumentById(input.id);
          if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
          const buf = await renderHtmlToPdfBuffer(input.html, { slogan: input.slogan, legalLine: input.legalLine });
          return { filename: `${document.number}.pdf`, mime: "application/pdf", base64: buf.toString("base64") };
        }),
    }),
    payments: router({
      create: staffProcedure
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
      summarizeClientHistory: staffProcedure
        .input(z.object({ clientId: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          const client = await db.getClientById(input.clientId);
          if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client introuvable." });
          const history = await db.listClientActivities(input.clientId);
          const models = await listLLMModels();
          const candidates = await pickLLMModelCandidates(models);
          const result = await invokeLLMWithFallback({
            max_tokens: 1200,
            messages: [
              { role: "system", content: "Tu es l’assistant de suivi commercial de Lucepress, entreprise BTP et forage. À partir de l’historique fourni, rédige en français une synthèse brève et factuelle pour préparer le prochain échange avec le client. Ne fabrique aucun fait. Signale les éléments financiers ou commerciaux à vérifier et propose des prochaines étapes pragmatiques. Le résultat est une aide interne à relire, jamais un message envoyé au client." },
              { role: "user", content: JSON.stringify({ client: { nom: client.companyName, contact: client.contactName }, historique: history.slice(0, 50).map(event => ({ date: event.createdAt, type: event.type, titre: event.title, detail: event.description })) }) },
            ],
            response_format: { type: "json_schema", json_schema: clientHistorySummarySchema },
          },
          candidates);
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le résumé IA est indisponible. Réessayez dans un instant." });
          try { return { summary: JSON.parse(content) as { summary: string; attentionPoints: string[]; nextSteps: string[] }, requiresReview: true }; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le résumé IA ne peut pas être lu. Réessayez dans un instant." }); }
        }),
      generateReminder: staffProcedure
        .input(z.object({ documentId: z.number().int().positive(), tone: z.enum(["courtois", "ferme"]).default("courtois") }))
        .mutation(async ({ ctx, input }) => {
          const document = await db.getDocumentById(input.documentId);
          if (!document || document.kind !== "facture" || document.balanceDue <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "La relance doit concerner une facture avec un solde impayé." });
          const models = await listLLMModels();
          const candidates = await pickLLMModelCandidates(models);
          const result = await invokeLLMWithFallback({
            max_tokens: 1200,
            messages: [
              { role: "system", content: "Tu es l’assistant de recouvrement de Lucepress, entreprise guinéenne BTP et forage. Rédige en français un modèle d’e-mail de relance professionnel, factuel et prêt à relire, sans menaces ni affirmation juridique. Mentionne le numéro de facture, le montant du solde en GNF et l’échéance connue. Le résultat est un brouillon : ne prétends jamais que l’e-mail a été envoyé." },
              { role: "user", content: JSON.stringify({ ton: input.tone, facture: document.number, client: document.clientName, contact: document.contactName, email: document.clientEmail, echeance: document.dueDate, soldeGNF: document.balanceDue, dateEmission: document.issueDate }) },
            ],
            response_format: { type: "json_schema", json_schema: reminderResponseSchema },
          },
          candidates);
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le modèle de relance est indisponible. Réessayez dans un instant." });
          try {
            const reminder = JSON.parse(content) as { subject: string; greeting: string; body: string; closing: string; tone: string };
            await db.createClientActivity({ clientId: document.clientId, documentId: document.id, type: "relance_preparee", title: `Relance ${reminder.tone || input.tone} préparée`, description: reminder.subject, createdById: ctx.user.id });
            return { reminder, requiresReview: true };
          } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le modèle de relance ne peut pas être lu. Réessayez dans un instant." }); }
        }),
      /**
       * Envoie une relance par SMTP (après relecture humaine).
       * WhatsApp volontairement non branché (sourdine démo).
       */
      sendReminderEmail: staffProcedure
        .input(reminderEmailInputSchema)
        .mutation(async ({ ctx, input }) => {
          if (!isMailConfigured()) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "SMTP non configuré. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS.",
            });
          }
          return dispatchReminderEmail(input, ctx.user.id);
        }),
      /**
       * Envoie un lot de relances déjà relu (Créances). Continue en cas d’échec partiel.
       */
      sendBatchReminderEmails: staffProcedure
        .input(z.object({
          reminders: z.array(reminderEmailInputSchema.omit({ to: true })).min(1).max(BATCH_REMINDER_LIMIT),
        }))
        .mutation(async ({ ctx, input }) => {
          if (!isMailConfigured()) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "SMTP non configuré. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS.",
            });
          }
          const sent: Array<{ documentId: number; to: string }> = [];
          const failed: Array<{ documentId: number; error: string }> = [];
          for (const reminder of input.reminders) {
            try {
              const result = await dispatchReminderEmail(reminder, ctx.user.id);
              sent.push({ documentId: result.documentId, to: result.to });
            } catch (error) {
              failed.push({
                documentId: reminder.documentId,
                error: error instanceof TRPCError ? error.message : error instanceof Error ? error.message : "Échec d’envoi.",
              });
            }
          }
          return {
            sent,
            failed,
            sentCount: sent.length,
            failedCount: failed.length,
          } as const;
        }),
      prepareBatchReminders: staffProcedure
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
          const candidates = await pickLLMModelCandidates(models);
          const result = await invokeLLMWithFallback({
            max_tokens: 1200,
            messages: [
              { role: "system", content: "Tu es l’assistant de recouvrement de Lucepress, entreprise guinéenne BTP et forage. Prépare un brouillon d’e-mail distinct et personnalisé pour chaque facture fournie. Chaque texte doit être professionnel, factuel, sans menace ni affirmation juridique, et mentionner exactement le numéro de facture, le solde en GNF et l’échéance connue. Respecte l’instruction interne facultative seulement si elle est compatible avec ces faits. Ces contenus sont des brouillons internes : ne prétends jamais qu’un e-mail a été envoyé ou programmé. Retourne strictement une entrée par documentId fourni, sans en ajouter ni en omettre." },
              { role: "user", content: JSON.stringify({ ton: input.tone, instructionInterne: instruction ?? null, factures: invoices.map(invoice => ({ documentId: invoice.id, facture: invoice.number, client: invoice.clientName, contact: invoice.contactName, echeance: invoice.dueDate, soldeGNF: invoice.balanceDue, dateEmission: invoice.issueDate })) }) },
            ],
            response_format: { type: "json_schema", json_schema: batchReminderResponseSchema },
          },
          candidates);
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
      extractClient: staffProcedure
        .input(z.object({ text: z.string().trim().min(10).max(6000) }))
        .mutation(async ({ input }) => {
          const models = await listLLMModels();
          const candidates = await pickLLMModelCandidates(models);
          const result = await invokeLLMWithFallback({
            max_tokens: 1200,
            messages: [
              { role: "system", content: "Tu es l’assistant administratif de Lucepress. Extrais uniquement les coordonnées d’un prospect ou client contenues dans le texte fourni. Ne fabrique jamais une donnée absente : utilise une chaîne vide. companyName doit être le nom de l’entreprise, du particulier ou du client ; si aucun nom exploitable n’est mentionné, utilise 'Client à confirmer' et signale-le dans missingFields. NIF, RCCM et identifiants fiscaux sont facultatifs : ne les mets jamais dans missingFields. missingFields ne concerne que les coordonnées de contact vraiment utiles (e-mail, téléphone, adresse) si elles manquent. notes doit contenir seulement les précisions utiles au répertoire. La sortie est un brouillon à faire relire avant enregistrement." },
              { role: "user", content: input.text },
            ],
            response_format: { type: "json_schema", json_schema: clientExtractionResponseSchema },
          },
          candidates);
          const content = result.choices[0]?.message.content;
          if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "L’extraction IA est indisponible. Réessayez dans un instant." });
          try {
            const client = extractedClientSchema.parse(JSON.parse(content));
            return { client: { ...client, missingFields: omitOptionalPaperworkMissingFields(client.missingFields) }, requiresReview: true };
          } catch {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Les coordonnées extraites ne peuvent pas être lues. Réessayez dans un instant." });
          }
        }),
      proposeQuote: staffProcedure
        .input(z.object({ description: z.string().trim().min(20).max(6000), projectType: z.enum(["btp", "forage", "mixte"]).optional(), taxRate: z.number().int().min(0).max(100).default(0) }))
        .mutation(async ({ input }) => {
          const catalog = await db.listServices();
          const models = await listLLMModels();
          const candidates = await pickLLMModelCandidates(models);
          const serviceContext = catalog.map(service => ({ code: service.code, name: service.name, unit: service.unit, unitPrice: service.defaultUnitPrice, taxRate: service.defaultTaxRate })).slice(0, 80);
          const result = await invokeLLMWithFallback({
            max_tokens: 1200,
            messages: [
              { role: "system", content: "Tu es l’assistant commercial de Lucepress, entreprise guinéenne BTP et forage. À partir d’une simple description de chantier, prépare un devis complet, structuré et prêt à relire en français. Déduis le domaine, le périmètre, les étapes, les prestations, les hypothèses, la durée d’exécution, les conditions de paiement et une durée de validité raisonnable. Il s’agit toujours d’un brouillon à faire relire : ne prétends jamais qu’il est validé. Réutilise le catalogue fourni quand il correspond. Si un prix fiable n’est pas présent dans le catalogue, utilise 0 comme prix unitaire et mentionne explicitement la vérification requise dans note, technicalNotes et assumptions. Tous les montants sont des entiers en francs guinéens (GNF). Les lignes doivent être exhaustives mais ne dois pas inventer de prix." },
              { role: "user", content: JSON.stringify({ besoin: input.description, domaine: input.projectType ?? "non précisé", tauxTaxeParDefaut: input.taxRate, cataloguePrestations: serviceContext }) },
            ],
            response_format: { type: "json_schema", json_schema: proposalSchema },
          },
          candidates);
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
