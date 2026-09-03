import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { currentTenant, runWithTenant } from "./_core/tenantContext";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import {
  agentAuditLogs,
  agentCampaigns,
  agentDelegations,
  agentMessageJobs,
  agentOperatorGrants,
  agentTestEmailDeliveries,
  clients,
  clientActivities,
  clientAttachments,
  companySettings,
  documentLines,
  documentShareLinks,
  documents,
  documentSequences,
  emailTemplates,
  integrationAuditLogs,
  integrationCapabilities,
  integrationConnections,
  integrationJobs,
  integrationOauthSessions,
  integrationProviders,
  integrationWebhookEvents,
  InsertUser,
  invitations,
  passwordResets,
  payments,
  paymentPromises,
  projectCostAttachments,
  projectCosts,
  projects,
  servicePriceRevisions,
  services,
  users,
} from "../drizzle/schema";
import { calculateDocumentTotals, calculatePaymentBalance, formatDocumentNumber, initialDocumentStatus, invoicePaymentStatus, isInvoiceOverdue, summarizeDashboard, type DocumentKind, type DocumentStatus, type EditableDocumentLine, type PaymentMethod } from "../shared/billing";
import type { AppRole } from "../shared/roles";
import { normalizeIdentityKind, type IdentityKind } from "../shared/identityPaperwork";
import type { ClientActivityType } from "../shared/clientActivityTypes";
import {
  computeDocumentShareExpiry,
  createDocumentShareToken,
  GUEST_DOCUMENT_INVALID_MESSAGE,
  hashDocumentShareToken,
  isPlausibleDocumentShareToken,
} from "../shared/documentShare";
import { findPotentialClientDuplicates, type ClientDuplicateCandidate } from "../shared/clientDuplicates";
import { buildClientActivityTimeline } from "../shared/clientActivityTimeline";
import { LUCEPRES_PUBLIC_PROFILE } from "../shared/companyProfile";
import { calculateDepositInvoiceAmount } from "../shared/depositInvoice";
import { assertDepositInvoiceIsFullyPaid, calculateBalanceInvoiceAmount, reuseExistingGeneratedInvoice } from "../shared/balanceInvoice";
import { calculateDocumentDiscount } from "../shared/discounts";
import { getMissingDefaultServices, type ServiceCategory } from "../shared/defaultServices";
import { getIntegrationAdapterPreparation } from "../shared/integrationAdapterPreparation";
import { DEFAULT_INTEGRATION_PROVIDERS, parseGrantedScopes } from "../shared/integrationRegistry";
import { buildGoogleWorkspaceAuthorizationUrl, normalizeGoogleWorkspaceScopes } from "../shared/googleWorkspaceOAuth";
import { resolveIntegrationAdapter } from "./integrations/adapterRegistry";
import { assertOpaqueIntegrationSecretReference, createPreparedIntegrationConnectionValues } from "./integrations/connectionSecurity";
import { getIntegrationSecretConfiguration, requireIntegrationSecret } from "./integrations/secretConfiguration";
import { calculateProjectMargin } from "../shared/projectFinancials";
import { summarizeReceivables } from "../shared/receivables";
import { collectionFollowUpLabels, collectionMonthBounds, isCollectionReportMonth, normalizeCollectionReminderDate, validateCollectionReminder, type CollectionFollowUpStatus } from "../shared/collectionFollowUp";
import { buildWorkspaceSearchResults, type WorkspaceSearchFilters } from "../shared/workspaceSearch";
import { createAgentMessageDraft, getDelegationPolicyErrors, isCampaignEligibleForSimulation, requiresSecondApproval, type AgentChannel, type AgentPurpose, type AgentTone } from "../shared/agentDelegationPolicy";
import { isConcurrentDocumentUpdate } from "../shared/documentConcurrency";
import { ENV } from "./_core/env";
import { createHash, randomBytes } from "node:crypto";
import { parseDatabasePoolSize } from "./_core/dbPool";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (_pool) {
        try { await _pool.end(); } catch {}
      }
      _pool = createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: parseDatabasePoolSize(process.env.DATABASE_POOL_SIZE),
        connectTimeout: 10000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000,
        charset: "utf8mb4",
      });
      _db = drizzle(_pool) as unknown as ReturnType<typeof drizzle>;
      // Test the connection
      await _pool.query("SELECT 1");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export async function pingDatabase() {
  try {
    const db = await getDb();
    if (!db || !_pool) return false;
    await _pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("La base de données Lucepress est indisponible.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string, tenantId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const filter = tenantId != null
    ? and(eq(users.email, email), eq(users.tenantId, tenantId))
    : eq(users.email, email);
  const result = await db.select().from(users).where(filter).limit(1);
  return result[0];
}

export async function createLocalUser(input: {
  email: string;
  passwordHash: string;
  name?: string | null;
  /**
   * Rôle explicite. Volontairement OBLIGATOIRE côté appelant : cette fonction
   * forçait auparavant `role: "admin"` en dur, ce qui donnait les pleins droits
   * à tout compte créé via `auth.register` (procédure publique).
   */
  role: AppRole;
  tenantId?: number;
}): Promise<{ id: number; openId: string }> {
  const db = await requireDb();
  const openId = `local_${randomBytes(12).toString("hex")}`;
  const result = await db.insert(users).values({
    openId,
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name ?? null,
    loginMethod: "email",
    role: input.role,
    tenantId: input.tenantId ?? 1,
    lastSignedIn: new Date(),
  } as any);
  return { id: Number(result[0].insertId), openId };
}

/**
 * Nombre de comptes réellement utilisables en auth locale (donc pourvus d'un mot
 * de passe). Sert au garde-fou d'amorçage de `auth.register` : l'inscription
 * libre n'est ouverte que tant qu'aucun compte local n'existe.
 *
 * On ne compte QUE les comptes avec `passwordHash`, car la base contient des
 * lignes héritées de l'ancien OAuth (sans mot de passe) qui, sinon, bloqueraient
 * définitivement la création du premier compte.
 */
export async function countUsersWithPassword(): Promise<number> {
  const db = await requireDb();
  const result = await db
    .select({ value: sql<number>`count(*)` })
    .from(users)
    .where(sql`${users.passwordHash} is not null`);
  return Number(result[0]?.value ?? 0);
}

export async function setUserPasswordHash(userId: number, passwordHash: string): Promise<void> {
  const db = await requireDb();
  await db.update(users).set({ passwordHash }).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
}

/**
 * Liste des comptes de l'instance (gestion des collaborateurs).
 * Retourne des champs sûrs : jamais le hash du mot de passe.
 */
export async function listUsers(): Promise<
  Array<{ id: number; openId: string; name: string | null; email: string | null; role: AppRole; loginMethod: string | null; lastSignedIn: Date; createdAt: Date }>
> {
  const db = await requireDb();
  return db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      loginMethod: users.loginMethod,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, currentTenant()))
    .orderBy(asc(users.name), asc(users.email));
}

/** Change le rôle d'un compte (admin -> user ou user -> admin). */
export async function setUserRole(userId: number, role: AppRole): Promise<void> {
  const db = await requireDb();
  await db.update(users).set({ role }).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
}

/**
 * Réinitialise le mot de passe d'un compte sans connaître l'ancien.
 * Utilisé par un admin qui aide un collaborateur bloqué. Le nouveau mot de passe
 * est fourni déjà haché par l'appelant (scrypt, cf. `_core/password`).
 */
export async function resetUserPassword(userId: number, passwordHash: string): Promise<void> {
  const db = await requireDb();
  await db.update(users).set({ passwordHash, loginMethod: "email" }).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
}

/**
 * Supprime un compte (révocation d'un collaborateur).
 * GARDE-FOU : interdit de supprimer le tout dernier compte admin, sinon
 * l'instance se retrouverait sans aucun administrateur (porte close).
 */
export async function deleteUser(userId: number): Promise<{ deleted: boolean; reason?: string }> {
  const db = await requireDb();
  const [cible] = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant()))).limit(1);
  if (!cible) return { deleted: false, reason: "compte_introuvable" };

  if (cible.role === "admin") {
    const [restant] = await db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, "admin"), sql`${users.passwordHash} is not null`));
    if (Number(restant?.value ?? 0) <= 1) {
      return { deleted: false, reason: "dernier_admin" };
    }
  }

  await db.delete(users).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
  return { deleted: true };
}

/* ------------------------------------------------------------------ */
/* Invitations par e-mail (token + lien sécurisé, admin ne tape pas mdp) */
/* ------------------------------------------------------------------ */

/** Durée de validité d'un lien d'invitation (72h). */
export const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

export type NewInvitation = {
  tokenHash: string;
  email: string;
  role: AppRole;
  invitedBy: number;
  tenantId?: number;
};

export async function createInvitation(input: NewInvitation): Promise<{ id: number }> {
  const db = await requireDb();
  const [row] = await db
    .insert(invitations)
    .values({
      tenantId: input.tenantId ?? currentTenant(),
      tokenHash: input.tokenHash,
      email: input.email,
      role: input.role,
      invitedBy: input.invitedBy,
      status: "pending",
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    })
    .$returningId();
  return { id: row.id };
}

export async function getInvitationByTokenHash(
  tokenHash: string
): Promise<typeof invitations.$inferSelect | undefined> {
  const db = await requireDb();
  const [row] = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
  return row;
}

/**
 * Résultat de la recherche d'un token d'invitation.
 * - invitation + reason "pending" : invitation valide, peut être acceptée
 * - reason "expired" : invitation trouvée mais expirée
 * - reason "already_accepted" : invitation déjà utilisée
 * - reason "revoked" : invitation révoquée par un admin
 * - reason "not_found" : le token ne correspond à aucune invitation
 */
export type InvitationSearchResult = {
  invitation?: typeof invitations.$inferSelect;
  reason: "pending" | "expired" | "already_accepted" | "revoked" | "not_found";
};

/**
 * Recherche une invitation par token (hash scrypt) SANS filtre tenant.
 * Utilisé pour acceptInvitation (procédure publique — pas encore authentifié).
 * Le token est unique (contrainte DB), pas de risque de fuite inter-tenant.
 */
export async function findInvitationByToken(
  token: string
): Promise<InvitationSearchResult> {
  const db = await requireDb();
  const { verifyPassword } = await import("./_core/password");
  const all = await db.select().from(invitations);
  console.log(`[DEBUG_FIND] token received: ${token} (length: ${token.length}) pending invitations: ${all.filter(i => i.status === "pending").length}`);
  for (const inv of all) {
    const ok = await verifyPassword(token, inv.tokenHash);
    console.log(`[DEBUG_FIND] verify ${inv.email}: ${ok} (status: ${inv.status}, expires: ${inv.expiresAt.toISOString()})`);
    if (!ok) continue;
    // Le token correspond à cette invitation
    if (inv.status === "accepted") return { invitation: inv, reason: "already_accepted" };
    if (inv.status === "revoked") return { invitation: inv, reason: "revoked" };
    if (inv.expiresAt.getTime() <= Date.now()) return { invitation: inv, reason: "expired" };
    return { invitation: inv, reason: "pending" };
  }
  return { reason: "not_found" };
}

export async function markInvitationAccepted(tokenHash: string, acceptedByUser: number): Promise<void> {
  const db = await requireDb();
  await db
    .update(invitations)
    .set({ status: "accepted", acceptedAt: new Date(), acceptedByUser })
    .where(eq(invitations.tokenHash, tokenHash));
}

export async function revokeInvitation(id: number): Promise<void> {
  const db = await requireDb();
  await db.update(invitations).set({ status: "revoked" }).where(and(eq(invitations.id, id), eq(invitations.tenantId, currentTenant())));
}

export async function listInvitations(): Promise<(typeof invitations.$inferSelect)[]> {
  const db = await requireDb();
  return db.select().from(invitations).where(eq(invitations.tenantId, currentTenant())).orderBy(desc(invitations.createdAt));
}

export async function deleteInvitation(id: number): Promise<void> {
  const db = await requireDb();
  await db.delete(invitations).where(and(eq(invitations.id, id), eq(invitations.tenantId, currentTenant())));
}

/* ------------------------------------------------------------------ */
/* Réinitialisation mot de passe (flux "Mot de passe oublié")           */
/* ------------------------------------------------------------------ */

/** Durée de validité d'un lien de réinitialisation (1h). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export async function createPasswordReset(input: {
  userId: number;
  tokenHash: string;
  tenantId?: number;
}): Promise<{ id: number }> {
  const db = await requireDb();
  // Invalider les anciens resets non utilisés pour cet utilisateur
  await db.update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.userId, input.userId), sql`${passwordResets.usedAt} IS NULL`));
  
  const [row] = await db
    .insert(passwordResets)
    .values({
      tenantId: input.tenantId ?? currentTenant(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    })
    .$returningId();
  return { id: row.id };
}

/**
 * Recherche un reset par token (hash scrypt) SANS filtre tenant.
 * Retourne le reset valide (non utilisé, non expiré) ou undefined.
 */
export async function findPasswordResetByToken(
  token: string
): Promise<typeof passwordResets.$inferSelect | undefined> {
  const db = await requireDb();
  const { verifyPassword } = await import("./_core/password");
  const all = await db.select().from(passwordResets);
  for (const reset of all) {
    if (reset.usedAt) continue;
    if (reset.expiresAt.getTime() <= Date.now()) continue;
    const ok = await verifyPassword(token, reset.tokenHash);
    if (ok) return reset;
  }
  return undefined;
}

export async function markPasswordResetUsed(resetId: number): Promise<void> {
  const db = await requireDb();
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, resetId));
}

export async function listClients() {
  const db = await requireDb();
  return db.select().from(clients).where(eq(clients.tenantId, currentTenant())).orderBy(asc(clients.companyName));
}

export async function listCollectionAssignees() {
  const db = await requireDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.tenantId, currentTenant())).orderBy(asc(users.name));
}

export async function getClientById(id: number) {
  const db = await requireDb();
  const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.tenantId, currentTenant()))).limit(1);
  return result[0];
}

export async function createClient(input: {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  identityKind?: IdentityKind;
  registrationNumber?: string;
  notes?: string;
  defaultDiscountPercent?: number;
}) {
  const db = await requireDb();
  const result = await db.insert(clients).values({ tenantId: currentTenant(),
    companyName: input.companyName,
    contactName: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    taxId: input.taxId || null,
    identityKind: normalizeIdentityKind(input.identityKind),
    registrationNumber: input.registrationNumber || null,
    notes: input.notes || null,
    defaultDiscountPercent: input.defaultDiscountPercent ?? 0,
  });
  return { id: Number(result[0].insertId) };
}

export type ClientInput = {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  identityKind?: IdentityKind;
  registrationNumber?: string;
  notes?: string;
  defaultDiscountPercent?: number;
};

export async function updateClient(id: number, input: ClientInput) {
  const db = await requireDb();
  await db.update(clients).set({
    companyName: input.companyName,
    contactName: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    taxId: input.taxId || null,
    identityKind: normalizeIdentityKind(input.identityKind),
    registrationNumber: input.registrationNumber || null,
    notes: input.notes || null,
    defaultDiscountPercent: input.defaultDiscountPercent ?? 0,
  }).where(and(eq(clients.id, id), eq(clients.tenantId, currentTenant())));
  return { success: true };
}

export async function findClientDuplicates(input: ClientDuplicateCandidate, excludedId?: number) {
  const existing = await listClients();
  return findPotentialClientDuplicates(existing, input, excludedId).map(match => ({
    id: match.client.id,
    companyName: match.client.companyName,
    contactName: match.client.contactName,
    email: match.client.email,
    phone: match.client.phone,
    reasons: match.reasons,
  }));
}

export async function listClientAttachments(clientId: number) {
  const db = await requireDb();
  return db.select().from(clientAttachments).where(and(eq(clientAttachments.clientId, clientId), eq(clientAttachments.tenantId, currentTenant()))).orderBy(desc(clientAttachments.createdAt));
}

export async function createClientAttachment(input: { clientId: number; fileName: string; contentType: string; size: number; storageKey: string; storageUrl: string; createdById: number }) {
  const db = await requireDb();
  const result = await db.insert(clientAttachments).values({ ...input, tenantId: currentTenant() });
  return { id: Number(result[0].insertId) };
}

export async function createClientActivity(input: { clientId: number; documentId?: number; type: ClientActivityType; title: string; description?: string; createdById: number }) {
  const db = await requireDb();
  const result = await db.insert(clientActivities).values({ tenantId: currentTenant(), ...input, documentId: input.documentId ?? null, description: input.description ?? null });
  return { id: Number(result[0].insertId) };
}

export async function listStaffAuditJournal(input?: { limit?: number; type?: ClientActivityType }) {
  const db = await requireDb();
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);
  const conditions = [eq(clientActivities.tenantId, currentTenant())];
  if (input?.type) conditions.push(eq(clientActivities.type, input.type));
  return db
    .select({
      id: clientActivities.id,
      type: clientActivities.type,
      title: clientActivities.title,
      description: clientActivities.description,
      createdAt: clientActivities.createdAt,
      clientId: clients.id,
      clientName: clients.companyName,
      documentId: documents.id,
      documentNumber: documents.number,
      actorId: users.id,
      actorName: users.name,
    })
    .from(clientActivities)
    .innerJoin(clients, and(eq(clientActivities.clientId, clients.id), eq(clients.tenantId, currentTenant())))
    .leftJoin(documents, and(eq(clientActivities.documentId, documents.id), eq(documents.tenantId, currentTenant())))
    .leftJoin(users, eq(clientActivities.createdById, users.id))
    .where(and(...conditions))
    .orderBy(desc(clientActivities.createdAt))
    .limit(limit);
}

const GUEST_HIDDEN_STATUSES = new Set(["brouillon", "annule"]);

export async function revokeActiveDocumentShareLinks(documentId: number) {
  const db = await requireDb();
  await db
    .update(documentShareLinks)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(documentShareLinks.documentId, documentId),
      eq(documentShareLinks.tenantId, currentTenant()),
      sql`${documentShareLinks.revokedAt} IS NULL`,
    ));
}

export async function issueDocumentShareLink(input: {
  documentId: number;
  recipientEmail?: string | null;
  createdById: number;
  validUntil?: Date | string | null;
  dueDate?: Date | string | null;
}) {
  const db = await requireDb();
  await revokeActiveDocumentShareLinks(input.documentId);
  const token = createDocumentShareToken();
  const tokenHash = hashDocumentShareToken(token);
  const expiresAt = computeDocumentShareExpiry({
    validUntil: input.validUntil,
    dueDate: input.dueDate,
  });
  await db.insert(documentShareLinks).values({
    tenantId: currentTenant(),
    documentId: input.documentId,
    tokenHash,
    recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
    createdById: input.createdById,
    expiresAt,
  });
  return { token, expiresAt };
}

async function loadGuestDocumentPayload(documentId: number, tenantId: number) {
  return runWithTenant(tenantId, async () => {
    const document = await getDocumentById(documentId);
    if (!document) return null;
    if (GUEST_HIDDEN_STATUSES.has(document.status)) return null;
    const company = await getCompanySettings();
    return {
      document: {
        id: document.id,
        kind: document.kind,
        number: document.number,
        status: document.status,
        issueDate: document.issueDate,
        dueDate: document.dueDate,
        validUntil: document.validUntil,
        depositPercent: document.depositPercent,
        depositDueDate: document.depositDueDate,
        balanceDueDate: document.balanceDueDate,
        discountPercent: document.discountPercent,
        discountAmount: document.discountAmount,
        subtotal: document.subtotal,
        taxTotal: document.taxTotal,
        total: document.total,
        notes: document.notes,
        clientName: document.clientName,
        contactName: document.contactName,
        clientAddress: document.clientAddress,
        projectName: document.projectName,
        lines: document.lines.map(line => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          lineTotal: line.lineTotal,
        })),
        paidAmount: document.paidAmount,
        balanceDue: document.balanceDue,
        canRespond: document.kind === "devis" && document.status === "envoye",
      },
      company: {
        legalName: company.legalName,
        legalAddress: company.legalAddress,
        phone: company.phone,
        email: company.email,
        website: company.website,
        identityKind: company.identityKind,
        taxId: company.taxId,
        registrationNumber: company.registrationNumber,
        bankName: company.bankName,
        accountName: company.accountName,
        accountNumber: company.accountNumber,
        iban: company.iban,
        swift: company.swift,
        paymentInstructions: company.paymentInstructions,
        documentFooter: company.documentFooter,
      },
    };
  });
}

export async function getGuestDocumentByShareToken(token: string) {
  if (!isPlausibleDocumentShareToken(token)) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  const db = await requireDb();
  const tokenHash = hashDocumentShareToken(token.trim().toLowerCase());
  const [link] = await db.select().from(documentShareLinks).where(eq(documentShareLinks.tokenHash, tokenHash)).limit(1);
  if (!link || link.revokedAt || link.expiresAt.getTime() < Date.now()) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  const payload = await loadGuestDocumentPayload(link.documentId, link.tenantId);
  if (!payload) throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  await db.update(documentShareLinks).set({
    lastAccessAt: new Date(),
    accessCount: sql`${documentShareLinks.accessCount} + 1`,
  }).where(eq(documentShareLinks.id, link.id));
  return {
    ...payload,
    share: {
      expiresAt: link.expiresAt,
      recipientEmail: link.recipientEmail,
    },
  };
}

export async function respondToGuestQuoteByShareToken(input: {
  token: string;
  decision: "accepte" | "refuse";
}) {
  if (!isPlausibleDocumentShareToken(input.token)) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  const db = await requireDb();
  const tokenHash = hashDocumentShareToken(input.token.trim().toLowerCase());
  const [link] = await db.select().from(documentShareLinks).where(eq(documentShareLinks.tokenHash, tokenHash)).limit(1);
  if (!link || link.revokedAt || link.expiresAt.getTime() < Date.now()) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  return runWithTenant(link.tenantId, async () => {
    const document = await getDocumentById(link.documentId);
    if (!document || document.kind !== "devis") throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
    if (document.status !== "envoye") {
      throw new Error("Ce devis n’est plus en attente de votre réponse.");
    }
    if (document.validUntil) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validUntil = new Date(document.validUntil);
      validUntil.setHours(0, 0, 0, 0);
      if (validUntil < today) {
        throw new Error("Ce devis a expiré. Contactez Lucepres pour une mise à jour.");
      }
    }
    const actorId = link.createdById ?? undefined;
    await updateDocumentStatus(document.id, input.decision, actorId, {
      title: input.decision === "accepte" ? "Devis accepté via lien e-mail" : "Devis refusé via lien e-mail",
      description: `${document.number} · décision guest`,
    });
    if (!actorId) {
      await db.insert(clientActivities).values({
        tenantId: link.tenantId,
        clientId: document.clientId,
        documentId: document.id,
        type: "statut_document",
        title: input.decision === "accepte" ? "Devis accepté via lien e-mail" : "Devis refusé via lien e-mail",
        description: `${document.number} · décision guest`,
        createdById: null,
      });
    }
    return { success: true as const, status: input.decision, number: document.number };
  });
}

export async function listClientActivities(clientId: number) {
  const db = await requireDb();
  const [activities, clientDocuments, clientPayments] = await Promise.all([
    db.select().from(clientActivities).where(and(eq(clientActivities.clientId, clientId), eq(clientActivities.tenantId, currentTenant()))).orderBy(desc(clientActivities.createdAt)),
    db.select({ id: documents.id, kind: documents.kind, number: documents.number, total: documents.total, status: documents.status, createdAt: documents.createdAt }).from(documents).where(and(eq(documents.clientId, clientId), eq(documents.tenantId, currentTenant()))).orderBy(desc(documents.createdAt)),
    db.select({ id: payments.id, documentId: payments.documentId, documentNumber: documents.number, amount: payments.amount, method: payments.method, reference: payments.reference, paidAt: payments.paidAt, createdAt: payments.createdAt }).from(payments).innerJoin(documents, eq(payments.documentId, documents.id)).where(and(eq(documents.clientId, clientId), eq(documents.tenantId, currentTenant()))).orderBy(desc(payments.paidAt)),
  ]);
  return buildClientActivityTimeline(clientId, clientDocuments, activities, clientPayments);
}

export type CompanySettingsInput = {
  legalName: string;
  legalAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  identityKind?: IdentityKind;
  taxId?: string;
  registrationNumber?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  swift?: string;
  paymentInstructions?: string;
  documentFooter?: string;
};

const emptyCompanySettings = (): Omit<typeof companySettings.$inferSelect, "id"> & { id: number } => ({
  id: 0,
  tenantId: 1,
  legalName: LUCEPRES_PUBLIC_PROFILE.legalName,
  legalAddress: LUCEPRES_PUBLIC_PROFILE.location,
  phone: LUCEPRES_PUBLIC_PROFILE.phone,
  email: LUCEPRES_PUBLIC_PROFILE.email,
  website: null,
  identityKind: "immatriculee",
  taxId: null,
  registrationNumber: null,
  bankName: null,
  accountName: null,
  accountNumber: null,
  iban: null,
  swift: null,
  paymentInstructions: null,
  documentFooter: LUCEPRES_PUBLIC_PROFILE.documentFooter,
  updatedAt: new Date(),
});

function normalizeCompanySettings(input: CompanySettingsInput): typeof companySettings.$inferInsert {
  return {
    tenantId: currentTenant(),
    legalName: input.legalName,
    legalAddress: input.legalAddress || null,
    phone: input.phone || null,
    email: input.email || null,
    website: input.website || null,
    identityKind: normalizeIdentityKind(input.identityKind),
    taxId: input.taxId || null,
    registrationNumber: input.registrationNumber || null,
    bankName: input.bankName || null,
    accountName: input.accountName || null,
    accountNumber: input.accountNumber || null,
    iban: input.iban || null,
    swift: input.swift || null,
    paymentInstructions: input.paymentInstructions || null,
    documentFooter: input.documentFooter || null,
  };
}

export async function getCompanySettings() {
  const db = await requireDb();
  const result = await db.select().from(companySettings).where(eq(companySettings.tenantId, currentTenant())).limit(1);
  return result[0] ?? emptyCompanySettings();
}

export async function saveCompanySettings(input: CompanySettingsInput) {
  const db = await requireDb();
  const values = normalizeCompanySettings(input);
  const existing = await db.select({ id: companySettings.id }).from(companySettings).where(eq(companySettings.tenantId, currentTenant())).limit(1);
  if (existing[0]) await db.update(companySettings).set(values).where(and(eq(companySettings.id, existing[0].id), eq(companySettings.tenantId, currentTenant())));
  else await db.insert(companySettings).values(values);
  return getCompanySettings();
}

export async function listProjects() {
  const db = await requireDb();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      reference: projects.reference,
      type: projects.type,
      status: projects.status,
      location: projects.location,
      description: projects.description,
      plannedBudget: projects.plannedBudget,
      minimumMarginRate: projects.minimumMarginRate,
      clientId: projects.clientId,
      clientName: clients.companyName,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.tenantId, currentTenant())).orderBy(desc(projects.createdAt));
}

export async function createProject(input: {
  clientId: number;
  name: string;
  reference?: string;
  type: "btp" | "forage" | "mixte";
  location?: string;
  description?: string;
}) {
  const db = await requireDb();
  const result = await db.insert(projects).values({ tenantId: currentTenant(),
    ...input,
    reference: input.reference || null,
    location: input.location || null,
    description: input.description || null,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateProjectPlannedBudget(input: { id: number; plannedBudget: number }) {
  const db = await requireDb();
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant()))).limit(1);
  if (!project[0]) throw new Error("Le chantier sélectionné est introuvable.");
  await db.update(projects).set({ plannedBudget: input.plannedBudget }).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant())));
  return { success: true };
}

export async function updateProjectFinancialTargets(input: { id: number; plannedBudget: number; minimumMarginRate: number | null }) {
  const db = await requireDb();
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant()))).limit(1);
  if (!project[0]) throw new Error("Le chantier sélectionné est introuvable.");
  await db.update(projects).set({ plannedBudget: input.plannedBudget, minimumMarginRate: input.minimumMarginRate }).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant())));
  return { success: true };
}

export type ProjectCostInput = {
  projectId: number;
  category: "materiaux" | "main_oeuvre" | "transport" | "equipement" | "sous_traitance" | "autre";
  description: string;
  amount: number;
  incurredAt: string;
  createdById: number;
};

export async function listProjectCosts(projectId?: number) {
  const db = await requireDb();
  const query = db.select({
    id: projectCosts.id, projectId: projectCosts.projectId, projectName: projects.name, clientName: clients.companyName,
    category: projectCosts.category, description: projectCosts.description, amount: projectCosts.amount, incurredAt: projectCosts.incurredAt, createdAt: projectCosts.createdAt,
  }).from(projectCosts).innerJoin(projects, eq(projectCosts.projectId, projects.id)).innerJoin(clients, eq(projects.clientId, clients.id));
  return projectId ? query.where(and(eq(projectCosts.projectId, projectId), eq(projectCosts.tenantId, currentTenant()))).orderBy(desc(projectCosts.incurredAt), desc(projectCosts.createdAt)) : query.orderBy(desc(projectCosts.incurredAt), desc(projectCosts.createdAt));
}

export async function createProjectCost(input: ProjectCostInput) {
  const db = await requireDb();
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.tenantId, currentTenant()))).limit(1);
  if (!project[0]) throw new Error("Le chantier sélectionné est introuvable.");
  const result = await db.insert(projectCosts).values({ tenantId: currentTenant(), ...input, incurredAt: new Date(input.incurredAt) });
  return { id: Number(result[0].insertId) };
}

export async function deleteProjectCost(id: number) {
  const db = await requireDb();
  await db.delete(projectCosts).where(and(eq(projectCosts.id, id), eq(projectCosts.tenantId, currentTenant())));
  return { success: true };
}

export async function getProjectCostById(id: number) {
  const db = await requireDb();
  const result = await db.select({ id: projectCosts.id, projectId: projectCosts.projectId }).from(projectCosts).where(and(eq(projectCosts.id, id), eq(projectCosts.tenantId, currentTenant()))).limit(1);
  return result[0] ?? null;
}

export async function listProjectCostAttachments(projectCostId: number) {
  const db = await requireDb();
  return db.select({ id: projectCostAttachments.id, projectCostId: projectCostAttachments.projectCostId, fileName: projectCostAttachments.fileName, contentType: projectCostAttachments.contentType, size: projectCostAttachments.size, storageUrl: projectCostAttachments.storageUrl, createdAt: projectCostAttachments.createdAt }).from(projectCostAttachments).where(and(eq(projectCostAttachments.projectCostId, projectCostId), eq(projectCostAttachments.tenantId, currentTenant()))).orderBy(desc(projectCostAttachments.createdAt));
}

export async function createProjectCostAttachment(input: { projectCostId: number; fileName: string; contentType: string; size: number; storageKey: string; storageUrl: string; createdById: number }) {
  const db = await requireDb();
  const result = await db.insert(projectCostAttachments).values({ ...input, tenantId: currentTenant() });
  return { id: Number(result[0].insertId) };
}

export async function deleteProjectCostAttachment(id: number) {
  const db = await requireDb();
  await db.delete(projectCostAttachments).where(and(eq(projectCostAttachments.id, id), eq(projectCostAttachments.tenantId, currentTenant())));
  return { success: true };
}

export async function listProjectProfitability() {
  const db = await requireDb();
  const [projectRows, costRows, paymentRows, plannedRevenueRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, reference: projects.reference, status: projects.status, clientName: clients.companyName, plannedBudget: projects.plannedBudget, minimumMarginRate: projects.minimumMarginRate }).from(projects).innerJoin(clients, eq(projects.clientId, clients.id)).where(eq(projects.tenantId, currentTenant())).orderBy(desc(projects.createdAt)),
    db.select({ projectId: projectCosts.projectId, costTotal: sql<number>`coalesce(sum(${projectCosts.amount}), 0)` }).from(projectCosts).where(eq(projectCosts.tenantId, currentTenant())).groupBy(projectCosts.projectId),
    db.select({ projectId: documents.projectId, revenueCollected: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(documents).innerJoin(payments, eq(payments.documentId, documents.id)).where(and(eq(documents.kind, "facture"), sql`${documents.projectId} is not null`, sql`${documents.status} <> 'annule'`)).groupBy(documents.projectId),
    db.select({ projectId: documents.projectId, plannedRevenue: sql<number>`coalesce(sum(${documents.total}), 0)` }).from(documents).where(and(eq(documents.kind, "devis"), eq(documents.status, "accepte"), sql`${documents.projectId} is not null`)).groupBy(documents.projectId),
  ]);
  const costsByProject = new Map(costRows.map(row => [row.projectId, Number(row.costTotal)]));
  const revenueByProject = new Map(paymentRows.filter(row => row.projectId !== null).map(row => [row.projectId as number, Number(row.revenueCollected)]));
  const plannedRevenueByProject = new Map(plannedRevenueRows.filter(row => row.projectId !== null).map(row => [row.projectId as number, Number(row.plannedRevenue)]));
  return projectRows.map(project => ({ ...project, ...calculateProjectMargin({ revenueCollected: revenueByProject.get(project.id) ?? 0, costTotal: costsByProject.get(project.id) ?? 0, plannedRevenue: plannedRevenueByProject.get(project.id) ?? 0, plannedBudget: Number(project.plannedBudget), minimumMarginRate: project.minimumMarginRate }) }));
}

export async function listServices() {
  const db = await requireDb();
  const existingCodes = await db.select({ code: services.code }).from(services);
  const missingDefaults = getMissingDefaultServices(existingCodes.map(service => service.code));
  if (missingDefaults.length) await db.insert(services).values(missingDefaults.map(d => ({ ...d, tenantId: currentTenant() })));
  return db.select().from(services).where(eq(services.tenantId, currentTenant())).orderBy(asc(services.category), asc(services.name));
}

export async function createService(input: {
  code: string;
  name: string;
  category: ServiceCategory;
  description?: string;
  unit: string;
  defaultUnitPrice: number;
  defaultTaxRate: number;
}) {
  const db = await requireDb();
  const result = await db.insert(services).values({ tenantId: currentTenant(),
    ...input,
    description: input.description || null,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateServiceTariff(input: { id: number; defaultUnitPrice: number; defaultTaxRate: number; changedById: number }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const current = await tx.select().from(services).where(and(eq(services.id, input.id), eq(services.tenantId, currentTenant()))).limit(1);
    const service = current[0];
    if (!service) throw new Error("Prestation introuvable.");
    const changed = service.defaultUnitPrice !== input.defaultUnitPrice || service.defaultTaxRate !== input.defaultTaxRate;
    if (!changed) return { success: true, revisionCreated: false };
    await tx.update(services).set({ defaultUnitPrice: input.defaultUnitPrice, defaultTaxRate: input.defaultTaxRate }).where(and(eq(services.id, input.id), eq(services.tenantId, currentTenant())));
    await tx.insert(servicePriceRevisions).values({ tenantId: currentTenant(), serviceId: service.id, previousUnitPrice: service.defaultUnitPrice, nextUnitPrice: input.defaultUnitPrice, previousTaxRate: service.defaultTaxRate, nextTaxRate: input.defaultTaxRate, changedById: input.changedById });
    return { success: true, revisionCreated: true };
  });
}

export async function listServicePriceRevisions(serviceId: number) {
  const db = await requireDb();
  return db.select({ id: servicePriceRevisions.id, previousUnitPrice: servicePriceRevisions.previousUnitPrice, nextUnitPrice: servicePriceRevisions.nextUnitPrice, previousTaxRate: servicePriceRevisions.previousTaxRate, nextTaxRate: servicePriceRevisions.nextTaxRate, createdAt: servicePriceRevisions.createdAt, changedByName: users.name }).from(servicePriceRevisions).leftJoin(users, eq(servicePriceRevisions.changedById, users.id)).where(and(eq(servicePriceRevisions.serviceId, serviceId), eq(servicePriceRevisions.tenantId, currentTenant()))).orderBy(desc(servicePriceRevisions.createdAt));
}

export async function listAllServicePriceRevisions() {
  const db = await requireDb();
  return db.select({ id: servicePriceRevisions.id, serviceCode: services.code, serviceName: services.name, previousUnitPrice: servicePriceRevisions.previousUnitPrice, nextUnitPrice: servicePriceRevisions.nextUnitPrice, previousTaxRate: servicePriceRevisions.previousTaxRate, nextTaxRate: servicePriceRevisions.nextTaxRate, createdAt: servicePriceRevisions.createdAt, changedByName: users.name }).from(servicePriceRevisions).innerJoin(services, eq(servicePriceRevisions.serviceId, services.id)).leftJoin(users, eq(servicePriceRevisions.changedById, users.id)).where(eq(servicePriceRevisions.tenantId, currentTenant())).orderBy(desc(servicePriceRevisions.createdAt));
}

async function ensureDefaultIntegrationProviders() {
  const db = await requireDb();
  for (const provider of DEFAULT_INTEGRATION_PROVIDERS) {
    await db.insert(integrationProviders).values({
      slug: provider.slug,
      name: provider.name,
      category: provider.category,
      transport: provider.transport,
      documentationUrl: provider.documentationUrl,
      authType: provider.authType,
      isSupported: provider.isSupported,
      sortOrder: provider.sortOrder,
    }).onDuplicateKeyUpdate({
      set: {
        name: provider.name,
        category: provider.category,
        transport: provider.transport,
        documentationUrl: provider.documentationUrl,
        authType: provider.authType,
        isSupported: provider.isSupported,
        sortOrder: provider.sortOrder,
      },
    });
  }

  const persisted = await db.select({ id: integrationProviders.id, slug: integrationProviders.slug }).from(integrationProviders);
  const providerIds = new Map(persisted.map(provider => [provider.slug, provider.id]));
  for (const provider of DEFAULT_INTEGRATION_PROVIDERS) {
    const providerId = providerIds.get(provider.slug);
    if (!providerId) continue;
    for (const capability of provider.capabilities) {
      await db.insert(integrationCapabilities).values({ providerId, ...capability }).onDuplicateKeyUpdate({
        set: {
          label: capability.label,
          direction: capability.direction,
          riskLevel: capability.riskLevel,
          requiresApproval: capability.requiresApproval,
        },
      });
    }
  }
}

export async function listIntegrations() {
  const db = await requireDb();
  await ensureDefaultIntegrationProviders();
  const [providers, capabilities, connections] = await Promise.all([
    db.select().from(integrationProviders).orderBy(asc(integrationProviders.sortOrder)),
    db.select().from(integrationCapabilities),
    db.select({
      id: integrationConnections.id,
      providerId: integrationConnections.providerId,
      status: integrationConnections.status,
      grantedScopes: integrationConnections.grantedScopes,
      lastHealthCheckAt: integrationConnections.lastHealthCheckAt,
      lastError: integrationConnections.lastError,
      connectedAt: integrationConnections.connectedAt,
      updatedAt: integrationConnections.updatedAt,
      enabledByName: users.name,
    }).from(integrationConnections).leftJoin(users, eq(integrationConnections.enabledById, users.id)),
  ]);
  const connectionsByProvider = new Map(connections.map(connection => [connection.providerId, connection]));
  return providers.map(provider => {
    const connection = connectionsByProvider.get(provider.id) ?? null;
    return {
      ...provider,
      capabilities: capabilities.filter(capability => capability.providerId === provider.id),
      adapterPreparation: getIntegrationAdapterPreparation(provider.slug),
      adapter: resolveIntegrationAdapter(provider.slug)?.describe() ?? null,
      connection: connection ? { ...connection, grantedScopes: parseGrantedScopes(connection.grantedScopes) } : null,
      readiness: !provider.isSupported
        ? "non_disponible"
        : connection?.status === "active"
          ? "pret"
          : connection?.status === "degraded"
            ? "a_verifier"
            : "a_preparer",
    };
  });
}

export async function prepareIntegrationConnection(providerSlug: string, userId: number) {
  const db = await requireDb();
  await ensureDefaultIntegrationProviders();
  return db.transaction(async tx => {
    const providerRows = await tx.select().from(integrationProviders).where(eq(integrationProviders.slug, providerSlug)).limit(1);
    const provider = providerRows[0];
    if (!provider) throw new Error("Fournisseur d’intégration introuvable.");
    if (provider.isSupported !== "oui") throw new Error("Cette intégration MCP est documentée mais n’est pas encore disponible dans Lucepres.");
    if (!resolveIntegrationAdapter(provider.slug)) throw new Error("Aucun adaptateur applicatif sécurisé n’est disponible pour ce fournisseur.");

    const existingRows = await tx.select().from(integrationConnections).where(and(eq(integrationConnections.providerId, provider.id), eq(integrationConnections.tenantId, currentTenant()))).limit(1);
    const existing = existingRows[0];
    if (existing && existing.status !== "disabled" && existing.status !== "revoked") return { id: existing.id, status: existing.status, reused: true };

    let connectionId: number;
    if (existing) {
      connectionId = existing.id;
      await tx.update(integrationConnections).set(createPreparedIntegrationConnectionValues(userId)).where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, currentTenant())));
    } else {
      const result = await tx.insert(integrationConnections).values({ tenantId: currentTenant(), providerId: provider.id, ...createPreparedIntegrationConnectionValues(userId) });
      connectionId = Number(result[0].insertId);
    }
    await tx.insert(integrationAuditLogs).values({ connectionId, actorId: userId, action: "connection_prepared", target: provider.slug, decision: "information", metadata: JSON.stringify({ transport: provider.transport, authType: provider.authType }) });
    return { id: connectionId, status: "credentials_pending" as const, reused: false };
  });
}

/**
 * Réservé à un futur callback OAuth côté serveur. Aucun écran ni route tRPC ne
 * peut soumettre un secret : seule une référence opaque déjà placée au coffre est admise.
 */
export async function activateIntegrationConnection(input: { connectionId: number; secretRef: string; grantedScopes: string[]; userId: number }) {
  const db = await requireDb();
  const secretRef = assertOpaqueIntegrationSecretReference(input.secretRef);
  const existing = await db.select({ id: integrationConnections.id }).from(integrationConnections).where(and(eq(integrationConnections.id, input.connectionId), eq(integrationConnections.tenantId, currentTenant()))).limit(1);
  if (!existing[0]) throw new Error("Connexion d’intégration introuvable.");
  await db.transaction(async tx => {
    await tx.update(integrationConnections).set({
      status: "testing",
      secretRef,
      grantedScopes: JSON.stringify(input.grantedScopes),
      lastError: null,
      enabledById: input.userId,
    }).where(and(eq(integrationConnections.id, input.connectionId), eq(integrationConnections.tenantId, currentTenant())));
    await tx.insert(integrationAuditLogs).values({ connectionId: input.connectionId, actorId: input.userId, action: "connection_activation_prepared", decision: "information" });
  });
  return { success: true };
}

export async function disableIntegrationConnection(connectionId: number, userId: number) {
  const db = await requireDb();
  const existing = await db.select({ id: integrationConnections.id }).from(integrationConnections).where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, currentTenant()))).limit(1);
  if (!existing[0]) throw new Error("Connexion d’intégration introuvable.");
  await db.transaction(async tx => {
    await tx.update(integrationConnections).set({ status: "disabled", grantedScopes: null, secretRef: null, lastError: null }).where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, currentTenant())));
    await tx.insert(integrationAuditLogs).values({ connectionId, actorId: userId, action: "connection_disabled", decision: "autorise" });
  });
  return { success: true };
}

export async function listIntegrationAuditLogs() {
  const db = await requireDb();
  return db.select({
    id: integrationAuditLogs.id,
    action: integrationAuditLogs.action,
    target: integrationAuditLogs.target,
    decision: integrationAuditLogs.decision,
    createdAt: integrationAuditLogs.createdAt,
    providerName: integrationProviders.name,
    actorName: users.name,
  }).from(integrationAuditLogs)
    .leftJoin(integrationConnections, eq(integrationAuditLogs.connectionId, integrationConnections.id))
    .leftJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id))
    .leftJoin(users, eq(integrationAuditLogs.actorId, users.id))
    .where(eq(integrationConnections.tenantId, currentTenant()))
    .orderBy(desc(integrationAuditLogs.createdAt))
    .limit(30);
}

export async function startGoogleWorkspaceOAuth(input: { clientId: string; redirectUri: string; scopes: string[]; userId: number }) {
  const db = await requireDb();
  requireIntegrationSecret(process.env.GOOGLE_OAUTH_CLIENT_SECRET, "Le secret client OAuth Google");
  const clientId = input.clientId.trim();
  const redirectUri = input.redirectUri.trim();
  if (!clientId) throw new Error("L’identifiant client OAuth Google est requis.");
  if (!redirectUri.startsWith("https://")) throw new Error("L’URI de redirection OAuth doit utiliser HTTPS.");
  const scopes = normalizeGoogleWorkspaceScopes(input.scopes);
  const rows = await db.select({ connectionId: integrationConnections.id, providerId: integrationProviders.id, status: integrationConnections.status })
    .from(integrationConnections)
    .innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id))
    .where(eq(integrationProviders.slug, "google-workspace"))
    .limit(1);
  const connection = rows[0];
  if (!connection) throw new Error("Préparez d’abord la connexion Google Workspace dans le centre d’intégrations.");
  if (connection.status === "disabled" || connection.status === "revoked") throw new Error("Réactivez la connexion Google Workspace avant de commencer OAuth.");

  const state = randomBytes(32).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const result = await db.insert(integrationOauthSessions).values({
    connectionId: connection.connectionId,
    providerId: connection.providerId,
    clientId,
    redirectUri,
    requestedScopes: JSON.stringify(scopes),
    stateHash,
    expiresAt,
    createdById: input.userId,
  });
  const sessionId = Number(result[0].insertId);
  await db.insert(integrationAuditLogs).values({ connectionId: connection.connectionId, actorId: input.userId, action: "google_oauth_started", target: "google-workspace", decision: "information", metadata: JSON.stringify({ scopes, sessionId }) });
  return { sessionId, authorizationUrl: buildGoogleWorkspaceAuthorizationUrl({ clientId, redirectUri, scopes, state }), expiresAt };
}

export function getIntegrationRuntimeReadiness() {
  return getIntegrationSecretConfiguration();
}

export async function listGoogleWorkspaceOauthSessions() {
  const db = await requireDb();
  return db.select({
    id: integrationOauthSessions.id,
    status: integrationOauthSessions.status,
    requestedScopes: integrationOauthSessions.requestedScopes,
    redirectUri: integrationOauthSessions.redirectUri,
    expiresAt: integrationOauthSessions.expiresAt,
    error: integrationOauthSessions.error,
    createdAt: integrationOauthSessions.createdAt,
    createdByName: users.name,
  }).from(integrationOauthSessions)
    .innerJoin(integrationProviders, eq(integrationOauthSessions.providerId, integrationProviders.id))
    .leftJoin(users, eq(integrationOauthSessions.createdById, users.id))
    .where(eq(integrationProviders.slug, "google-workspace"))
    .orderBy(desc(integrationOauthSessions.createdAt))
    .limit(10);
}

export async function listPendingIntegrationApprovals() {
  const db = await requireDb();
  return db.select({
    id: integrationJobs.id,
    operation: integrationJobs.operation,
    payloadHash: integrationJobs.payloadHash,
    attempts: integrationJobs.attempts,
    createdAt: integrationJobs.createdAt,
    connectionId: integrationConnections.id,
    providerName: integrationProviders.name,
    providerSlug: integrationProviders.slug,
  }).from(integrationJobs)
    .innerJoin(integrationConnections, eq(integrationJobs.connectionId, integrationConnections.id))
    .innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id))
    .where(and(eq(integrationJobs.status, "queued"), eq(integrationConnections.tenantId, currentTenant())))
    .orderBy(asc(integrationJobs.createdAt));
}

export async function decideIntegrationApproval(input: { jobId: number; decision: "approve" | "reject"; note?: string; userId: number }) {
  const db = await requireDb();
  const jobRows = await db.select({ id: integrationJobs.id, connectionId: integrationJobs.connectionId, status: integrationJobs.status, operation: integrationJobs.operation })
    .from(integrationJobs).where(eq(integrationJobs.id, input.jobId)).limit(1);
  const job = jobRows[0];
  if (!job) throw new Error("Demande d’approbation introuvable.");
  if (job.status !== "queued") throw new Error("Cette demande a déjà reçu une décision.");
  const nextStatus = input.decision === "approve" ? "approved" : "cancelled";
  const decision = input.decision === "approve" ? "autorise" : "refuse";
  await db.transaction(async tx => {
    await tx.update(integrationJobs).set({ status: nextStatus, approvedById: input.userId, approvedAt: new Date(), approvalNote: input.note?.trim() || null }).where(eq(integrationJobs.id, job.id));
    await tx.insert(integrationAuditLogs).values({ connectionId: job.connectionId, actorId: input.userId, action: `external_write_${nextStatus}`, target: job.operation, decision, metadata: input.note?.trim() ? JSON.stringify({ note: input.note.trim(), jobId: job.id }) : JSON.stringify({ jobId: job.id }) });
  });
  return { success: true, status: nextStatus };
}

/** Appelé uniquement par le futur endpoint WhatsApp après validation cryptographique de la signature. */
export async function recordWhatsAppWebhookEvent(input: { connectionId: number; externalEventId: string; eventType: string; deliveryStatus?: string; signatureStatus: "valid" | "invalid" | "pending"; processingStatus: "accepted" | "rejected" | "processed" | "failed"; payloadHash: string; summary?: string; error?: string; occurredAt: Date }) {
  const db = await requireDb();
  const connectionRows = await db.select({ id: integrationConnections.id })
    .from(integrationConnections)
    .innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id))
    .where(and(eq(integrationConnections.id, input.connectionId), eq(integrationConnections.tenantId, currentTenant())))
    .limit(1);
  if (!connectionRows[0]) throw new Error("Connexion WhatsApp introuvable.");
  const result = await db.insert(integrationWebhookEvents).values({
    ...input,
    externalEventId: input.externalEventId.slice(0, 255),
    eventType: input.eventType.slice(0, 120),
    deliveryStatus: input.deliveryStatus?.slice(0, 120) || null,
    payloadHash: input.payloadHash.slice(0, 128),
    summary: input.summary?.slice(0, 500) || null,
    error: input.error || null,
  }).onDuplicateKeyUpdate({ set: { signatureStatus: input.signatureStatus, processingStatus: input.processingStatus, deliveryStatus: input.deliveryStatus?.slice(0, 120) || null, summary: input.summary?.slice(0, 500) || null, error: input.error || null, receivedAt: new Date() } });
  return { id: Number(result[0].insertId) };
}

export async function getIntegrationOperationsDashboard() {
  const db = await requireDb();
  const [connections, approvals, webhookEvents] = await Promise.all([
    db.select({ id: integrationConnections.id, status: integrationConnections.status, lastHealthCheckAt: integrationConnections.lastHealthCheckAt, lastError: integrationConnections.lastError, providerName: integrationProviders.name, providerSlug: integrationProviders.slug })
      .from(integrationConnections).innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id)).where(eq(integrationConnections.tenantId, currentTenant())).orderBy(asc(integrationProviders.sortOrder)),
    listPendingIntegrationApprovals(),
    db.select({ id: integrationWebhookEvents.id, eventType: integrationWebhookEvents.eventType, deliveryStatus: integrationWebhookEvents.deliveryStatus, signatureStatus: integrationWebhookEvents.signatureStatus, processingStatus: integrationWebhookEvents.processingStatus, summary: integrationWebhookEvents.summary, error: integrationWebhookEvents.error, receivedAt: integrationWebhookEvents.receivedAt, occurredAt: integrationWebhookEvents.occurredAt })
      .from(integrationWebhookEvents).innerJoin(integrationConnections, eq(integrationWebhookEvents.connectionId, integrationConnections.id)).innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id)).where(eq(integrationProviders.slug, "whatsapp-business")).orderBy(desc(integrationWebhookEvents.receivedAt)).limit(30),
  ]);
  return {
    connections,
    pendingApprovals: approvals,
    webhookEvents,
    summary: {
      activeConnections: connections.filter(connection => connection.status === "active").length,
      degradedConnections: connections.filter(connection => connection.status === "degraded").length,
      pendingApprovals: approvals.length,
      acceptedWebhooks: webhookEvents.filter(event => event.processingStatus === "accepted" || event.processingStatus === "processed").length,
      rejectedWebhooks: webhookEvents.filter(event => event.processingStatus === "rejected" || event.signatureStatus === "invalid").length,
    },
  };
}

type AgentGrantRole = "directeur_general" | "responsable_commercial";
type AgentGrantScope = "global" | "commercial";

export async function getAgentOperatorAccess(userId: number, systemRole: AppRole) {
  if (systemRole === "admin") return { canApprove: true, canActivate: true, scope: "global" as const, isAdministrator: true, grantIds: [] as number[] };
  const db = await requireDb();
  const now = new Date();
  const grants = await db.select().from(agentOperatorGrants).where(eq(agentOperatorGrants.userId, userId));
  const active = grants.filter(grant => grant.status === "active" && (!grant.expiresAt || grant.expiresAt > now));
  if (!active.length) return null;
  return {
    canApprove: active.some(grant => grant.canApprove === "oui"),
    canActivate: active.some(grant => grant.canActivate === "oui"),
    scope: active.some(grant => grant.scope === "global") ? "global" as const : "commercial" as const,
    isAdministrator: false,
    grantIds: active.map(grant => grant.id),
  };
}

export async function listAgentOperators() {
  const db = await requireDb();
  const [people, grants] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, systemRole: users.role }).from(users).where(eq(users.tenantId, currentTenant())).orderBy(asc(users.name)),
    db.select().from(agentOperatorGrants).where(eq(agentOperatorGrants.tenantId, currentTenant())).orderBy(desc(agentOperatorGrants.updatedAt)),
  ]);
  return people.map(person => ({
    ...person,
    grants: grants.filter(grant => grant.userId === person.id),
  }));
}

export async function upsertAgentOperatorGrant(input: {
  userId: number;
  role: AgentGrantRole;
  canApprove: boolean;
  canActivate: boolean;
  scope: AgentGrantScope;
  status: "active" | "suspendue" | "revoquee";
  expiresAt?: Date | null;
  grantedById: number;
}) {
  const db = await requireDb();
  const subject = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.userId), eq(users.tenantId, currentTenant()))).limit(1);
  if (!subject[0]) throw new Error("Utilisateur introuvable pour cette habilitation.");
  const values = {
    tenantId: currentTenant(),
    userId: input.userId,
    role: input.role,
    canApprove: input.canApprove ? "oui" as const : "non" as const,
    canActivate: input.canActivate ? "oui" as const : "non" as const,
    scope: input.scope,
    status: input.status,
    expiresAt: input.expiresAt ?? null,
    grantedById: input.grantedById,
  };
  await db.transaction(async tx => {
    await tx.insert(agentOperatorGrants).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), actorId: input.grantedById, action: "operator_grant_upserted", target: `user:${input.userId}`, decision: "autorise", metadata: JSON.stringify({ role: input.role, scope: input.scope, canApprove: input.canApprove, canActivate: input.canActivate, status: input.status, expiresAt: input.expiresAt ?? null }) });
  });
  return { success: true };
}

export async function listAgentDelegationCenter() {
  const db = await requireDb();
  const [delegations, campaigns, jobs, audit, operatorGrants, testEmailDeliveries] = await Promise.all([
    db.select({
      id: agentDelegations.id, name: agentDelegations.name, purpose: agentDelegations.purpose, channel: agentDelegations.channel, tone: agentDelegations.tone, status: agentDelegations.status, startsAt: agentDelegations.startsAt, expiresAt: agentDelegations.expiresAt, dailyLimit: agentDelegations.dailyLimit, contactCooldownDays: agentDelegations.contactCooldownDays, requiresSecondApproval: agentDelegations.requiresSecondApproval, policyVersion: agentDelegations.policyVersion, ownerId: agentDelegations.ownerId, ownerName: users.name, approvedById: agentDelegations.approvedById, approvedAt: agentDelegations.approvedAt, secondApprovedById: agentDelegations.secondApprovedById, secondApprovedAt: agentDelegations.secondApprovedAt, activatedById: agentDelegations.activatedById, suspendedById: agentDelegations.suspendedById, createdAt: agentDelegations.createdAt, updatedAt: agentDelegations.updatedAt,
    }).from(agentDelegations).innerJoin(users, eq(agentDelegations.ownerId, users.id)).where(eq(agentDelegations.tenantId, currentTenant())).orderBy(desc(agentDelegations.updatedAt)),
    db.select({
      id: agentCampaigns.id, delegationId: agentCampaigns.delegationId, delegationName: agentDelegations.name, purpose: agentDelegations.purpose, channel: agentDelegations.channel, name: agentCampaigns.name, status: agentCampaigns.status, scheduledFor: agentCampaigns.scheduledFor, scheduleCronTaskUid: agentCampaigns.scheduleCronTaskUid, scheduleCronExpression: agentCampaigns.scheduleCronExpression, scheduleTimeZone: agentCampaigns.scheduleTimeZone, nextExecutionAt: agentCampaigns.nextExecutionAt, lastExecutedAt: agentCampaigns.lastExecutedAt, lastExecutionStatus: agentCampaigns.lastExecutionStatus, eligibleCount: agentCampaigns.eligibleCount, preparedById: agentCampaigns.preparedById, approvedById: agentCampaigns.approvedById, approvedAt: agentCampaigns.approvedAt, secondApprovedById: agentCampaigns.secondApprovedById, secondApprovedAt: agentCampaigns.secondApprovedAt, activatedById: agentCampaigns.activatedById, suspendedById: agentCampaigns.suspendedById, createdAt: agentCampaigns.createdAt, updatedAt: agentCampaigns.updatedAt,
    }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(eq(agentCampaigns.tenantId, currentTenant())).orderBy(desc(agentCampaigns.updatedAt)).limit(40),
    db.select({
      id: agentMessageJobs.id, campaignId: agentMessageJobs.campaignId, clientId: agentMessageJobs.clientId, clientName: clients.companyName, documentId: agentMessageJobs.documentId, documentNumber: documents.number, subject: agentMessageJobs.subject, body: agentMessageJobs.body, status: agentMessageJobs.status, blockedReason: agentMessageJobs.blockedReason, scheduledFor: agentMessageJobs.scheduledFor, createdAt: agentMessageJobs.createdAt,
    }).from(agentMessageJobs).innerJoin(clients, eq(agentMessageJobs.clientId, clients.id)).innerJoin(documents, eq(agentMessageJobs.documentId, documents.id)).where(eq(agentMessageJobs.tenantId, currentTenant())).orderBy(desc(agentMessageJobs.createdAt)).limit(80),
    db.select({ id: agentAuditLogs.id, delegationId: agentAuditLogs.delegationId, campaignId: agentAuditLogs.campaignId, action: agentAuditLogs.action, target: agentAuditLogs.target, decision: agentAuditLogs.decision, metadata: agentAuditLogs.metadata, createdAt: agentAuditLogs.createdAt, actorName: users.name }).from(agentAuditLogs).leftJoin(users, eq(agentAuditLogs.actorId, users.id)).where(eq(agentAuditLogs.tenantId, currentTenant())).orderBy(desc(agentAuditLogs.createdAt)).limit(100),
    db.select().from(agentOperatorGrants).orderBy(desc(agentOperatorGrants.updatedAt)),
    db.select({ id: agentTestEmailDeliveries.id, campaignId: agentTestEmailDeliveries.campaignId, messageJobId: agentTestEmailDeliveries.messageJobId, campaignName: agentCampaigns.name, clientName: clients.companyName, documentNumber: documents.number, testRecipient: agentTestEmailDeliveries.testRecipient, subject: agentTestEmailDeliveries.subject, body: agentTestEmailDeliveries.body, status: agentTestEmailDeliveries.status, deliveredAt: agentTestEmailDeliveries.deliveredAt, createdAt: agentTestEmailDeliveries.createdAt }).from(agentTestEmailDeliveries).innerJoin(agentCampaigns, eq(agentTestEmailDeliveries.campaignId, agentCampaigns.id)).innerJoin(agentMessageJobs, eq(agentTestEmailDeliveries.messageJobId, agentMessageJobs.id)).innerJoin(clients, eq(agentMessageJobs.clientId, clients.id)).innerJoin(documents, eq(agentMessageJobs.documentId, documents.id)).where(eq(agentTestEmailDeliveries.tenantId, currentTenant())).orderBy(desc(agentTestEmailDeliveries.createdAt)).limit(100),
  ]);
  return {
    delegations,
    campaigns: campaigns.map(campaign => ({ ...campaign, requiresSecondApproval: requiresSecondApproval(campaign.eligibleCount) })),
    jobs,
    audit,
    operatorGrants,
    testEmailDeliveries,
    channelReadiness: [
      { channel: "email" as const, label: "E-mail", status: "preparatoire" as const, detail: "Aucun connecteur e-mail applicatif n’est activé ; les campagnes restent en simulation." },
      { channel: "whatsapp" as const, label: "WhatsApp Business", status: "preparatoire" as const, detail: "La connexion WhatsApp Business reste désactivée tant que les secrets et vérifications ne sont pas configurés." },
    ],
    summary: {
      activeDelegations: delegations.filter(delegation => delegation.status === "active_simulation").length,
      pendingApprovals: campaigns.filter(campaign => campaign.status === "a_approuver").length,
      simulationReady: jobs.filter(job => job.status === "simulation_prete").length,
      scheduledCampaigns: campaigns.filter(campaign => Boolean(campaign.scheduleCronTaskUid)).length,
      testDelivered: testEmailDeliveries.filter(delivery => delivery.status === "remis_test").length,
      blocked: jobs.filter(job => job.status === "bloquee").length,
    },
  };
}

export async function createAgentDelegation(input: {
  name: string;
  purpose: AgentPurpose;
  channel: AgentChannel;
  tone: AgentTone;
  startsAt: Date;
  expiresAt: Date;
  dailyLimit: number;
  contactCooldownDays: number;
  ownerId: number;
}) {
  const errors = getDelegationPolicyErrors(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const db = await requireDb();
  const result = await db.transaction(async tx => {
    const created = await tx.insert(agentDelegations).values({ tenantId: currentTenant(), ...input, status: "brouillon", requiresSecondApproval: "non" });
    const delegationId = Number(created[0].insertId);
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId: input.ownerId, action: "delegation_created", target: input.name, decision: "information", metadata: JSON.stringify({ purpose: input.purpose, channel: input.channel, expiresAt: input.expiresAt, dailyLimit: input.dailyLimit, contactCooldownDays: input.contactCooldownDays }) });
    return { id: delegationId };
  });
  return result;
}

export async function submitAgentDelegationForApproval(delegationId: number, actorId: number) {
  const db = await requireDb();
  const rows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = rows[0];
  if (!delegation) throw new Error("Délégation introuvable.");
  if (delegation.status !== "brouillon" && delegation.status !== "suspendue") throw new Error("Seule une délégation brouillon ou suspendue peut être soumise à approbation.");
  await db.transaction(async tx => {
    await tx.update(agentDelegations).set({ status: "a_approuver" }).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId, action: "delegation_submitted", target: delegation.name, decision: "information" });
  });
  return { success: true };
}

export async function approveAgentDelegation(delegationId: number, actorId: number) {
  const db = await requireDb();
  const rows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = rows[0];
  if (!delegation) throw new Error("Délégation introuvable.");
  if (delegation.status !== "a_approuver") throw new Error("Cette délégation ne peut pas être approuvée dans son état actuel.");
  if (delegation.expiresAt <= new Date()) throw new Error("Cette délégation est expirée et ne peut pas être activée.");
  await db.transaction(async tx => {
    await tx.update(agentDelegations).set({ status: "active_simulation", approvedById: actorId, approvedAt: new Date(), activatedById: actorId }).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId, action: "delegation_approved_simulation", target: delegation.name, decision: "autorise", metadata: JSON.stringify({ mode: "simulation", externalDispatch: false }) });
  });
  return { success: true, status: "active_simulation" as const };
}

export async function suspendAgentDelegation(delegationId: number, actorId: number) {
  const db = await requireDb();
  const rows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = rows[0];
  if (!delegation) throw new Error("Délégation introuvable.");
  if (delegation.status === "revoquee" || delegation.status === "expiree") throw new Error("Cette délégation ne peut plus être suspendue.");
  await db.transaction(async tx => {
    const campaignIds = (await tx.select({ id: agentCampaigns.id }).from(agentCampaigns).where(and(eq(agentCampaigns.delegationId, delegationId), eq(agentCampaigns.tenantId, currentTenant())))).map(campaign => campaign.id);
    await tx.update(agentDelegations).set({ status: "suspendue", suspendedById: actorId }).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant())));
    await tx.update(agentCampaigns).set({ status: "suspendue", suspendedById: actorId }).where(and(eq(agentCampaigns.delegationId, delegationId), eq(agentCampaigns.tenantId, currentTenant())));
    if (campaignIds.length) await tx.update(agentMessageJobs).set({ status: "annulee", blockedReason: "Délégation suspendue par un responsable habilité." }).where(inArray(agentMessageJobs.campaignId, campaignIds));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId, action: "delegation_suspended", target: delegation.name, decision: "autorise", metadata: JSON.stringify({ externalDispatch: false }) });
  });
  return { success: true };
}

export async function createAgentCampaignSimulation(input: { delegationId: number; name: string; scheduledFor?: Date | null; preparedById: number }) {
  const db = await requireDb();
  const delegationRows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, input.delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = delegationRows[0];
  if (!delegation) throw new Error("Délégation introuvable.");
  if (delegation.status !== "active_simulation") throw new Error("La délégation doit être approuvée en mode simulation avant de préparer une campagne.");
  if (delegation.expiresAt <= new Date()) throw new Error("La délégation est expirée.");

  const effectiveScheduledFor = input.scheduledFor ?? new Date();
  const dayStart = new Date(effectiveScheduledFor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const scheduledRows = await db.select({ count: sql<number>`count(*)` })
    .from(agentMessageJobs)
    .innerJoin(agentCampaigns, eq(agentMessageJobs.campaignId, agentCampaigns.id))
    .where(and(eq(agentCampaigns.delegationId, delegation.id), gt(agentMessageJobs.scheduledFor, new Date(dayStart.getTime() - 1)), lt(agentMessageJobs.scheduledFor, dayEnd)));
  const remainingDailyCapacity = Math.max(0, delegation.dailyLimit - Number(scheduledRows[0]?.count ?? 0));
  const documentsToCheck = await listDocuments(delegation.purpose === "relance_facture" ? "facture" : "devis");
  const cooldownStart = new Date(Date.now() - delegation.contactCooldownDays * 86_400_000);
  const recentJobs = await db.select({ clientId: agentMessageJobs.clientId }).from(agentMessageJobs).where(gt(agentMessageJobs.createdAt, cooldownStart));
  const contactedRecently = new Set(recentJobs.map(job => job.clientId));
  const matchingDocuments = documentsToCheck.filter(document => isCampaignEligibleForSimulation({ purpose: delegation.purpose, kind: document.kind, status: document.status, balanceDue: document.balanceDue, isOverdue: document.isOverdue }));
  const eligible = matchingDocuments
    .filter(document => !contactedRecently.has(document.clientId))
    .slice(0, remainingDailyCapacity);
  const createdAt = new Date();
  const skippedCount = Math.max(0, matchingDocuments.length - eligible.length);
  return db.transaction(async tx => {
    const created = await tx.insert(agentCampaigns).values({ tenantId: currentTenant(), delegationId: delegation.id, name: input.name, status: "simulee", scheduledFor: effectiveScheduledFor, eligibleCount: eligible.length, preparedById: input.preparedById });
    const campaignId = Number(created[0].insertId);
    for (const document of eligible) {
      const draft = createAgentMessageDraft({ purpose: delegation.purpose, tone: delegation.tone, documentNumber: document.number, clientName: document.clientName, balanceDue: document.balanceDue, dueDate: document.dueDate, validUntil: document.validUntil });
      const contentHash = createHash("sha256").update(`${draft.subject}\n${draft.body}`).digest("hex");
      await tx.insert(agentMessageJobs).values({ tenantId: currentTenant(), campaignId, clientId: document.clientId, documentId: document.id, idempotencyKey: `simulation:${campaignId}:${document.id}`, subject: draft.subject, body: draft.body, contentHash, status: "simulation_prete", scheduledFor: effectiveScheduledFor, policySnapshot: JSON.stringify({ policyVersion: delegation.policyVersion, dailyLimit: delegation.dailyLimit, contactCooldownDays: delegation.contactCooldownDays, channel: delegation.channel, purpose: delegation.purpose, mode: "simulation" }) });
    }
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: delegation.id, campaignId, actorId: input.preparedById, action: "campaign_simulated", target: input.name, decision: "information", metadata: JSON.stringify({ eligibleCount: eligible.length, skippedCount, remainingDailyCapacity, requiresSecondApproval: requiresSecondApproval(eligible.length), externalDispatch: false }) });
    return { id: campaignId, eligibleCount: eligible.length, skippedCount, requiresSecondApproval: requiresSecondApproval(eligible.length) };
  });
}

export async function submitAgentCampaignForApproval(campaignId: number, actorId: number) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status !== "simulee") throw new Error("Seule une campagne simulée peut être soumise à approbation.");
  await db.transaction(async tx => {
    await tx.update(agentCampaigns).set({ status: "a_approuver" }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_submitted", target: campaign.name, decision: "information", metadata: JSON.stringify({ eligibleCount: campaign.eligibleCount, requiresSecondApproval: requiresSecondApproval(campaign.eligibleCount) }) });
  });
  return { success: true };
}

export async function approveAgentCampaign(campaignId: number, actorId: number) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status !== "a_approuver") throw new Error("Cette campagne ne peut pas être approuvée dans son état actuel.");
  const secondApprovalNeeded = requiresSecondApproval(campaign.eligibleCount);
  if (!campaign.approvedById) {
    await db.transaction(async tx => {
      await tx.update(agentCampaigns).set({ approvedById: actorId, approvedAt: new Date(), status: secondApprovalNeeded ? "a_approuver" : "approuvee" }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
      await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_first_approval", target: campaign.name, decision: "autorise", metadata: JSON.stringify({ secondApprovalNeeded }) });
    });
    return { success: true, awaitingSecondApproval: secondApprovalNeeded };
  }
  if (!secondApprovalNeeded) throw new Error("Cette campagne a déjà été approuvée.");
  if (campaign.approvedById === actorId) throw new Error("Un second responsable distinct doit confirmer cette campagne.");
  await db.transaction(async tx => {
    await tx.update(agentCampaigns).set({ secondApprovedById: actorId, secondApprovedAt: new Date(), status: "approuvee" }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_second_approval", target: campaign.name, decision: "autorise" });
  });
  return { success: true, awaitingSecondApproval: false };
}

export async function activateAgentCampaignSimulation(campaignId: number, actorId: number) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status !== "approuvee") throw new Error("La campagne doit être entièrement approuvée avant activation simulée.");
  if (requiresSecondApproval(campaign.eligibleCount) && !campaign.secondApprovedById) throw new Error("Une seconde approbation distincte est requise pour cette campagne.");
  await db.transaction(async tx => {
    await tx.update(agentCampaigns).set({ status: "active_simulation", activatedById: actorId }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_activated_simulation", target: campaign.name, decision: "autorise", metadata: JSON.stringify({ externalDispatch: false }) });
  });
  return { success: true };
}

export async function suspendAgentCampaign(campaignId: number, actorId: number) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status === "archivee") throw new Error("Cette campagne est déjà archivée.");
  await db.transaction(async tx => {
    await tx.update(agentCampaigns).set({ status: "suspendue", suspendedById: actorId }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.update(agentMessageJobs).set({ status: "annulee", blockedReason: "Campagne suspendue par un responsable habilité." }).where(and(eq(agentMessageJobs.campaignId, campaignId), eq(agentMessageJobs.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_suspended", target: campaign.name, decision: "autorise", metadata: JSON.stringify({ externalDispatch: false }) });
  });
  return { success: true };
}

export async function setAgentCampaignSchedule(input: { campaignId: number; scheduleCronTaskUid: string; scheduleCronExpression: string; nextExecutionAt: Date | null; actorId: number }) {
  const db = await requireDb();
  const rows = await db.select({ campaign: agentCampaigns, delegation: agentDelegations }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const record = rows[0];
  if (!record) throw new Error("Campagne introuvable.");
  if (record.campaign.status !== "active_simulation") throw new Error("La campagne doit être activée en simulation avant de pouvoir être programmée.");
  if (record.delegation.channel !== "email") throw new Error("La programmation de test est disponible pour les campagnes e-mail uniquement.");
  await db.transaction(async tx => {
    await tx.update(agentCampaigns).set({ scheduleCronTaskUid: input.scheduleCronTaskUid, scheduleCronExpression: input.scheduleCronExpression, scheduleTimeZone: "Africa/Conakry", nextExecutionAt: input.nextExecutionAt, lastExecutionStatus: "pending" }).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: record.campaign.delegationId, campaignId: input.campaignId, actorId: input.actorId, action: "campaign_schedule_created", target: record.campaign.name, decision: "autorise", metadata: JSON.stringify({ mode: "test_email", cron: input.scheduleCronExpression, timeZone: "Africa/Conakry", externalDispatch: false }) });
  });
  return { success: true };
}

export async function assertAgentCampaignCanBeScheduled(campaignId: number) {
  const record = await getAgentCampaignById(campaignId);
  if (!record) throw new Error("Campagne introuvable.");
  if (record.campaign.status !== "active_simulation") throw new Error("La campagne doit être activée en simulation avant de pouvoir être programmée.");
  if (record.delegation.channel !== "email") throw new Error("La programmation de test est disponible pour les campagnes e-mail uniquement.");
  if (record.campaign.scheduleCronTaskUid) throw new Error("Cette campagne dispose déjà d’une programmation active.");
  return { name: record.campaign.name };
}

export async function getAgentCampaignByScheduleTaskUid(taskUid: string) {
  const db = await requireDb();
  const rows = await db.select({ campaign: agentCampaigns, delegation: agentDelegations }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(and(eq(agentCampaigns.scheduleCronTaskUid, taskUid), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  return rows[0] ?? null;
}

async function deliverAgentCampaignToTestInbox(input: { campaignId: number; runKeyPrefix: string; actorId?: number | null }) {
  const db = await requireDb();
  const record = await getAgentCampaignById(input.campaignId);
  if (!record) throw new Error("Campagne introuvable.");
  if (record.campaign.status !== "active_simulation") return { status: "skipped" as const, delivered: 0, reason: "Campagne non active en simulation." };
  if (record.delegation.status !== "active_simulation" || record.delegation.expiresAt <= new Date()) return { status: "skipped" as const, delivered: 0, reason: "Délégation inactive ou expirée." };
  if (record.delegation.channel !== "email") return { status: "skipped" as const, delivered: 0, reason: "Le connecteur de test ne prend en charge que l’e-mail." };
  const jobs = await db.select().from(agentMessageJobs).where(and(eq(agentMessageJobs.campaignId, input.campaignId), eq(agentMessageJobs.status, "simulation_prete")));
  const deliveredAt = new Date();
  if (!jobs.length) {
    await db.update(agentCampaigns).set({ lastExecutedAt: deliveredAt, lastExecutionStatus: "skipped" }).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    return { status: "skipped" as const, delivered: 0, reason: "Aucun brouillon de test n’est disponible." };
  }
  await db.transaction(async tx => {
    for (const job of jobs) {
      await tx.insert(agentTestEmailDeliveries).values({ tenantId: currentTenant(), campaignId: input.campaignId, messageJobId: job.id, subject: job.subject, body: job.body, status: "remis_test", runKey: `${input.runKeyPrefix}:${job.id}`, deliveredAt }).onDuplicateKeyUpdate({ set: { status: "remis_test", deliveredAt } });
      await tx.update(agentMessageJobs).set({ status: "remis_test" }).where(and(eq(agentMessageJobs.id, job.id), eq(agentMessageJobs.tenantId, currentTenant())));
    }
    await tx.update(agentCampaigns).set({ lastExecutedAt: deliveredAt, lastExecutionStatus: "success" }).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: record.campaign.delegationId, campaignId: input.campaignId, actorId: input.actorId ?? null, action: "test_email_delivered", target: record.campaign.name, decision: "information", metadata: JSON.stringify({ delivered: jobs.length, mode: "test_inbox", externalDispatch: false }) });
  });
  return { status: "success" as const, delivered: jobs.length };
}

async function getAgentCampaignById(campaignId: number) {
  const db = await requireDb();
  const rows = await db.select({ campaign: agentCampaigns, delegation: agentDelegations }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  return rows[0] ?? null;
}

export async function deliverAgentCampaignToTestInboxNow(campaignId: number, actorId: number) {
  return deliverAgentCampaignToTestInbox({ campaignId, actorId, runKeyPrefix: `manual-test:${campaignId}` });
}

export async function deliverScheduledAgentCampaignToTestInbox(taskUid: string, tenantId?: number | null) {
  const record = await getAgentCampaignByScheduleTaskUid(taskUid);
  if (!record) return { status: "orphan" as const, delivered: 0 };
  const dayKey = new Date().toISOString().slice(0, 10);
  // Porte le tenant dans le contexte async pour étiqueter les écritures.
  return runWithTenant(tenantId ?? record.campaign?.tenantId ?? null, () =>
    deliverAgentCampaignToTestInbox({ campaignId: record.campaign.id, runKeyPrefix: `scheduled-test:${taskUid}:${dayKey}` }),
  );
}

export async function getAgentCopilotContext() {
  const [profitability, receivables] = await Promise.all([listProjectProfitability(), getReceivablesDashboard()]);
  return {
    projectsBelowTarget: profitability.filter(project => project.isMarginBelowTarget).slice(0, 10).map(project => ({ projectId: project.id, name: project.name, client: project.clientName, margin: project.margin, marginRate: project.marginRate, minimumMarginRate: project.minimumMarginRate, variance: project.marginVariance, revenueCollected: project.revenueCollected, costs: project.costTotal })),
    receivables: receivables.invoices.filter(invoice => invoice.isPaymentPromiseOverdue || invoice.isOverdue).slice(0, 12).map(invoice => ({ documentId: invoice.id, number: invoice.number, client: invoice.clientName, balanceDue: invoice.balanceDue, daysOverdue: invoice.daysOverdue, promiseOverdue: invoice.isPaymentPromiseOverdue, promiseDueSoon: invoice.isPaymentPromiseDueSoon, promisedDate: invoice.paymentPromise?.promisedDate ?? null })),
    summary: receivables.summary,
  };
}

export async function listDocuments(kind?: DocumentKind, opts?: { limit?: number; search?: string }) {
  const db = await requireDb();
  let query = db
    .select({
      id: documents.id,
      kind: documents.kind,
      number: documents.number,
      status: documents.status,
      issueDate: documents.issueDate,
      dueDate: documents.dueDate,
      validUntil: documents.validUntil,
      depositPercent: documents.depositPercent,
      depositDueDate: documents.depositDueDate,
      balanceDueDate: documents.balanceDueDate,
      total: documents.total,
      subtotal: documents.subtotal,
      taxTotal: documents.taxTotal,
      isAiDraft: documents.isAiDraft,
      relatedDocumentId: documents.relatedDocumentId,
      invoiceStage: documents.invoiceStage,
      collectionStatus: documents.collectionStatus,
      collectionReminderDate: documents.collectionReminderDate,
      collectionOwnerId: documents.collectionOwnerId,
      clientId: clients.id,
      clientName: clients.companyName,
      projectId: projects.id,
      projectName: projects.name,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(eq(documents.tenantId, currentTenant())).$dynamic();
  if (kind) query = query.where(and(eq(documents.kind, kind), eq(documents.tenantId, currentTenant()))) as typeof query;
  query = query.orderBy(desc(documents.updatedAt)) as typeof query;
  if (opts?.limit) query = query.limit(opts.limit) as typeof query;
  const rows = await query;
  const paymentRows = await db.select({ documentId: payments.documentId, paidAmount: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(eq(payments.tenantId, currentTenant())).groupBy(payments.documentId);
  const paidByDocument = new Map(paymentRows.map(row => [row.documentId, Number(row.paidAmount)]));
  const enriched = rows.map(row => {
    const paidAmount = row.kind === "facture" ? (paidByDocument.get(row.id) ?? 0) : 0;
    const balance = calculatePaymentBalance(row.total, paidAmount);
    const status = row.kind === "facture" ? invoicePaymentStatus(row.total, paidAmount, row.dueDate, row.status) : row.status;
    return { ...row, status, paidAmount, balanceDue: row.kind === "facture" ? balance.balanceDue : 0, isOverdue: row.kind === "facture" && isInvoiceOverdue(status, row.dueDate) };
  });
  return kind ? enriched.filter(row => row.kind === kind) : enriched;
}

export async function getReceivablesDashboard() {
  const [invoices, promises] = await Promise.all([listDocuments("facture"), listPaymentPromises()]);
  const promisedByDocument = new Map(promises.map(promise => [promise.documentId, promise]));
  return summarizeReceivables(invoices.map(invoice => ({ ...invoice, paymentPromise: promisedByDocument.get(invoice.id) ?? null })));
}

export async function searchWorkspace(input: { query: string; filters?: WorkspaceSearchFilters }) {
  const [clientRows, documentRows, receivables] = await Promise.all([listClients(), listDocuments(), getReceivablesDashboard()]);
  return buildWorkspaceSearchResults({
    query: input.query,
    filters: input.filters,
    clients: clientRows,
    documents: documentRows,
    receivables: receivables.invoices.filter(invoice => invoice.balanceDue > 0),
  });
}

export async function updateCollectionFollowUp(input: { documentId: number; collectionStatus?: CollectionFollowUpStatus; collectionReminderDate?: string | null; collectionOwnerId?: number | null; updatedById: number }) {
  if (!input.collectionStatus && input.collectionReminderDate === undefined && input.collectionOwnerId === undefined) throw new Error("Aucune mise à jour de suivi n’a été demandée.");
  const invoice = await getDocumentById(input.documentId);
  if (!invoice || invoice.kind !== "facture" || invoice.balanceDue <= 0) throw new Error("Le suivi concerne uniquement une facture avec un solde impayé.");
  const effectiveStatus = input.collectionStatus ?? invoice.collectionStatus ?? "a_traiter";
  const storedReminderDate = invoice.collectionReminderDate ? new Date(invoice.collectionReminderDate) : null;
  const candidateReminderDate = input.collectionReminderDate === undefined ? storedReminderDate : input.collectionReminderDate === null ? null : normalizeCollectionReminderDate(input.collectionReminderDate);
  const reminderDate = effectiveStatus === "a_rappeler" ? candidateReminderDate : null;
  const reminderError = validateCollectionReminder(effectiveStatus, reminderDate);
  if (reminderError) throw new Error(reminderError);
  const db = await requireDb();
  let owner: { id: number; name: string | null; email: string | null } | null = null;
  if (input.collectionOwnerId !== undefined && input.collectionOwnerId !== null) {
    const candidates = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, input.collectionOwnerId)).limit(1);
    owner = candidates[0] ?? null;
    if (!owner) throw new Error("Le responsable sélectionné est introuvable.");
  }
  const values: { collectionStatus?: CollectionFollowUpStatus; collectionReminderDate?: Date | null; collectionOwnerId?: number | null } = {};
  if (input.collectionStatus) values.collectionStatus = input.collectionStatus;
  if (input.collectionReminderDate !== undefined || (input.collectionStatus && effectiveStatus !== "a_rappeler")) values.collectionReminderDate = reminderDate;
  if (input.collectionOwnerId !== undefined) values.collectionOwnerId = input.collectionOwnerId;
  await db.update(documents).set(values).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, currentTenant())));
  const activityWrites: Array<Promise<{ id: number }>> = [];
  if (input.collectionStatus) activityWrites.push(createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "statut_recouvrement", title: `Suivi recouvrement : ${collectionFollowUpLabels[input.collectionStatus]}`, description: `Facture ${invoice.number}`, createdById: input.updatedById }));
  if (input.collectionOwnerId !== undefined) {
    const ownerName = input.collectionOwnerId === null ? "Aucun responsable" : owner?.name || owner?.email || `Utilisateur ${input.collectionOwnerId}`;
    activityWrites.push(createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "responsable_recouvrement", title: "Responsable de recouvrement mis à jour", description: `${ownerName} · Facture ${invoice.number}`, createdById: input.updatedById }));
  }
  const oldReminderKey = storedReminderDate?.toISOString().slice(0, 10) ?? null;
  const newReminderKey = reminderDate?.toISOString().slice(0, 10) ?? null;
  if (oldReminderKey !== newReminderKey) activityWrites.push(createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "date_rappel_recouvrement", title: newReminderKey ? `Rappel prévu le ${newReminderKey}` : "Date de rappel retirée", description: `Facture ${invoice.number}`, createdById: input.updatedById }));
  await Promise.all(activityWrites);
  return { success: true, collectionStatus: input.collectionStatus, collectionReminderDate: newReminderKey, collectionOwnerId: input.collectionOwnerId ?? undefined };
}

export async function reassignCollectionFollowUps(input: { documentIds: number[]; collectionOwnerId: number; updatedById: number }) {
  const documentIds = Array.from(new Set(input.documentIds));
  if (!documentIds.length || documentIds.length > 20 || documentIds.some(id => !Number.isInteger(id) || id <= 0)) throw new Error("Sélectionnez entre 1 et 20 créances valides.");
  const db = await requireDb();
  const owners = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, input.collectionOwnerId)).limit(1);
  const owner = owners[0];
  if (!owner) throw new Error("Le responsable sélectionné est introuvable.");
  const invoices = (await listDocuments("facture")).filter(invoice => documentIds.includes(invoice.id));
  if (invoices.length !== documentIds.length || invoices.some(invoice => invoice.balanceDue <= 0)) throw new Error("Toutes les créances sélectionnées doivent être ouvertes et disponibles.");
  const changedInvoices = invoices.filter(invoice => invoice.collectionOwnerId !== input.collectionOwnerId);
  if (changedInvoices.length) {
    await db.update(documents).set({ collectionOwnerId: input.collectionOwnerId }).where(inArray(documents.id, changedInvoices.map(invoice => invoice.id)));
    const ownerName = owner.name || owner.email || `Utilisateur ${owner.id}`;
    await Promise.all(changedInvoices.map(invoice => createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "responsable_recouvrement", title: "Responsable de recouvrement mis à jour", description: `${ownerName} · Facture ${invoice.number}`, createdById: input.updatedById })));
  }
  return { success: true, updatedCount: changedInvoices.length, unchangedCount: invoices.length - changedInvoices.length, collectionOwnerId: owner.id };
}

export async function getCollectionMonthlyReport(month: string) {
  if (!isCollectionReportMonth(month)) throw new Error("Le mois du rapport est invalide.");
  const { start, end } = collectionMonthBounds(month);
  const startBefore = new Date(start.getTime() - 1);
  const [receivables, people, activities, paymentRows] = await Promise.all([
    getReceivablesDashboard(),
    listCollectionAssignees(),
    (async () => {
      const db = await requireDb();
      return db.select({ id: clientActivities.id, type: clientActivities.type, title: clientActivities.title, description: clientActivities.description, createdAt: clientActivities.createdAt, documentId: documents.id, documentNumber: documents.number, clientName: clients.companyName }).from(clientActivities).innerJoin(documents, eq(clientActivities.documentId, documents.id)).innerJoin(clients, eq(documents.clientId, clients.id)).where(and(eq(documents.kind, "facture"), gt(clientActivities.createdAt, startBefore), lt(clientActivities.createdAt, end))).orderBy(desc(clientActivities.createdAt));
    })(),
    (async () => {
      const db = await requireDb();
      return db.select({ id: payments.id, documentId: documents.id, documentNumber: documents.number, clientName: clients.companyName, amount: payments.amount, paidAt: payments.paidAt }).from(payments).innerJoin(documents, eq(payments.documentId, documents.id)).innerJoin(clients, eq(documents.clientId, clients.id)).where(and(eq(documents.kind, "facture"), gt(payments.paidAt, startBefore), lt(payments.paidAt, end))).orderBy(desc(payments.paidAt));
    })(),
  ]);
  const ownerById = new Map(people.map(person => [person.id, person.name || person.email || `Utilisateur ${person.id}`]));
  const statusCounts: Record<CollectionFollowUpStatus, number> = { a_traiter: 0, contacte: 0, a_rappeler: 0 };
  receivables.invoices.forEach(invoice => { statusCounts[invoice.collectionStatus ?? "a_traiter"] += 1; });
  const activityEvents = activities.map(activity => ({ id: `activity-${activity.id}`, type: activity.type, title: activity.title, description: activity.description, documentId: activity.documentId, documentNumber: activity.documentNumber, clientName: activity.clientName, occurredAt: activity.createdAt }));
  const paymentEvents = paymentRows.map(payment => ({ id: `payment-${payment.id}`, type: "paiement_enregistre", title: `Paiement de ${payment.amount.toLocaleString("fr-GN")} GNF enregistré`, description: `Facture ${payment.documentNumber}`, documentId: payment.documentId, documentNumber: payment.documentNumber, clientName: payment.clientName, occurredAt: payment.paidAt }));
  return {
    month,
    generatedAt: new Date(),
    summary: { ...receivables.summary, statusCounts, assignedCount: receivables.invoices.filter(invoice => Boolean(invoice.collectionOwnerId)).length, activityCount: activityEvents.length + paymentEvents.length, paymentCount: paymentEvents.length, monthlyCollectedAmount: paymentRows.reduce((sum, payment) => sum + payment.amount, 0) },
    invoices: receivables.invoices.map(invoice => ({ ...invoice, collectionStatus: invoice.collectionStatus ?? "a_traiter", collectionOwnerName: invoice.collectionOwnerId ? ownerById.get(invoice.collectionOwnerId) ?? "Responsable indisponible" : null })),
    activities: [...activityEvents, ...paymentEvents].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()),
  };
}

export async function listPaymentPromises(documentIds?: number[]) {
  const db = await requireDb();
  const base = db.select({ id: paymentPromises.id, documentId: paymentPromises.documentId, promisedDate: paymentPromises.promisedDate, note: paymentPromises.note, updatedAt: paymentPromises.updatedAt }).from(paymentPromises);
  return documentIds?.length ? base.where(inArray(paymentPromises.documentId, documentIds)) : base.orderBy(desc(paymentPromises.updatedAt));
}

async function findClientByPortalEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const db = await requireDb();
  const result = await db.select({ id: clients.id, companyName: clients.companyName, contactName: clients.contactName, email: clients.email }).from(clients).where(sql`lower(${clients.email}) = ${normalized}`).limit(1);
  return result[0] ?? null;
}

export async function getClientPortalOverview(email?: string | null) {
  const client = await findClientByPortalEmail(email);
  if (!client) return { client: null, invoices: [], quotes: [] };
  const [invoices, quotes] = await Promise.all([
    listDocuments("facture"),
    listDocuments("devis"),
  ]);
  const clientInvoices = invoices.filter(invoice => invoice.clientId === client.id);
  const clientQuotes = quotes.filter(
    quote => quote.clientId === client.id && ["envoye", "accepte", "refuse"].includes(quote.status),
  );
  const promises = await listPaymentPromises(clientInvoices.map(invoice => invoice.id));
  const promisedByDocument = new Map(promises.map(promise => [promise.documentId, promise]));
  return {
    client,
    invoices: clientInvoices.map(invoice => ({ ...invoice, paymentPromise: promisedByDocument.get(invoice.id) ?? null })),
    quotes: clientQuotes,
  };
}

export async function getClientPortalInvoice(email: string | null | undefined, invoiceId: number) {
  const client = await findClientByPortalEmail(email);
  if (!client) return null;
  const invoice = await getDocumentById(invoiceId);
  if (!invoice || invoice.kind !== "facture" || invoice.clientId !== client.id) return null;
  const promise = await listPaymentPromises([invoiceId]);
  return { ...invoice, paymentPromise: promise[0] ?? null };
}

export async function getClientPortalQuote(email: string | null | undefined, quoteId: number) {
  const client = await findClientByPortalEmail(email);
  if (!client) return null;
  const quote = await getDocumentById(quoteId);
  if (!quote || quote.kind !== "devis" || quote.clientId !== client.id) return null;
  if (!["envoye", "accepte", "refuse"].includes(quote.status)) return null;
  return quote;
}

export async function respondToClientPortalQuote(input: {
  email?: string | null;
  documentId: number;
  decision: "accepte" | "refuse";
  createdById: number;
}) {
  const client = await findClientByPortalEmail(input.email);
  if (!client) throw new Error("Votre compte n’est associé à aucun dossier client.");
  const quote = await getDocumentById(input.documentId);
  if (!quote || quote.kind !== "devis" || quote.clientId !== client.id) {
    throw new Error("Ce devis n’est pas disponible pour votre compte.");
  }
  if (quote.status !== "envoye") {
    throw new Error("Ce devis n’est plus en attente de votre réponse.");
  }
  if (quote.validUntil) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validUntil = new Date(quote.validUntil);
    validUntil.setHours(0, 0, 0, 0);
    if (validUntil < today) {
      throw new Error("Ce devis a expiré. Contactez Lucepres pour une mise à jour.");
    }
  }
  await updateDocumentStatus(quote.id, input.decision, input.createdById, {
    title: input.decision === "accepte" ? "Devis accepté par le client" : "Devis refusé par le client",
    description: `${quote.number} · décision portail`,
  });
  return { success: true as const, status: input.decision, number: quote.number };
}

export async function createClientPaymentPromise(input: { email?: string | null; documentId: number; promisedDate: string; note?: string; createdById: number }) {
  const client = await findClientByPortalEmail(input.email);
  if (!client) throw new Error("Votre compte n’est associé à aucun dossier client.");
  const invoice = await getDocumentById(input.documentId);
  if (!invoice || invoice.kind !== "facture" || invoice.clientId !== client.id || invoice.balanceDue <= 0) throw new Error("Cette facture ne peut pas recevoir de promesse de paiement.");
  const promisedDate = new Date(input.promisedDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (Number.isNaN(promisedDate.getTime()) || promisedDate < today) throw new Error("La date prévue doit être aujourd’hui ou ultérieure.");
  const db = await requireDb();
  await db.insert(paymentPromises).values({ tenantId: currentTenant(), documentId: input.documentId, promisedDate, note: input.note?.trim() || null, createdById: input.createdById }).onDuplicateKeyUpdate({ set: { promisedDate, note: input.note?.trim() || null, createdById: input.createdById, updatedAt: new Date() } });
  return { success: true };
}

export async function getDocumentById(id: number) {
  const db = await requireDb();
  const header = await db
    .select({
      id: documents.id,
      kind: documents.kind,
      number: documents.number,
      status: documents.status,
      issueDate: documents.issueDate,
      dueDate: documents.dueDate,
      validUntil: documents.validUntil,
      depositPercent: documents.depositPercent,
      depositDueDate: documents.depositDueDate,
      balanceDueDate: documents.balanceDueDate,
      discountPercent: documents.discountPercent,
      discountAmount: documents.discountAmount,
      subtotal: documents.subtotal,
      taxTotal: documents.taxTotal,
      total: documents.total,
      notes: documents.notes,
      isAiDraft: documents.isAiDraft,
      collectionStatus: documents.collectionStatus,
      collectionReminderDate: documents.collectionReminderDate,
      collectionOwnerId: documents.collectionOwnerId,
      clientId: documents.clientId,
      projectId: documents.projectId,
      relatedDocumentId: documents.relatedDocumentId,
      invoiceStage: documents.invoiceStage,
      updatedAt: documents.updatedAt,
      clientName: clients.companyName,
      contactName: clients.contactName,
      clientAddress: clients.address,
      clientEmail: clients.email,
      clientTaxId: clients.taxId,
      clientRegistrationNumber: clients.registrationNumber,
      clientIdentityKind: clients.identityKind,
      projectName: projects.name,
      projectLocation: projects.location,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(and(eq(documents.id, id), eq(documents.tenantId, currentTenant())))
    .limit(1);
  if (!header[0]) return null;
  const lines = await db.select().from(documentLines).where(and(eq(documentLines.documentId, id), eq(documentLines.tenantId, currentTenant()))).orderBy(asc(documentLines.position));
  const paymentRows = await db.select().from(payments).where(and(eq(payments.documentId, id), eq(payments.tenantId, currentTenant()))).orderBy(desc(payments.paidAt), desc(payments.createdAt));
  const paidAmount = paymentRows.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = calculatePaymentBalance(header[0].total, paidAmount);
  const status = header[0].kind === "facture" ? invoicePaymentStatus(header[0].total, paidAmount, header[0].dueDate, header[0].status) : header[0].status;
  return { ...header[0], status, lines, payments: paymentRows, paidAmount, balanceDue: header[0].kind === "facture" ? balance.balanceDue : 0, isOverdue: header[0].kind === "facture" && isInvoiceOverdue(status, header[0].dueDate) };
}

export async function createDocument(input: {
  kind: DocumentKind;
  clientId: number;
  projectId?: number;
  relatedDocumentId?: number;
  status?: DocumentStatus;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  depositPercent?: number;
  depositDueDate?: string;
  balanceDueDate?: string;
  discountPercent?: number;
  notes?: string;
  isAiDraft?: boolean;
  createdById: number;
  lines: EditableDocumentLine[];
}) {
  const db = await requireDb();
  const totals = calculateDocumentDiscount(input.lines, input.discountPercent);
  const result = await db.transaction(async tx => {
    await tx
      .insert(documentSequences)
      .values({ tenantId: currentTenant(), kind: input.kind, lastValue: 1 })
      .onDuplicateKeyUpdate({ set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const sequence = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, input.kind), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const serial = sequence[0]?.lastValue ?? 1;
    const documentValues: typeof documents.$inferInsert = {
      tenantId: currentTenant(),
      kind: input.kind,
      number: formatDocumentNumber(input.kind, new Date(input.issueDate).getUTCFullYear(), serial),
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      relatedDocumentId: input.relatedDocumentId ?? null,
      status: initialDocumentStatus(input.status, Boolean(input.isAiDraft)),
      issueDate: new Date(`${input.issueDate}T00:00:00.000Z`),
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null,
      depositPercent: input.depositPercent ?? null,
      depositDueDate: input.depositDueDate ? new Date(`${input.depositDueDate}T00:00:00.000Z`) : null,
      balanceDueDate: input.balanceDueDate ? new Date(`${input.balanceDueDate}T00:00:00.000Z`) : null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.totalAfterDiscount,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      notes: input.notes || null,
      isAiDraft: input.isAiDraft ? "oui" : "non",
      createdById: input.createdById,
    };
    const documentResult = await tx.insert(documents).values(documentValues);
    const documentId = Number(documentResult[0].insertId);
    if (input.lines.length) {
      await tx.insert(documentLines).values(
        input.lines.map((line, index) => {
          const base = Math.round(line.quantity * line.unitPrice);
          const tax = Math.round((base * line.taxRate) / 100);
          return {
            tenantId: currentTenant(),
            documentId,
            position: index + 1,
            description: line.description,
            quantity: line.quantity.toFixed(2),
            unit: line.unit,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            lineTotal: base + tax,
            serviceId: line.serviceId ?? null,
          };
        }),
      );
    }
    return { id: documentId, number: formatDocumentNumber(input.kind, new Date(input.issueDate).getUTCFullYear(), serial) };
  });
  return { ...result, totals: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.totalAfterDiscount, discountPercent: totals.discountPercent, discountAmount: totals.discountAmount } };
}

export async function updateDocumentStatus(
  id: number,
  status: DocumentStatus,
  actorId?: number,
  activity?: { title?: string; description?: string },
) {
  const db = await requireDb();
  const [current] = await db
    .select({ id: documents.id, clientId: documents.clientId, number: documents.number, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, currentTenant())))
    .limit(1);
  if (!current) throw new Error("Document introuvable.");
  if (current.status === status) return { success: true as const, changed: false as const };
  await db.update(documents).set({ status }).where(and(eq(documents.id, id), eq(documents.tenantId, currentTenant())));
  if (actorId) {
    await createClientActivity({
      clientId: current.clientId,
      documentId: id,
      type: "statut_document",
      title: activity?.title ?? `Statut document : ${current.status} → ${status}`,
      description: activity?.description ?? current.number,
      createdById: actorId,
    });
  }
  return { success: true as const, changed: true as const };
}

export async function createDepositInvoiceFromQuote(quoteId: number, createdById: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const quoteRows = await tx.select().from(documents).where(and(eq(documents.id, quoteId), eq(documents.tenantId, currentTenant()))).limit(1);
    const quote = quoteRows[0];
    if (!quote || quote.kind !== "devis") throw new Error("Le devis demandé est introuvable.");
    if (quote.status !== "accepte") throw new Error("Seul un devis accepté peut générer une facture d’acompte.");
    const existing = await tx.select({ id: documents.id, number: documents.number }).from(documents).where(and(eq(documents.kind, "facture"), eq(documents.relatedDocumentId, quoteId), eq(documents.invoiceStage, "acompte"))).limit(1);
    const existingDeposit = reuseExistingGeneratedInvoice(existing[0]);
    if (existingDeposit) return existingDeposit;
    const amount = calculateDepositInvoiceAmount(quote.total, quote.depositPercent);
    await tx.insert(documentSequences).values({ tenantId: currentTenant(), kind: "facture", lastValue: 1 }).onDuplicateKeyUpdate({ set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const sequence = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, "facture"), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const serial = sequence[0]?.lastValue ?? 1;
    const number = formatDocumentNumber("facture", quote.issueDate.getUTCFullYear(), serial);
    const result = await tx.insert(documents).values({ tenantId: currentTenant(),
      kind: "facture", number, clientId: quote.clientId, projectId: quote.projectId, relatedDocumentId: quote.id, invoiceStage: "acompte",
      status: "brouillon", issueDate: new Date(), dueDate: quote.depositDueDate ?? new Date(), validUntil: null,
      depositPercent: null, depositDueDate: null, balanceDueDate: null, discountPercent: 0, discountAmount: 0,
      subtotal: amount, taxTotal: 0, total: amount,
      notes: `Facture d’acompte de ${quote.depositPercent}% générée à partir du devis ${quote.number}.`, isAiDraft: "non", createdById,
    });
    const id = Number(result[0].insertId);
    await tx.insert(documentLines).values({ tenantId: currentTenant(), documentId: id, position: 1, description: `Acompte de ${quote.depositPercent}% sur devis ${quote.number}`, quantity: "1.00", unit: "forfait", unitPrice: amount, taxRate: 0, lineTotal: amount, serviceId: null });
    return { id, number, existing: false };
  });
}

export async function createBalanceInvoiceFromDeposit(depositInvoiceId: number, createdById: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const depositRows = await tx.select().from(documents).where(and(eq(documents.id, depositInvoiceId), eq(documents.tenantId, currentTenant()))).limit(1);
    const deposit = depositRows[0];
    if (!deposit || deposit.kind !== "facture" || deposit.invoiceStage !== "acompte" || !deposit.relatedDocumentId) throw new Error("La facture d’acompte demandée est introuvable.");

    const quoteRows = await tx.select().from(documents).where(and(eq(documents.id, deposit.relatedDocumentId), eq(documents.tenantId, currentTenant()))).limit(1);
    const quote = quoteRows[0];
    if (!quote || quote.kind !== "devis" || quote.status !== "accepte") throw new Error("Le devis d’origine doit être accepté.");

    const depositPayments = await tx.select({ amount: payments.amount }).from(payments).where(and(eq(payments.documentId, deposit.id), eq(payments.tenantId, currentTenant())));
    const paidAmount = depositPayments.reduce((sum, payment) => sum + payment.amount, 0);
    assertDepositInvoiceIsFullyPaid(deposit.total, paidAmount);

    const existing = await tx.select({ id: documents.id, number: documents.number }).from(documents).where(and(eq(documents.kind, "facture"), eq(documents.relatedDocumentId, deposit.id), eq(documents.invoiceStage, "solde"))).limit(1);
    const existingBalance = reuseExistingGeneratedInvoice(existing[0]);
    if (existingBalance) return existingBalance;

    const amount = calculateBalanceInvoiceAmount(quote.total, deposit.total);
    await tx.insert(documentSequences).values({ tenantId: currentTenant(), kind: "facture", lastValue: 1 }).onDuplicateKeyUpdate({ set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const sequence = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, "facture"), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const serial = sequence[0]?.lastValue ?? 1;
    const number = formatDocumentNumber("facture", quote.issueDate.getUTCFullYear(), serial);
    const result = await tx.insert(documents).values({ tenantId: currentTenant(),
      kind: "facture", number, clientId: quote.clientId, projectId: quote.projectId, relatedDocumentId: deposit.id, invoiceStage: "solde",
      status: "brouillon", issueDate: new Date(), dueDate: quote.balanceDueDate ?? new Date(), validUntil: null,
      depositPercent: null, depositDueDate: null, balanceDueDate: null, discountPercent: 0, discountAmount: 0,
      subtotal: amount, taxTotal: 0, total: amount,
      notes: `Facture de solde générée après règlement de l’acompte lié au devis ${quote.number}.`, isAiDraft: "non", createdById,
    });
    const id = Number(result[0].insertId);
    await tx.insert(documentLines).values({ tenantId: currentTenant(), documentId: id, position: 1, description: `Solde sur devis ${quote.number} après acompte`, quantity: "1.00", unit: "forfait", unitPrice: amount, taxRate: 0, lineTotal: amount, serviceId: null });
    return { id, number, existing: false };
  });
}

export async function createInvoiceFromQuote(quoteId: number, createdById: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const quoteRows = await tx.select().from(documents).where(and(eq(documents.id, quoteId), eq(documents.tenantId, currentTenant()))).limit(1);
    const quote = quoteRows[0];
    if (!quote || quote.kind !== "devis") throw new Error("Le devis est introuvable.");
    if (quote.status !== "accepte") throw new Error("Seul un devis accepté peut être converti en facture.");
    const existing = await tx.select({ id: documents.id }).from(documents).where(and(eq(documents.kind, "facture"), eq(documents.relatedDocumentId, quoteId), eq(documents.invoiceStage, "standard"))).limit(1);
    if (existing[0]) return { id: existing[0].id, existing: true };
    const lines = await tx.select().from(documentLines).where(and(eq(documentLines.documentId, quoteId), eq(documentLines.tenantId, currentTenant()))).orderBy(documentLines.position);
    if (!lines.length) throw new Error("Le devis ne contient aucune ligne à facturer.");
    await tx.insert(documentSequences).values({ tenantId: currentTenant(), kind: "facture", lastValue: 1 }).onDuplicateKeyUpdate({ set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const seq = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, "facture"), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const number = formatDocumentNumber("facture", new Date().getUTCFullYear(), seq[0]?.lastValue ?? 1);
    const result = await tx.insert(documents).values({ tenantId: currentTenant(),
      kind: "facture", number, clientId: quote.clientId, projectId: quote.projectId, relatedDocumentId: quote.id, invoiceStage: "standard",
      status: "brouillon", issueDate: new Date(), dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000), validUntil: null,
      depositPercent: null, depositDueDate: null, balanceDueDate: null, discountPercent: quote.discountPercent, discountAmount: quote.discountAmount,
      subtotal: quote.subtotal, taxTotal: quote.taxTotal, total: quote.total,
      notes: `Facture générée à partir du devis ${quote.number}.`, isAiDraft: "non", createdById,
    });
    const id = Number(result[0].insertId);
    await tx.insert(documentLines).values(lines.map((l: any) => ({
      tenantId: currentTenant(),
      documentId: id, position: l.position, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, taxRate: l.taxRate, lineTotal: l.lineTotal, serviceId: l.serviceId,
    })));
    return { id, number, existing: false };
  });
}

export async function recordPayment(input: {
  documentId: number;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdById: number;
}) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const document = await tx.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, currentTenant()))).limit(1);
    const invoice = document[0];
    if (!invoice || invoice.kind !== "facture") throw new Error("Seules les factures peuvent recevoir un paiement.");
    if (["annule", "refuse"].includes(invoice.status)) throw new Error("Cette facture ne peut plus recevoir de paiement.");
    const existingPayments = await tx.select({ amount: payments.amount }).from(payments).where(and(eq(payments.documentId, input.documentId), eq(payments.tenantId, currentTenant())));
    const paidBefore = existingPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const balanceBefore = calculatePaymentBalance(invoice.total, paidBefore);
    if (input.amount > balanceBefore.balanceDue) throw new Error("Le montant saisi dépasse le solde restant dû.");
    const result = await tx.insert(payments).values({ tenantId: currentTenant(), documentId: input.documentId, amount: input.amount, paidAt: new Date(`${input.paidAt}T00:00:00.000Z`), method: input.method, reference: input.reference || null, notes: input.notes || null, createdById: input.createdById });
    const paidAfter = paidBefore + input.amount;
    const status = invoicePaymentStatus(invoice.total, paidAfter, invoice.dueDate, invoice.status);
    await tx.update(documents).set({ status }).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, currentTenant())));
    const methodLabel = input.method === "mobile_money" ? "Mobile Money (saisie)" : input.method;
    await tx.insert(clientActivities).values({
      tenantId: currentTenant(),
      clientId: invoice.clientId,
      documentId: input.documentId,
      type: "note",
      title: "Paiement manuel enregistré",
      description: `${invoice.number} · ${input.amount.toLocaleString("fr-GN")} GNF · ${methodLabel}${input.reference ? ` · réf. ${input.reference}` : ""}`,
      createdById: input.createdById,
    });
    return { id: Number(result[0].insertId), paidAmount: paidAfter, balanceDue: calculatePaymentBalance(invoice.total, paidAfter).balanceDue, status };
  });
}

export async function updateDocument(input: {
  id: number;
  clientId: number;
  projectId?: number;
  status: DocumentStatus;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  depositPercent?: number;
  depositDueDate?: string;
  balanceDueDate?: string;
  discountPercent?: number;
  notes?: string;
  expectedUpdatedAt?: string;
  updatedById?: number;
  lines: EditableDocumentLine[];
}) {
  const db = await requireDb();
  const totals = calculateDocumentDiscount(input.lines, input.discountPercent);
  await db.transaction(async tx => {
    const [current] = await tx.select({ id: documents.id, clientId: documents.clientId, number: documents.number, status: documents.status, updatedAt: documents.updatedAt }).from(documents).where(and(eq(documents.id, input.id), eq(documents.tenantId, currentTenant()))).limit(1);
    if (!current) throw new Error("Document introuvable.");
    if (isConcurrentDocumentUpdate(current.updatedAt, input.expectedUpdatedAt)) {
      throw new Error("Ce document a été modifié ailleurs. Rechargez la page avant d’enregistrer.");
    }
    await tx.update(documents).set({
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      status: input.status,
      issueDate: new Date(`${input.issueDate}T00:00:00.000Z`),
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null,
      depositPercent: input.depositPercent ?? null,
      depositDueDate: input.depositDueDate ? new Date(`${input.depositDueDate}T00:00:00.000Z`) : null,
      balanceDueDate: input.balanceDueDate ? new Date(`${input.balanceDueDate}T00:00:00.000Z`) : null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.totalAfterDiscount,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      notes: input.notes || null,
    }).where(and(eq(documents.id, input.id), eq(documents.tenantId, currentTenant())));
    await tx.delete(documentLines).where(and(eq(documentLines.documentId, input.id), eq(documentLines.tenantId, currentTenant())));
    await tx.insert(documentLines).values(input.lines.map((line, index) => {
      const base = Math.round(line.quantity * line.unitPrice);
      const tax = Math.round((base * line.taxRate) / 100);
      return {
        tenantId: currentTenant(),
        documentId: input.id,
        position: index + 1,
        description: line.description,
        quantity: line.quantity.toFixed(2),
        unit: line.unit,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        lineTotal: base + tax,
        serviceId: line.serviceId ?? null,
      };
    }));
    if (input.updatedById && current.status !== input.status) {
      await tx.insert(clientActivities).values({
        tenantId: currentTenant(),
        clientId: current.clientId,
        documentId: input.id,
        type: "statut_document",
        title: `Statut document : ${current.status} → ${input.status}`,
        description: current.number,
        createdById: input.updatedById,
      });
    }
  });
  return { success: true, totals: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.totalAfterDiscount, discountPercent: totals.discountPercent, discountAmount: totals.discountAmount } };
}

export async function getDashboardData() {
  const allDocuments = await listDocuments();
  const now = new Date();
  const priority = allDocuments.filter(document => document.status === "a_envoyer" || (document.kind === "facture" && document.dueDate && document.dueDate < now && !["paye", "annule", "refuse"].includes(document.status))).slice(0, 6);
  return {
    counts: summarizeDashboard(allDocuments, now),
    priority,
  };
}

/* ------------------------------------------------------------------ */
/* Templates d'e-mail                                                  */
/* ------------------------------------------------------------------ */

/**
 * Liste les templates d'e-mail du tenant actuel + les templates globaux (tenantId NULL).
 * Les templates tenant-spécifiques sont prioritaires.
 */
export async function listEmailTemplates(): Promise<(typeof emailTemplates.$inferSelect)[]> {
  const db = await requireDb();
  const tenantId = currentTenant();
  const rows = await db.select().from(emailTemplates).where(
    tenantId
      ? or(eq(emailTemplates.tenantId, tenantId), sql`${emailTemplates.tenantId} IS NULL`)
      : sql`${emailTemplates.tenantId} IS NULL`
  );
  // Dédoublonne par slug : le template tenant est prioritaire
  const bySlug = new Map<string, typeof emailTemplates.$inferSelect>();
  for (const row of rows) {
    const existing = bySlug.get(row.slug);
    if (!existing || (existing.tenantId === null && row.tenantId !== null)) {
      bySlug.set(row.slug, row);
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Récupère un template par slug (tenant-spécifique puis global).
 */
export async function getEmailTemplateBySlug(slug: string): Promise<typeof emailTemplates.$inferSelect | undefined> {
  const db = await requireDb();
  const tenantId = currentTenant();
  // 1. Template tenant-spécifique
  if (tenantId) {
    const [tenantTemplate] = await db.select().from(emailTemplates).where(
      and(eq(emailTemplates.slug, slug), eq(emailTemplates.tenantId, tenantId))
    ).limit(1);
    if (tenantTemplate) return tenantTemplate;
  }
  // 2. Fallback sur le template global
  const [globalTemplate] = await db.select().from(emailTemplates).where(
    and(eq(emailTemplates.slug, slug), sql`${emailTemplates.tenantId} IS NULL`)
  ).limit(1);
  return globalTemplate;
}

/**
 * Crée un template d'e-mail.
 */
export async function createEmailTemplate(input: {
  slug: string;
  name: string;
  subject: string;
  html: string;
  text?: string;
  tenantId?: number | null;
}): Promise<{ id: number }> {
  const db = await requireDb();
  const [row] = await db
    .insert(emailTemplates)
    .values({
      slug: input.slug,
      name: input.name,
      subject: input.subject,
      html: input.html,
      text: input.text ?? null,
      tenantId: input.tenantId ?? currentTenant(),
    })
    .$returningId();
  return { id: row.id };
}

/**
 * Met à jour un template d'e-mail.
 */
export async function updateEmailTemplate(
  id: number,
  input: Partial<{
    name: string;
    subject: string;
    html: string;
    text: string;
    enabled: "oui" | "non";
  }>
): Promise<void> {
  const db = await requireDb();
  await db.update(emailTemplates).set(input).where(eq(emailTemplates.id, id));
}

/**
 * Supprime un template d'e-mail.
 */
export async function deleteEmailTemplate(id: number): Promise<void> {
  const db = await requireDb();
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
}

/**
 * Rend un template en remplaçant les {{variable}} par leurs valeurs.
 * Utilise le template de la DB (si activé), sinon le catalogue statique partagé.
 */
export async function renderEmailTemplate(
  slug: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string; text: string } | null> {
  const template = await getEmailTemplateBySlug(slug);
  if (template && template.enabled !== "non") {
    let subject = template.subject;
    let html = template.html;
    let text = template.text ?? "";

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
      text = text.replace(regex, value);
    }

    return { subject, html, text };
  }

  const { renderEmailTemplate: renderStatic, EMAIL_TEMPLATES } = await import("../shared/emailTemplates");
  const staticId = EMAIL_TEMPLATES.find(entry => entry.id === slug)?.id;
  if (!staticId) return null;
  return renderStatic(staticId, variables);
}

/**
 * Seed les templates par défaut (invitation, password-reset) s'ils n'existent pas.
 * Appelé au démarrage du serveur.
 */
export async function seedDefaultEmailTemplates(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const defaults = [
    {
      slug: "invitation",
      name: "Invitation à rejoindre Lucepress",
      subject: "Invitation à rejoindre {{organization}}",
      html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6f9fc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #1a1a2e; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Invitation à rejoindre {{organization}}</h1>
    <p>Bonjour,</p>
    <p><strong>{{inviterName}}</strong> vous invite à créer un compte sur <strong>{{organization}}</strong>.</p>
    <p style="text-align:center;">
      <a class="button" href="{{inviteLink}}">Accepter l'invitation</a>
    </p>
    <p>Ce lien expirera le <strong>{{expiresAt}}</strong>.</p>
    <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="word-break:break-all; font-size:13px; color:#4f46e5;">{{inviteLink}}</p>
    <div class="footer">
      Cet e-mail a été envoyé automatiquement. Si vous n'attendiez aucune invitation, ignorez ce message.
    </div>
  </div>
</body>
</html>`,
      text: "{{inviterName}} vous invite à rejoindre {{organization}}.\n\nAccepter l'invitation : {{inviteLink}}\n\nCe lien expirera le {{expiresAt}}.",
    },
    {
      slug: "password-reset",
      name: "Réinitialisation de mot de passe",
      subject: "Réinitialisation de votre mot de passe",
      html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de mot de passe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6f9fc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #1a1a2e; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #888; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Réinitialisation de votre mot de passe</h1>
    <p>Bonjour,</p>
    <p>Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Lucepress.</p>
    <p style="text-align:center;">
      <a class="button" href="{{resetLink}}">Créer un nouveau mot de passe</a>
    </p>
    <div class="warning">
      ⏱ Ce lien expirera dans <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.
    </div>
    <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="word-break:break-all; font-size:13px; color:#4f46e5;">{{resetLink}}</p>
    <div class="footer">
      <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail — votre mot de passe reste inchangé.</p>
      <p>Cet e-mail a été envoyé automatiquement.</p>
    </div>
  </div>
</body>
</html>`,
      text: "Réinitialisation de votre mot de passe\n\nCréer un nouveau mot de passe : {{resetLink}}\n\nCe lien expirera dans 1 heure.",
    },
  ];

  for (const def of defaults) {
    const [existing] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(
      and(eq(emailTemplates.slug, def.slug), sql`${emailTemplates.tenantId} IS NULL`)
    ).limit(1);
    if (!existing) {
      await db.insert(emailTemplates).values({
        slug: def.slug,
        name: def.name,
        subject: def.subject,
        html: def.html,
        text: def.text,
        tenantId: null,
      });
      console.log(`[email-templates] Template par défaut créé : ${def.slug}`);
    }
  }
}
