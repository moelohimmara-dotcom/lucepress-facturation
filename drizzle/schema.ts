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

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
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
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("projects_clientId_idx").on(table.clientId),
    index("projects_status_idx").on(table.status),
  ],
);

export const services = mysqlTable(
  "services",
  {
    id: int("id").autoincrement().primaryKey(),
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
  ],
);

export const documentLines = mysqlTable(
  "document_lines",
  {
    id: int("id").autoincrement().primaryKey(),
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

export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
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
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
    type: mysqlEnum("type", ["relance_preparee", "note"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("client_activities_clientId_createdAt_idx").on(table.clientId, table.createdAt)],
);

export const documentSequences = mysqlTable(
  "document_sequences",
  {
    id: int("id").autoincrement().primaryKey(),
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
export type Service = typeof services.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentLine = typeof documentLines.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;
export type ClientAttachment = typeof clientAttachments.$inferSelect;
export type ClientActivity = typeof clientActivities.$inferSelect;
