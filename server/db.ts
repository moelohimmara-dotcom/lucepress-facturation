import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  clients,
  documentLines,
  documents,
  documentSequences,
  InsertUser,
  payments,
  projects,
  services,
  users,
} from "../drizzle/schema";
import { calculateDocumentTotals, calculatePaymentBalance, formatDocumentNumber, initialDocumentStatus, invoicePaymentStatus, isInvoiceOverdue, summarizeDashboard, type DocumentKind, type DocumentStatus, type EditableDocumentLine, type PaymentMethod } from "../shared/billing";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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

export async function listClients() {
  const db = await requireDb();
  return db.select().from(clients).orderBy(asc(clients.companyName));
}

export async function createClient(input: {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
}) {
  const db = await requireDb();
  const result = await db.insert(clients).values({
    companyName: input.companyName,
    contactName: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    taxId: input.taxId || null,
    notes: input.notes || null,
  });
  return { id: Number(result[0].insertId) };
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
      clientId: projects.clientId,
      clientName: clients.companyName,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .orderBy(desc(projects.createdAt));
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
  const result = await db.insert(projects).values({
    ...input,
    reference: input.reference || null,
    location: input.location || null,
    description: input.description || null,
  });
  return { id: Number(result[0].insertId) };
}

export async function listServices() {
  const db = await requireDb();
  return db.select().from(services).orderBy(asc(services.category), asc(services.name));
}

export async function createService(input: {
  code: string;
  name: string;
  category: "btp" | "forage" | "etude" | "transport" | "autre";
  description?: string;
  unit: string;
  defaultUnitPrice: number;
  defaultTaxRate: number;
}) {
  const db = await requireDb();
  const result = await db.insert(services).values({
    ...input,
    description: input.description || null,
  });
  return { id: Number(result[0].insertId) };
}

export async function listDocuments(kind?: DocumentKind) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: documents.id,
      kind: documents.kind,
      number: documents.number,
      status: documents.status,
      issueDate: documents.issueDate,
      dueDate: documents.dueDate,
      validUntil: documents.validUntil,
      total: documents.total,
      subtotal: documents.subtotal,
      taxTotal: documents.taxTotal,
      isAiDraft: documents.isAiDraft,
      clientId: clients.id,
      clientName: clients.companyName,
      projectId: projects.id,
      projectName: projects.name,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .orderBy(desc(documents.updatedAt));
  const paymentRows = await db.select({ documentId: payments.documentId, paidAmount: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).groupBy(payments.documentId);
  const paidByDocument = new Map(paymentRows.map(row => [row.documentId, Number(row.paidAmount)]));
  const enriched = rows.map(row => {
    const paidAmount = row.kind === "facture" ? (paidByDocument.get(row.id) ?? 0) : 0;
    const balance = calculatePaymentBalance(row.total, paidAmount);
    const status = row.kind === "facture" ? invoicePaymentStatus(row.total, paidAmount, row.dueDate, row.status) : row.status;
    return { ...row, status, paidAmount, balanceDue: row.kind === "facture" ? balance.balanceDue : 0, isOverdue: row.kind === "facture" && isInvoiceOverdue(status, row.dueDate) };
  });
  return kind ? enriched.filter(row => row.kind === kind) : enriched;
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
      subtotal: documents.subtotal,
      taxTotal: documents.taxTotal,
      total: documents.total,
      notes: documents.notes,
      isAiDraft: documents.isAiDraft,
      clientId: documents.clientId,
      projectId: documents.projectId,
      clientName: clients.companyName,
      contactName: clients.contactName,
      clientAddress: clients.address,
      clientEmail: clients.email,
      projectName: projects.name,
      projectLocation: projects.location,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(eq(documents.id, id))
    .limit(1);
  if (!header[0]) return null;
  const lines = await db.select().from(documentLines).where(eq(documentLines.documentId, id)).orderBy(asc(documentLines.position));
  const paymentRows = await db.select().from(payments).where(eq(payments.documentId, id)).orderBy(desc(payments.paidAt), desc(payments.createdAt));
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
  notes?: string;
  isAiDraft?: boolean;
  createdById: number;
  lines: EditableDocumentLine[];
}) {
  const db = await requireDb();
  const totals = calculateDocumentTotals(input.lines);
  const result = await db.transaction(async tx => {
    await tx
      .insert(documentSequences)
      .values({ kind: input.kind, lastValue: 1 })
      .onDuplicateKeyUpdate({ set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const sequence = await tx.select().from(documentSequences).where(eq(documentSequences.kind, input.kind)).limit(1);
    const serial = sequence[0]?.lastValue ?? 1;
    const documentValues: typeof documents.$inferInsert = {
      kind: input.kind,
      number: formatDocumentNumber(input.kind, new Date(input.issueDate).getUTCFullYear(), serial),
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      relatedDocumentId: input.relatedDocumentId ?? null,
      status: initialDocumentStatus(input.status, Boolean(input.isAiDraft)),
      issueDate: new Date(`${input.issueDate}T00:00:00.000Z`),
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
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
  return { ...result, totals };
}

export async function updateDocumentStatus(id: number, status: DocumentStatus) {
  const db = await requireDb();
  await db.update(documents).set({ status }).where(eq(documents.id, id));
  return { success: true };
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
    const document = await tx.select().from(documents).where(eq(documents.id, input.documentId)).limit(1);
    const invoice = document[0];
    if (!invoice || invoice.kind !== "facture") throw new Error("Seules les factures peuvent recevoir un paiement.");
    if (["annule", "refuse"].includes(invoice.status)) throw new Error("Cette facture ne peut plus recevoir de paiement.");
    const existingPayments = await tx.select({ amount: payments.amount }).from(payments).where(eq(payments.documentId, input.documentId));
    const paidBefore = existingPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const balanceBefore = calculatePaymentBalance(invoice.total, paidBefore);
    if (input.amount > balanceBefore.balanceDue) throw new Error("Le montant saisi dépasse le solde restant dû.");
    const result = await tx.insert(payments).values({ documentId: input.documentId, amount: input.amount, paidAt: new Date(`${input.paidAt}T00:00:00.000Z`), method: input.method, reference: input.reference || null, notes: input.notes || null, createdById: input.createdById });
    const paidAfter = paidBefore + input.amount;
    const status = invoicePaymentStatus(invoice.total, paidAfter, invoice.dueDate, invoice.status);
    await tx.update(documents).set({ status }).where(eq(documents.id, input.documentId));
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
  notes?: string;
  lines: EditableDocumentLine[];
}) {
  const db = await requireDb();
  const totals = calculateDocumentTotals(input.lines);
  await db.transaction(async tx => {
    await tx.update(documents).set({
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      status: input.status,
      issueDate: new Date(`${input.issueDate}T00:00:00.000Z`),
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      notes: input.notes || null,
    }).where(eq(documents.id, input.id));
    await tx.delete(documentLines).where(eq(documentLines.documentId, input.id));
    await tx.insert(documentLines).values(input.lines.map((line, index) => {
      const base = Math.round(line.quantity * line.unitPrice);
      const tax = Math.round((base * line.taxRate) / 100);
      return {
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
  });
  return { success: true, totals };
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
