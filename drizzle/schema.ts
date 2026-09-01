import {
  bigint,
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  plan: mysqlEnum("plan", ["trial", "pro", "enterprise"]).default("trial").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  trialEndsAt: timestamp("trialEndsAt"),
  status: mysqlEnum("status", ["active", "trial", "suspended", "cancelled"]).default("trial").notNull(),
  currency: varchar("currency", { length: 3 }).default("GNF").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tenantMemberships = mysqlTable(
  "tenant_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [unique("tenant_memberships_user_tenant_unique").on(table.userId, table.tenantId)],
);

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").references(() => tenants.id, { onDelete: "set null" }),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Invitations par e-mail (token + lien sécurisé).
 * Le token brut est généré côté serveur et ne circule qu'une fois (dans le lien
 * envoyé à l'invité). En base on ne stocke QUE son empreinte (scrypt), jamais le
 * token en clair, pour limiter l'impact d'une fuite de la table.
 */
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  invitedBy: int("invitedBy").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "revoked"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedByUser: int("acceptedByUser"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("invitations_email_idx").on(table.email), index("invitations_status_idx").on(table.status)]);

export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    companyName: varchar("companyName", { length: 180 }).notNull(),
    contactName: varchar("contactName", { length: 180 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    address: text("address"),
    taxId: varchar("taxId", { length: 100 }),
    notes: text("notes"),
    defaultDiscountPercent: int("defaultDiscountPercent").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("clients_companyName_idx").on(table.companyName)],
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 180 }).notNull(),
    reference: varchar("reference", { length: 80 }),
    type: mysqlEnum("type", ["btp", "forage", "mixte"]).notNull(),
    status: mysqlEnum("status", ["actif", "en_pause", "termine"])
      .default("actif")
      .notNull(),
    location: varchar("location", { length: 255 }),
    description: text("description"),
    plannedBudget: bigint("plannedBudget", { mode: "number" }).default(0).notNull(),
    minimumMarginRate: int("minimumMarginRate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("projects_clientId_idx").on(table.clientId),
    index("projects_status_idx").on(table.status),
  ],
);

export const projectCosts = mysqlTable(
  "project_costs",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: mysqlEnum("category", ["materiaux", "main_oeuvre", "transport", "equipement", "sous_traitance", "autre"]).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    incurredAt: date("incurredAt").notNull(),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_costs_project_date_idx").on(table.projectId, table.incurredAt), index("project_costs_category_idx").on(table.category)],
);

export const projectCostAttachments = mysqlTable(
  "project_cost_attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    projectCostId: int("projectCostId").notNull().references(() => projectCosts.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    size: int("size").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 512 }).notNull(),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_cost_attachments_cost_idx").on(table.projectCostId)],
);

export const services = mysqlTable(
  "services",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    category: mysqlEnum("category", [
      "btp",
      "forage",
      "hydraulique",
      "hygiene",
      "maintenance",
      "etude",
      "transport",
      "autre",
    ]).default("autre").notNull(),
    description: text("description"),
    unit: varchar("unit", { length: 30 }).default("unité").notNull(),
    defaultUnitPrice: bigint("defaultUnitPrice", { mode: "number" }).default(0).notNull(),
    defaultTaxRate: int("defaultTaxRate").default(0).notNull(),
    isActive: mysqlEnum("isActive", ["oui", "non"]).default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [unique("services_code_unique").on(table.code)],
);

export const servicePriceRevisions = mysqlTable(
  "service_price_revisions",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    serviceId: int("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
    previousUnitPrice: bigint("previousUnitPrice", { mode: "number" }).notNull(),
    nextUnitPrice: bigint("nextUnitPrice", { mode: "number" }).notNull(),
    previousTaxRate: int("previousTaxRate").notNull(),
    nextTaxRate: int("nextTaxRate").notNull(),
    changedById: int("changedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("service_price_revisions_serviceId_createdAt_idx").on(table.serviceId, table.createdAt)],
);

export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["devis", "facture"]).notNull(),
    number: varchar("number", { length: 80 }).notNull(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    relatedDocumentId: int("relatedDocumentId"),
    invoiceStage: mysqlEnum("invoiceStage", ["standard", "acompte", "solde"]).default("standard").notNull(),
    status: mysqlEnum("status", [
      "brouillon",
      "a_envoyer",
      "envoye",
      "accepte",
      "refuse",
      "partiellement_paye",
      "paye",
      "en_retard",
      "annule",
    ])
      .default("brouillon")
      .notNull(),
    issueDate: date("issueDate").notNull(),
    dueDate: date("dueDate"),
    validUntil: date("validUntil"),
    depositPercent: int("depositPercent"),
    depositDueDate: date("depositDueDate"),
    balanceDueDate: date("balanceDueDate"),
    discountPercent: int("discountPercent").default(0).notNull(),
    discountAmount: bigint("discountAmount", { mode: "number" }).default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("GNF").notNull(),
    subtotal: bigint("subtotal", { mode: "number" }).default(0).notNull(),
    taxTotal: bigint("taxTotal", { mode: "number" }).default(0).notNull(),
    total: bigint("total", { mode: "number" }).default(0).notNull(),
    notes: text("notes"),
    isAiDraft: mysqlEnum("isAiDraft", ["oui", "non"]).default("non").notNull(),
    collectionStatus: mysqlEnum("collectionStatus", ["a_traiter", "contacte", "a_rappeler"]).default("a_traiter").notNull(),
    collectionReminderDate: date("collectionReminderDate"),
    collectionOwnerId: int("collectionOwnerId").references(() => users.id, { onDelete: "set null" }),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

export const documentLines = mysqlTable(
  "document_lines",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: int("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: int("position").notNull(),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
    unit: varchar("unit", { length: 30 }).default("unité").notNull(),
    unitPrice: bigint("unitPrice", { mode: "number" }).default(0).notNull(),
    taxRate: int("taxRate").default(0).notNull(),
    lineTotal: bigint("lineTotal", { mode: "number" }).default(0).notNull(),
    serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  },
  table => [
    index("document_lines_documentId_idx").on(table.documentId),
    unique("document_lines_document_position_unique").on(table.documentId, table.position),
  ],
);

export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: int("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    paidAt: date("paidAt").notNull(),
    method: mysqlEnum("method", ["especes", "virement", "cheque", "mobile_money", "autre"])
      .default("autre")
      .notNull(),
    reference: varchar("reference", { length: 120 }),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("payments_documentId_idx").on(table.documentId),
    index("payments_paidAt_idx").on(table.paidAt),
  ],
);

export const paymentPromises = mysqlTable(
  "payment_promises",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
    promisedDate: date("promisedDate").notNull(),
    note: varchar("note", { length: 500 }),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [unique("payment_promises_document_unique").on(table.documentId), index("payment_promises_date_idx").on(table.promisedDate)],
);

export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  legalName: varchar("legalName", { length: 180 }).default("Lucepress").notNull(),
  legalAddress: text("legalAddress"),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  taxId: varchar("taxId", { length: 100 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  bankName: varchar("bankName", { length: 180 }),
  accountName: varchar("accountName", { length: 180 }),
  accountNumber: varchar("accountNumber", { length: 120 }),
  iban: varchar("iban", { length: 120 }),
  swift: varchar("swift", { length: 32 }),
  paymentInstructions: text("paymentInstructions"),
  documentFooter: text("documentFooter"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clientAttachments = mysqlTable(
  "client_attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    size: int("size").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 512 }).notNull(),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("client_attachments_clientId_idx").on(table.clientId)],
);

export const clientActivities = mysqlTable(
  "client_activities",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
    type: mysqlEnum("type", ["relance_preparee", "note", "statut_recouvrement", "responsable_recouvrement", "date_rappel_recouvrement"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("client_activities_clientId_createdAt_idx").on(table.clientId, table.createdAt)],
);

export const integrationProviders = mysqlTable(
  "integration_providers",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: mysqlEnum("category", ["communication", "collaboration", "chantier", "comptabilite"]).notNull(),
    transport: mysqlEnum("transport", ["api", "mcp"]).notNull(),
    documentationUrl: varchar("documentationUrl", { length: 512 }),
    authType: mysqlEnum("authType", ["oauth2", "api_key", "none"]).notNull(),
    isSupported: mysqlEnum("isSupported", ["oui", "non"]).default("oui").notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [unique("integration_providers_slug_unique").on(table.slug), index("integration_providers_category_idx").on(table.category, table.sortOrder)],
);

export const integrationCapabilities = mysqlTable(
  "integration_capabilities",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("providerId").notNull().references(() => integrationProviders.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 100 }).notNull(),
    label: varchar("label", { length: 180 }).notNull(),
    direction: mysqlEnum("direction", ["lecture", "ecriture", "bidirectionnel"]).notNull(),
    riskLevel: mysqlEnum("riskLevel", ["faible", "moyen", "eleve"]).default("moyen").notNull(),
    requiresApproval: mysqlEnum("requiresApproval", ["oui", "non"]).default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [unique("integration_capabilities_provider_code_unique").on(table.providerId, table.code), index("integration_capabilities_provider_idx").on(table.providerId)],
);

export const integrationConnections = mysqlTable(
  "integration_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    providerId: int("providerId").notNull().references(() => integrationProviders.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["eligible", "credentials_pending", "testing", "active", "degraded", "revoked", "disabled"]).default("eligible").notNull(),
    grantedScopes: text("grantedScopes"),
    /** Référence opaque vers un gestionnaire de secrets ; aucune clé n’est stockée ici. */
    secretRef: varchar("secretRef", { length: 255 }),
    lastHealthCheckAt: timestamp("lastHealthCheckAt"),
    lastError: text("lastError"),
    enabledById: int("enabledById").references(() => users.id, { onDelete: "set null" }),
    connectedAt: timestamp("connectedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [unique("integration_connections_provider_unique").on(table.providerId), index("integration_connections_status_idx").on(table.status)],
);

export const integrationJobs = mysqlTable(
  "integration_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    connectionId: int("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    operation: varchar("operation", { length: 100 }).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
    payloadHash: varchar("payloadHash", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["queued", "approved", "running", "completed", "failed", "cancelled"]).default("queued").notNull(),
    attempts: int("attempts").default(0).notNull(),
    lastError: text("lastError"),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    approvalNote: varchar("approvalNote", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [unique("integration_jobs_idempotency_unique").on(table.idempotencyKey), index("integration_jobs_connection_status_idx").on(table.connectionId, table.status)],
);

export const integrationMappings = mysqlTable(
  "integration_mappings",
  {
    id: int("id").autoincrement().primaryKey(),
    connectionId: int("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    internalId: int("internalId").notNull(),
    externalId: varchar("externalId", { length: 255 }).notNull(),
    externalVersion: varchar("externalVersion", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [unique("integration_mappings_connection_entity_internal_unique").on(table.connectionId, table.entityType, table.internalId), index("integration_mappings_external_idx").on(table.connectionId, table.externalId)],
);

export const integrationAuditLogs = mysqlTable(
  "integration_audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    connectionId: int("connectionId").references(() => integrationConnections.id, { onDelete: "set null" }),
    actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    target: varchar("target", { length: 255 }),
    decision: mysqlEnum("decision", ["autorise", "refuse", "information"]).default("information").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("integration_audit_logs_connection_created_idx").on(table.connectionId, table.createdAt), index("integration_audit_logs_actor_created_idx").on(table.actorId, table.createdAt)],
);

export const integrationOauthSessions = mysqlTable(
  "integration_oauth_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    connectionId: int("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    providerId: int("providerId").notNull().references(() => integrationProviders.id, { onDelete: "cascade" }),
    clientId: varchar("clientId", { length: 255 }).notNull(),
    redirectUri: varchar("redirectUri", { length: 512 }).notNull(),
    requestedScopes: text("requestedScopes").notNull(),
    stateHash: varchar("stateHash", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["authorization_ready", "completed", "failed", "expired"]).default("authorization_ready").notNull(),
    error: text("error"),
    expiresAt: timestamp("expiresAt").notNull(),
    completedAt: timestamp("completedAt"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [unique("integration_oauth_sessions_state_hash_unique").on(table.stateHash), index("integration_oauth_sessions_connection_status_idx").on(table.connectionId, table.status)],
);

export const integrationWebhookEvents = mysqlTable(
  "integration_webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    connectionId: int("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    externalEventId: varchar("externalEventId", { length: 255 }).notNull(),
    eventType: varchar("eventType", { length: 120 }).notNull(),
    deliveryStatus: varchar("deliveryStatus", { length: 120 }),
    signatureStatus: mysqlEnum("signatureStatus", ["valid", "invalid", "pending"]).default("pending").notNull(),
    processingStatus: mysqlEnum("processingStatus", ["accepted", "rejected", "processed", "failed"]).default("accepted").notNull(),
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
export const agentOperatorGrants = mysqlTable(
  "agent_operator_grants",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["directeur_general", "responsable_commercial"]).notNull(),
    canApprove: mysqlEnum("canApprove", ["oui", "non"]).default("oui").notNull(),
    canActivate: mysqlEnum("canActivate", ["oui", "non"]).default("non").notNull(),
    scope: mysqlEnum("scope", ["global", "commercial"]).default("commercial").notNull(),
    status: mysqlEnum("status", ["active", "suspendue", "revoquee"]).default("active").notNull(),
    expiresAt: timestamp("expiresAt"),
    grantedById: int("grantedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    unique("agent_operator_grants_user_role_unique").on(table.userId, table.role),
    index("agent_operator_grants_user_status_idx").on(table.userId, table.status),
  ],
);

/** Politique bornée dans laquelle l’agent peut seulement préparer ou simuler des messages. */
export const agentDelegations = mysqlTable(
  "agent_delegations",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    purpose: mysqlEnum("purpose", ["relance_facture", "suivi_devis"]).notNull(),
    channel: mysqlEnum("channel", ["email", "whatsapp"]).notNull(),
    tone: mysqlEnum("tone", ["courtois", "professionnel", "ferme", "commercial"]).default("professionnel").notNull(),
    status: mysqlEnum("status", ["brouillon", "a_approuver", "active_simulation", "suspendue", "expiree", "revoquee"]).default("brouillon").notNull(),
    startsAt: timestamp("startsAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    dailyLimit: int("dailyLimit").default(60).notNull(),
    contactCooldownDays: int("contactCooldownDays").default(7).notNull(),
    requiresSecondApproval: mysqlEnum("requiresSecondApproval", ["oui", "non"]).default("non").notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    policyVersion: int("policyVersion").default(1).notNull(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    secondApprovedById: int("secondApprovedById").references(() => users.id, { onDelete: "set null" }),
    secondApprovedAt: timestamp("secondApprovedAt"),
    activatedById: int("activatedById").references(() => users.id, { onDelete: "set null" }),
    suspendedById: int("suspendedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("agent_delegations_owner_status_idx").on(table.ownerId, table.status),
    index("agent_delegations_status_expiry_idx").on(table.status, table.expiresAt),
    index("agent_delegations_schedule_uid_idx").on(table.scheduleCronTaskUid),
  ],
);

/** Campagne rattachée à une délégation, conçue pour rester simulée tant que les canaux ne sont pas activés. */
export const agentCampaigns = mysqlTable(
  "agent_campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    delegationId: int("delegationId").notNull().references(() => agentDelegations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["brouillon", "simulee", "a_approuver", "approuvee", "active_simulation", "suspendue", "archivee"]).default("brouillon").notNull(),
    scheduledFor: timestamp("scheduledFor"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    scheduleCronExpression: varchar("scheduleCronExpression", { length: 80 }),
    scheduleTimeZone: varchar("scheduleTimeZone", { length: 80 }).default("Africa/Conakry").notNull(),
    nextExecutionAt: timestamp("nextExecutionAt"),
    lastExecutedAt: timestamp("lastExecutedAt"),
    lastExecutionStatus: mysqlEnum("lastExecutionStatus", ["pending", "success", "skipped", "failed"]).default("pending").notNull(),
    eligibleCount: int("eligibleCount").default(0).notNull(),
    preparedById: int("preparedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    secondApprovedById: int("secondApprovedById").references(() => users.id, { onDelete: "set null" }),
    secondApprovedAt: timestamp("secondApprovedAt"),
    activatedById: int("activatedById").references(() => users.id, { onDelete: "set null" }),
    suspendedById: int("suspendedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("agent_campaigns_delegation_status_idx").on(table.delegationId, table.status),
    index("agent_campaigns_scheduled_status_idx").on(table.scheduledFor, table.status),
    index("agent_campaigns_schedule_uid_idx").on(table.scheduleCronTaskUid),
  ],
);

/** Éléments de la simulation, sans contenu transmis à un fournisseur externe. */
export const agentMessageJobs = mysqlTable(
  "agent_message_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").notNull().references(() => agentCampaigns.id, { onDelete: "cascade" }),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
    documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    contentHash: varchar("contentHash", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["simulation_prete", "remis_test", "bloquee", "annulee"]).default("simulation_prete").notNull(),
    blockedReason: varchar("blockedReason", { length: 500 }),
    scheduledFor: timestamp("scheduledFor"),
    policySnapshot: text("policySnapshot").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    unique("agent_message_jobs_idempotency_unique").on(table.idempotencyKey),
    index("agent_message_jobs_campaign_status_idx").on(table.campaignId, table.status),
    index("agent_message_jobs_document_idx").on(table.documentId),
  ],
);

/** Boîte d’envoi de test : une copie interne, jamais transmise à un fournisseur e-mail. */
export const agentTestEmailDeliveries = mysqlTable(
  "agent_test_email_deliveries",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").notNull().references(() => agentCampaigns.id, { onDelete: "cascade" }),
    messageJobId: int("messageJobId").notNull().references(() => agentMessageJobs.id, { onDelete: "cascade" }),
    testRecipient: varchar("testRecipient", { length: 255 }).default("Boîte de test Lucepress").notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["previsualise", "remis_test", "annule"]).default("previsualise").notNull(),
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
export const agentAuditLogs = mysqlTable(
  "agent_audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    delegationId: int("delegationId").references(() => agentDelegations.id, { onDelete: "set null" }),
    campaignId: int("campaignId").references(() => agentCampaigns.id, { onDelete: "set null" }),
    actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    target: varchar("target", { length: 255 }),
    decision: mysqlEnum("decision", ["autorise", "refuse", "information"]).default("information").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("agent_audit_logs_delegation_date_idx").on(table.delegationId, table.createdAt),
    index("agent_audit_logs_campaign_date_idx").on(table.campaignId, table.createdAt),
    index("agent_audit_logs_actor_date_idx").on(table.actorId, table.createdAt),
  ],
);

export const documentSequences = mysqlTable(
  "document_sequences",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["devis", "facture"]).notNull(),
    lastValue: int("lastValue").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [unique("document_sequences_kind_unique").on(table.kind)],
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
