import {
  bigint,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["trial", "pro", "enterprise"]);
export const status_active_trialEnum = pgEnum("status_active_trial", ["active", "trial", "suspended", "cancelled"]);
export const role_admin_memberEnum = pgEnum("role_admin_member", ["admin", "member", "viewer"]);
export const role_admin_directeurEnum = pgEnum("role_admin_directeur", ["admin", "directeur", "cadre", "client"]);
export const status_pending_acceptedEnum = pgEnum("status_pending_accepted", ["pending", "accepted", "revoked"]);
export const identityKindEnum = pgEnum("identityKind", ["immatriculee", "en_immatriculation", "personne_physique", "sans_immatriculation", "autre"]);
export const type_btp_forageEnum = pgEnum("type_btp_forage", ["btp", "forage", "mixte"]);
export const status_actif_en_pauseEnum = pgEnum("status_actif_en_pause", ["actif", "en_pause", "termine"]);
export const category_materiaux_main_oeuvreEnum = pgEnum("category_materiaux_main_oeuvre", ["materiaux", "main_oeuvre", "transport", "equipement", "sous_traitance", "autre"]);
export const category_btp_forageEnum = pgEnum("category_btp_forage", [
      "btp",
      "forage",
      "hydraulique",
      "hygiene",
      "maintenance",
      "etude",
      "transport",
      "autre",
    ]);
export const isActiveEnum = pgEnum("isActive", ["oui", "non"]);
export const kindEnum = pgEnum("kind", ["devis", "facture"]);
export const invoiceStageEnum = pgEnum("invoiceStage", ["standard", "acompte", "solde"]);
export const status_brouillon_a_envoyerEnum = pgEnum("status_brouillon_a_envoyer", [
      "brouillon",
      "a_envoyer",
      "envoye",
      "accepte",
      "refuse",
      "partiellement_paye",
      "paye",
      "en_retard",
      "annule",
    ]);
export const isAiDraftEnum = pgEnum("isAiDraft", ["oui", "non"]);
export const collectionStatusEnum = pgEnum("collectionStatus", ["a_traiter", "contacte", "a_rappeler"]);
export const methodEnum = pgEnum("method", ["especes", "virement", "cheque", "mobile_money", "autre"]);
export const type_relance_preparee_noteEnum = pgEnum("type_relance_preparee_note", ["relance_preparee", "note", "statut_recouvrement", "responsable_recouvrement", "date_rappel_recouvrement", "email_envoye", "statut_document"]);
export const category_communication_collaborationEnum = pgEnum("category_communication_collaboration", ["communication", "collaboration", "chantier", "comptabilite"]);
export const transportEnum = pgEnum("transport", ["api", "mcp"]);
export const authTypeEnum = pgEnum("authType", ["oauth2", "api_key", "none"]);
export const isSupportedEnum = pgEnum("isSupported", ["oui", "non"]);
export const directionEnum = pgEnum("direction", ["lecture", "ecriture", "bidirectionnel"]);
export const riskLevelEnum = pgEnum("riskLevel", ["faible", "moyen", "eleve"]);
export const requiresApprovalEnum = pgEnum("requiresApproval", ["oui", "non"]);
export const status_eligible_credentials_pendingEnum = pgEnum("status_eligible_credentials_pending", ["eligible", "credentials_pending", "testing", "active", "degraded", "revoked", "disabled"]);
export const status_queued_approvedEnum = pgEnum("status_queued_approved", ["queued", "approved", "running", "completed", "failed", "cancelled"]);
export const decisionEnum = pgEnum("decision", ["autorise", "refuse", "information"]);
export const status_authorization_ready_completedEnum = pgEnum("status_authorization_ready_completed", ["authorization_ready", "completed", "failed", "expired"]);
export const signatureStatusEnum = pgEnum("signatureStatus", ["valid", "invalid", "pending"]);
export const processingStatusEnum = pgEnum("processingStatus", ["accepted", "rejected", "processed", "failed"]);
export const role_directeur_general_responsable_commercialEnum = pgEnum("role_directeur_general_responsable_commercial", ["directeur_general", "responsable_commercial"]);
export const canApproveEnum = pgEnum("canApprove", ["oui", "non"]);
export const canActivateEnum = pgEnum("canActivate", ["oui", "non"]);
export const scopeEnum = pgEnum("scope", ["global", "commercial"]);
export const status_active_suspendueEnum = pgEnum("status_active_suspendue", ["active", "suspendue", "revoquee"]);
export const purposeEnum = pgEnum("purpose", ["relance_facture", "suivi_devis"]);
export const channelEnum = pgEnum("channel", ["email", "whatsapp"]);
export const toneEnum = pgEnum("tone", ["courtois", "professionnel", "ferme", "commercial"]);
export const status_brouillon_a_approuverEnum = pgEnum("status_brouillon_a_approuver", ["brouillon", "a_approuver", "active_simulation", "suspendue", "expiree", "revoquee"]);
export const requiresSecondApprovalEnum = pgEnum("requiresSecondApproval", ["oui", "non"]);
export const status_brouillon_simuleeEnum = pgEnum("status_brouillon_simulee", ["brouillon", "simulee", "a_approuver", "approuvee", "active_simulation", "suspendue", "archivee"]);
export const lastExecutionStatusEnum = pgEnum("lastExecutionStatus", ["pending", "success", "skipped", "failed"]);
export const status_simulation_prete_remis_testEnum = pgEnum("status_simulation_prete_remis_test", ["simulation_prete", "remis_test", "bloquee", "annulee"]);
export const status_previsualise_remis_testEnum = pgEnum("status_previsualise_remis_test", ["previsualise", "remis_test", "annule"]);
export const enabledEnum = pgEnum("enabled", ["oui", "non"]);

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  plan: planEnum("plan").default("trial").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  trialEndsAt: timestamp("trialEndsAt"),
  status: status_active_trialEnum("status").default("trial").notNull(),
  currency: varchar("currency", { length: 3 }).default("GNF").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
});

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    role: role_admin_memberEnum("role").default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [unique("tenant_memberships_user_tenant_unique").on(table.userId, table.tenantId)],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").references(() => tenants.id, { onDelete: "set null" }),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: role_admin_directeurEnum("role").default("cadre").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Invitations par e-mail (token + lien sécurisé).
 * Le token brut est généré côté serveur et ne circule qu'une fois (dans le lien
 * envoyé à l'invité). En base on ne stocke QUE son empreinte (scrypt), jamais le
 * token en clair, pour limiter l'impact d'une fuite de la table.
 */
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: role_admin_directeurEnum("role").default("cadre").notNull(),
  invitedBy: integer("invitedBy").notNull(),
  status: status_pending_acceptedEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedByUser: integer("acceptedByUser"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("invitations_email_idx").on(table.email), index("invitations_status_idx").on(table.status)]);

/**
 * Réinitialisation de mot de passe (flux "Mot de passe oublié").
 * Le token brut est généré côté serveur et ne circule qu'une fois (dans le lien
 * envoyé à l'utilisateur). En base on ne stocke QUE son empreinte (scrypt).
 */
export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("password_resets_user_idx").on(table.userId), index("password_resets_status_idx").on(table.expiresAt)]);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    companyName: varchar("companyName", { length: 180 }).notNull(),
    contactName: varchar("contactName", { length: 180 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    address: text("address"),
    taxId: varchar("taxId", { length: 100 }),
    identityKind: identityKindEnum("identityKind")
      .default("immatriculee")
      .notNull(),
    registrationNumber: varchar("registrationNumber", { length: 100 }),
    notes: text("notes"),
    defaultDiscountPercent: integer("defaultDiscountPercent").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [index("clients_companyName_idx").on(table.companyName)],
);

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 180 }).notNull(),
    reference: varchar("reference", { length: 80 }),
    type: type_btp_forageEnum("type").notNull(),
    status: status_actif_en_pauseEnum("status")
      .default("actif")
      .notNull(),
    location: varchar("location", { length: 255 }),
    description: text("description"),
    plannedBudget: bigint("plannedBudget", { mode: "number" }).default(0).notNull(),
    minimumMarginRate: integer("minimumMarginRate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [
    index("projects_clientId_idx").on(table.clientId),
    index("projects_status_idx").on(table.status),
  ],
);

export const projectCosts = pgTable(
  "project_costs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: category_materiaux_main_oeuvreEnum("category").notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    incurredAt: date("incurredAt", { mode: "date" }).notNull(),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_costs_project_date_idx").on(table.projectId, table.incurredAt), index("project_costs_category_idx").on(table.category)],
);

export const projectCostAttachments = pgTable(
  "project_cost_attachments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    projectCostId: integer("projectCostId").notNull().references(() => projectCosts.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    size: integer("size").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 512 }).notNull(),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_cost_attachments_cost_idx").on(table.projectCostId)],
);

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    category: category_btp_forageEnum("category").default("autre").notNull(),
    description: text("description"),
    unit: varchar("unit", { length: 30 }).default("unité").notNull(),
    defaultUnitPrice: bigint("defaultUnitPrice", { mode: "number" }).default(0).notNull(),
    defaultTaxRate: integer("defaultTaxRate").default(0).notNull(),
    isActive: isActiveEnum("isActive").default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [unique("services_code_unique").on(table.code)],
);

export const servicePriceRevisions = pgTable(
  "service_price_revisions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    serviceId: integer("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
    previousUnitPrice: bigint("previousUnitPrice", { mode: "number" }).notNull(),
    nextUnitPrice: bigint("nextUnitPrice", { mode: "number" }).notNull(),
    previousTaxRate: integer("previousTaxRate").notNull(),
    nextTaxRate: integer("nextTaxRate").notNull(),
    changedById: integer("changedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("service_price_revisions_serviceId_createdAt_idx").on(table.serviceId, table.createdAt)],
);

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    kind: kindEnum("kind").notNull(),
    number: varchar("number", { length: 80 }).notNull(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    projectId: integer("projectId").references(() => projects.id, { onDelete: "set null" }),
    relatedDocumentId: integer("relatedDocumentId"),
    invoiceStage: invoiceStageEnum("invoiceStage").default("standard").notNull(),
    status: status_brouillon_a_envoyerEnum("status")
      .default("brouillon")
      .notNull(),
    issueDate: date("issueDate", { mode: "date" }).notNull(),
    dueDate: date("dueDate", { mode: "date" }),
    validUntil: date("validUntil", { mode: "date" }),
    depositPercent: integer("depositPercent"),
    depositDueDate: date("depositDueDate", { mode: "date" }),
    balanceDueDate: date("balanceDueDate", { mode: "date" }),
    discountPercent: integer("discountPercent").default(0).notNull(),
    discountAmount: bigint("discountAmount", { mode: "number" }).default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("GNF").notNull(),
    subtotal: bigint("subtotal", { mode: "number" }).default(0).notNull(),
    taxTotal: bigint("taxTotal", { mode: "number" }).default(0).notNull(),
    total: bigint("total", { mode: "number" }).default(0).notNull(),
    notes: text("notes"),
    isAiDraft: isAiDraftEnum("isAiDraft").default("non").notNull(),
    collectionStatus: collectionStatusEnum("collectionStatus").default("a_traiter").notNull(),
    collectionReminderDate: date("collectionReminderDate", { mode: "date" }),
    collectionOwnerId: integer("collectionOwnerId").references(() => users.id, { onDelete: "set null" }),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [
    unique("documents_number_unique").on(table.number),
    index("documents_kind_status_idx").on(table.kind, table.status),
    index("documents_clientId_idx").on(table.clientId),
    index("documents_dueDate_idx").on(table.dueDate),
    index("documents_related_stage_idx").on(table.relatedDocumentId, table.invoiceStage),
    index("documents_collection_owner_status_idx").on(table.collectionOwnerId, table.collectionStatus),
    index("documents_updatedAt_idx").on(table.updatedAt),
    index("documents_kind_updatedAt_idx").on(table.kind, table.updatedAt),
    index("documents_projectId_idx").on(table.projectId),
  ],
);

export const documentLines = pgTable(
  "document_lines",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
    unit: varchar("unit", { length: 30 }).default("unité").notNull(),
    unitPrice: bigint("unitPrice", { mode: "number" }).default(0).notNull(),
    taxRate: integer("taxRate").default(0).notNull(),
    lineTotal: bigint("lineTotal", { mode: "number" }).default(0).notNull(),
    serviceId: integer("serviceId").references(() => services.id, { onDelete: "set null" }),
  },
  table => [
    index("document_lines_documentId_idx").on(table.documentId),
    unique("document_lines_document_position_unique").on(table.documentId, table.position),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    paidAt: date("paidAt", { mode: "date" }).notNull(),
    method: methodEnum("method")
      .default("autre")
      .notNull(),
    reference: varchar("reference", { length: 120 }),
    notes: text("notes"),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("payments_documentId_idx").on(table.documentId),
    index("payments_paidAt_idx").on(table.paidAt),
  ],
);

export const paymentPromises = pgTable(
  "payment_promises",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
    promisedDate: date("promisedDate", { mode: "date" }).notNull(),
    note: varchar("note", { length: 500 }),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [unique("payment_promises_document_unique").on(table.documentId), index("payment_promises_date_idx").on(table.promisedDate)],
);

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  legalName: varchar("legalName", { length: 180 }).default("Lucepress").notNull(),
  legalAddress: text("legalAddress"),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  identityKind: identityKindEnum("identityKind")
    .default("immatriculee")
    .notNull(),
  taxId: varchar("taxId", { length: 100 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  bankName: varchar("bankName", { length: 180 }),
  accountName: varchar("accountName", { length: 180 }),
  accountNumber: varchar("accountNumber", { length: 120 }),
  iban: varchar("iban", { length: 120 }),
  swift: varchar("swift", { length: 32 }),
  paymentInstructions: text("paymentInstructions"),
  documentFooter: text("documentFooter"),
  updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
});

export const clientAttachments = pgTable(
  "client_attachments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    size: integer("size").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 512 }).notNull(),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("client_attachments_clientId_idx").on(table.clientId)],
);

export const clientActivities = pgTable(
  "client_activities",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    documentId: integer("documentId").references(() => documents.id, { onDelete: "set null" }),
    type: type_relance_preparee_noteEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("client_activities_clientId_createdAt_idx").on(table.clientId, table.createdAt)],
);

export const documentShareLinks = pgTable(
  "document_share_links",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    recipientEmail: varchar("recipientEmail", { length: 320 }),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    lastAccessAt: timestamp("lastAccessAt"),
    accessCount: integer("accessCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("document_share_links_document_idx").on(table.documentId, table.revokedAt),
    index("document_share_links_tenant_expires_idx").on(table.tenantId, table.expiresAt),
  ],
);

export const integrationProviders = pgTable(
  "integration_providers",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: category_communication_collaborationEnum("category").notNull(),
    transport: transportEnum("transport").notNull(),
    documentationUrl: varchar("documentationUrl", { length: 512 }),
    authType: authTypeEnum("authType").notNull(),
    isSupported: isSupportedEnum("isSupported").default("oui").notNull(),
    sortOrder: integer("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [unique("integration_providers_slug_unique").on(table.slug), index("integration_providers_category_idx").on(table.category, table.sortOrder)],
);

export const integrationCapabilities = pgTable(
  "integration_capabilities",
  {
    id: serial("id").primaryKey(),
    providerId: integer("providerId").notNull().references(() => integrationProviders.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 100 }).notNull(),
    label: varchar("label", { length: 180 }).notNull(),
    direction: directionEnum("direction").notNull(),
    riskLevel: riskLevelEnum("riskLevel").default("moyen").notNull(),
    requiresApproval: requiresApprovalEnum("requiresApproval").default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [unique("integration_capabilities_provider_code_unique").on(table.providerId, table.code), index("integration_capabilities_provider_idx").on(table.providerId)],
);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    providerId: integer("providerId").notNull().references(() => integrationProviders.id, { onDelete: "restrict" }),
    status: status_eligible_credentials_pendingEnum("status").default("eligible").notNull(),
    grantedScopes: text("grantedScopes"),
    /** Référence opaque vers un gestionnaire de secrets ; aucune clé n’est stockée ici. */
    secretRef: varchar("secretRef", { length: 255 }),
    lastHealthCheckAt: timestamp("lastHealthCheckAt"),
    lastError: text("lastError"),
    enabledById: integer("enabledById").references(() => users.id, { onDelete: "set null" }),
    connectedAt: timestamp("connectedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [unique("integration_connections_provider_unique").on(table.providerId), index("integration_connections_status_idx").on(table.status)],
);

export const integrationJobs = pgTable(
  "integration_jobs",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    operation: varchar("operation", { length: 100 }).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
    payloadHash: varchar("payloadHash", { length: 128 }).notNull(),
    status: status_queued_approvedEnum("status").default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("lastError"),
    approvedById: integer("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    approvalNote: varchar("approvalNote", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [unique("integration_jobs_idempotency_unique").on(table.idempotencyKey), index("integration_jobs_connection_status_idx").on(table.connectionId, table.status)],
);

export const integrationMappings = pgTable(
  "integration_mappings",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    internalId: integer("internalId").notNull(),
    externalId: varchar("externalId", { length: 255 }).notNull(),
    externalVersion: varchar("externalVersion", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [unique("integration_mappings_connection_entity_internal_unique").on(table.connectionId, table.entityType, table.internalId), index("integration_mappings_external_idx").on(table.connectionId, table.externalId)],
);

export const integrationAuditLogs = pgTable(
  "integration_audit_logs",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").references(() => integrationConnections.id, { onDelete: "set null" }),
    actorId: integer("actorId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    target: varchar("target", { length: 255 }),
    decision: decisionEnum("decision").default("information").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("integration_audit_logs_connection_created_idx").on(table.connectionId, table.createdAt), index("integration_audit_logs_actor_created_idx").on(table.actorId, table.createdAt)],
);

export const integrationOauthSessions = pgTable(
  "integration_oauth_sessions",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    providerId: integer("providerId").notNull().references(() => integrationProviders.id, { onDelete: "cascade" }),
    clientId: varchar("clientId", { length: 255 }).notNull(),
    redirectUri: varchar("redirectUri", { length: 512 }).notNull(),
    requestedScopes: text("requestedScopes").notNull(),
    stateHash: varchar("stateHash", { length: 128 }).notNull(),
    status: status_authorization_ready_completedEnum("status").default("authorization_ready").notNull(),
    error: text("error"),
    expiresAt: timestamp("expiresAt").notNull(),
    completedAt: timestamp("completedAt"),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [unique("integration_oauth_sessions_state_hash_unique").on(table.stateHash), index("integration_oauth_sessions_connection_status_idx").on(table.connectionId, table.status)],
);

export const integrationWebhookEvents = pgTable(
  "integration_webhook_events",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    externalEventId: varchar("externalEventId", { length: 255 }).notNull(),
    eventType: varchar("eventType", { length: 120 }).notNull(),
    deliveryStatus: varchar("deliveryStatus", { length: 120 }),
    signatureStatus: signatureStatusEnum("signatureStatus").default("pending").notNull(),
    processingStatus: processingStatusEnum("processingStatus").default("accepted").notNull(),
    payloadHash: varchar("payloadHash", { length: 128 }).notNull(),
    summary: varchar("summary", { length: 500 }),
    error: text("error"),
    occurredAt: timestamp("occurredAt").notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
  },
  table => [unique("integration_webhook_events_connection_external_unique").on(table.connectionId, table.externalEventId), index("integration_webhook_events_connection_received_idx").on(table.connectionId, table.receivedAt), index("integration_webhook_events_signature_idx").on(table.signatureStatus, table.receivedAt)],
);

/** Attribution nominative, limitée et révocable des responsabilités de l’agent. */
export const agentOperatorGrants = pgTable(
  "agent_operator_grants",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: role_directeur_general_responsable_commercialEnum("role").notNull(),
    canApprove: canApproveEnum("canApprove").default("oui").notNull(),
    canActivate: canActivateEnum("canActivate").default("non").notNull(),
    scope: scopeEnum("scope").default("commercial").notNull(),
    status: status_active_suspendueEnum("status").default("active").notNull(),
    expiresAt: timestamp("expiresAt"),
    grantedById: integer("grantedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [
    unique("agent_operator_grants_user_role_unique").on(table.userId, table.role),
    index("agent_operator_grants_user_status_idx").on(table.userId, table.status),
  ],
);

/** Politique bornée dans laquelle l’agent peut seulement préparer ou simuler des messages. */
export const agentDelegations = pgTable(
  "agent_delegations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    purpose: purposeEnum("purpose").notNull(),
    channel: channelEnum("channel").notNull(),
    tone: toneEnum("tone").default("professionnel").notNull(),
    status: status_brouillon_a_approuverEnum("status").default("brouillon").notNull(),
    startsAt: timestamp("startsAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    dailyLimit: integer("dailyLimit").default(60).notNull(),
    contactCooldownDays: integer("contactCooldownDays").default(7).notNull(),
    requiresSecondApproval: requiresSecondApprovalEnum("requiresSecondApproval").default("non").notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    policyVersion: integer("policyVersion").default(1).notNull(),
    ownerId: integer("ownerId").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: integer("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    secondApprovedById: integer("secondApprovedById").references(() => users.id, { onDelete: "set null" }),
    secondApprovedAt: timestamp("secondApprovedAt"),
    activatedById: integer("activatedById").references(() => users.id, { onDelete: "set null" }),
    suspendedById: integer("suspendedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [
    index("agent_delegations_owner_status_idx").on(table.ownerId, table.status),
    index("agent_delegations_status_expiry_idx").on(table.status, table.expiresAt),
    index("agent_delegations_schedule_uid_idx").on(table.scheduleCronTaskUid),
  ],
);

/** Campagne rattachée à une délégation, conçue pour rester simulée tant que les canaux ne sont pas activés. */
export const agentCampaigns = pgTable(
  "agent_campaigns",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    delegationId: integer("delegationId").notNull().references(() => agentDelegations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    status: status_brouillon_simuleeEnum("status").default("brouillon").notNull(),
    scheduledFor: timestamp("scheduledFor"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    scheduleCronExpression: varchar("scheduleCronExpression", { length: 80 }),
    scheduleTimeZone: varchar("scheduleTimeZone", { length: 80 }).default("Africa/Conakry").notNull(),
    nextExecutionAt: timestamp("nextExecutionAt"),
    lastExecutedAt: timestamp("lastExecutedAt"),
    lastExecutionStatus: lastExecutionStatusEnum("lastExecutionStatus").default("pending").notNull(),
    eligibleCount: integer("eligibleCount").default(0).notNull(),
    preparedById: integer("preparedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: integer("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    secondApprovedById: integer("secondApprovedById").references(() => users.id, { onDelete: "set null" }),
    secondApprovedAt: timestamp("secondApprovedAt"),
    activatedById: integer("activatedById").references(() => users.id, { onDelete: "set null" }),
    suspendedById: integer("suspendedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [
    index("agent_campaigns_delegation_status_idx").on(table.delegationId, table.status),
    index("agent_campaigns_scheduled_status_idx").on(table.scheduledFor, table.status),
    index("agent_campaigns_schedule_uid_idx").on(table.scheduleCronTaskUid),
  ],
);

/** Éléments de la simulation, sans contenu transmis à un fournisseur externe. */
export const agentMessageJobs = pgTable(
  "agent_message_jobs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: integer("campaignId").notNull().references(() => agentCampaigns.id, { onDelete: "cascade" }),
    clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
    documentId: integer("documentId").notNull().references(() => documents.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    contentHash: varchar("contentHash", { length: 128 }).notNull(),
    status: status_simulation_prete_remis_testEnum("status").default("simulation_prete").notNull(),
    blockedReason: varchar("blockedReason", { length: 500 }),
    scheduledFor: timestamp("scheduledFor"),
    policySnapshot: text("policySnapshot").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [
    unique("agent_message_jobs_idempotency_unique").on(table.idempotencyKey),
    index("agent_message_jobs_campaign_status_idx").on(table.campaignId, table.status),
    index("agent_message_jobs_document_idx").on(table.documentId),
  ],
);

/** Boîte d’envoi de test : une copie interne, jamais transmise à un fournisseur e-mail. */
export const agentTestEmailDeliveries = pgTable(
  "agent_test_email_deliveries",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: integer("campaignId").notNull().references(() => agentCampaigns.id, { onDelete: "cascade" }),
    messageJobId: integer("messageJobId").notNull().references(() => agentMessageJobs.id, { onDelete: "cascade" }),
    testRecipient: varchar("testRecipient", { length: 255 }).default("Boîte de test Lucepress").notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    status: status_previsualise_remis_testEnum("status").default("previsualise").notNull(),
    runKey: varchar("runKey", { length: 255 }).notNull(),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    unique("agent_test_email_deliveries_run_key_unique").on(table.runKey),
    index("agent_test_email_deliveries_campaign_date_idx").on(table.campaignId, table.createdAt),
    index("agent_test_email_deliveries_job_idx").on(table.messageJobId),
  ],
);

/** Journal inviolable du cycle de décision de l’agent et de ses responsables. */
export const agentAuditLogs = pgTable(
  "agent_audit_logs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    delegationId: integer("delegationId").references(() => agentDelegations.id, { onDelete: "set null" }),
    campaignId: integer("campaignId").references(() => agentCampaigns.id, { onDelete: "set null" }),
    actorId: integer("actorId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    target: varchar("target", { length: 255 }),
    decision: decisionEnum("decision").default("information").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("agent_audit_logs_delegation_date_idx").on(table.delegationId, table.createdAt),
    index("agent_audit_logs_campaign_date_idx").on(table.campaignId, table.createdAt),
    index("agent_audit_logs_actor_date_idx").on(table.actorId, table.createdAt),
  ],
);

export const documentSequences = pgTable(
  "document_sequences",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    kind: kindEnum("kind").notNull(),
    lastValue: integer("lastValue").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [unique("document_sequences_kind_unique").on(table.kind)],
);

/**
 * Templates d'e-mail éditables par l'admin.
 * - `slug` identifie de manière unique le type d'e-mail (ex. "invitation", "password-reset", "invoice").
 * - `subject` est le sujet du mail (supporte la syntaxe {{variable}}).
 * - `html` est le contenu HTML du mail (supporte la syntaxe {{variable}}).
 * - `tenantId` null = template global (par défaut pour tous), sinon spécifique à un tenant.
 * Les templates globaux sont utilisés si aucun template tenant-spécifique n'existe.
 */
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").references(() => tenants.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    html: text("html").notNull(),
    text: text("text"),
    enabled: enabledEnum("enabled").default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  },
  table => [
    unique("email_templates_tenant_slug_unique").on(table.tenantId, table.slug),
    index("email_templates_slug_idx").on(table.slug),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectCost = typeof projectCosts.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentLine = typeof documentLines.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;
export type ClientAttachment = typeof clientAttachments.$inferSelect;
export type ClientActivity = typeof clientActivities.$inferSelect;
export type IntegrationProvider = typeof integrationProviders.$inferSelect;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;
