import { and, eq, inArray } from "drizzle-orm";
import { sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  clientActivities,
  clientAttachments,
  clients,
  documentLines,
  documentShareLinks,
  documents,
  paymentPromises,
  payments,
} from "../drizzle/schema";
import { getDb } from "./db";
import { classifyConsoleOutcome, type ConsoleActor } from "./systemAccounts";
import { logConsoleAction } from "./systemAccessLog";
import {
  DEMO_COUNT_LABELS,
  MAX_SELECTED_CLIENTS,
  readDemoScope,
  type DataDeps,
  type DemoRecordCounts,
  type DemoScopeClient,
  type RawQueryRunner,
} from "./systemData";
import {
  issueExportToken,
  verifyExportToken,
  type ExportTokenReason,
  type ExportTokenScope,
} from "./systemDataExportToken";

/**
 * EXPORT PRÉALABLE ET PURGE SÉLECTIVE — LE SEUL ENDROIT DE LA CONSOLE QUI
 * DÉTRUIT DES DONNÉES MÉTIER.
 *
 * Trois verrous, dans cet ordre, et aucun ne se contourne :
 *
 *  1. UNE LISTE EXPLICITE D’IDENTIFIANTS. Jamais un motif, jamais « tout ce qui
 *     ressemble ». Le serveur REVALIDE chaque identifiant contre l’inventaire :
 *     un client qui ne porte aucun motif de donnée de recette est refusé, même
 *     si l’appelant l’a demandé. Sans cette revérification, un identifiant
 *     forgé suffirait à supprimer un vrai client.
 *  2. UNE PHRASE DE CONFIRMATION EXACTE, portant le NOMBRE ANNONCÉ. Le nombre
 *     est recalculé par le serveur au moment du geste, jamais repris de la
 *     requête : on ne peut donc pas confirmer « 3 » et en supprimer 300.
 *  3. UN EXPORT PRÉALABLE DU MÊME PÉRIMÈTRE, prouvé par un jeton signé et
 *     court (voir `systemDataExportToken.ts`). On ne détruit pas sans filet.
 *
 * CE QUE CE MODULE NE TOUCHE JAMAIS
 * ---------------------------------
 * Ni `users`, ni `company_settings`, ni une seule table d’intégration. La liste
 * des tables supprimables est une constante fermée (`purgeTableOf`), et un test
 * relit ce fichier pour vérifier qu’aucune autre n’y apparaît. Ajouter une table
 * à cette liste est donc un acte délibéré, visible en revue.
 *
 * LE NOMBRE ANNONCÉ EST VÉRIFIÉ APRÈS COUP
 * ----------------------------------------
 * `count(*)` mesuré avant, `returning` compté après, dans la MÊME transaction.
 * Le moindre écart annule tout : c’est la seule façon d’être sûr que
 * l’inventaire affiché à l’écran dit la vérité sur ce qui a été supprimé.
 */

/* ------------------------------------------------------------------ */
/* Plan de suppression — PURE, donc vérifiable sans base               */
/* ------------------------------------------------------------------ */

/** Tables que la purge a le droit de vider. Liste FERMÉE. */
export type PurgeTable =
  | "document_lines"
  | "payments"
  | "payment_promises"
  | "document_share_links"
  | "client_activities"
  | "client_attachments"
  | "documents"
  | "clients";

/** Colonne de rattachement, déduite de la table — jamais fournie par l’appelant. */
export type PurgeColumn = "documentId" | "clientId" | "id";

/**
 * Un ordre de suppression.
 *
 * `values` ne contient QUE des identifiants du périmètre sélectionné, et
 * `expected` est le nombre de lignes que l’inventaire a annoncé pour cette
 * table. Les deux sont séparés parce qu’ils ne comptent pas la même chose : pour
 * `document_lines`, `values` est la liste des documents et `expected` le nombre
 * de lignes. Les confondre serait la façon la plus directe d’annoncer un faux
 * total.
 */
export type PurgeStatement = {
  table: PurgeTable;
  column: PurgeColumn;
  values: number[];
  expected: number;
};

/** Colonne filtrée par table. Écrite ici UNE fois, et jamais ailleurs. */
const PURGE_TABLE_COLUMNS: Record<PurgeTable, PurgeColumn> = {
  document_lines: "documentId",
  payments: "documentId",
  payment_promises: "documentId",
  document_share_links: "documentId",
  client_activities: "clientId",
  client_attachments: "clientId",
  documents: "clientId",
  clients: "id",
};

/** Libellés des tables purgées, dans l’ordre de suppression. */
export const PURGE_TABLE_LABELS: ReadonlyArray<{ table: PurgeTable; label: string; countKey: keyof DemoRecordCounts | null }> = [
  { table: "document_lines", label: "Lignes de document", countKey: "documentLines" },
  { table: "payments", label: "Paiements", countKey: "payments" },
  { table: "payment_promises", label: "Promesses de paiement", countKey: "paymentPromises" },
  { table: "document_share_links", label: "Liens de partage", countKey: "shareLinks" },
  { table: "client_activities", label: "Activités client", countKey: "activities" },
  { table: "client_attachments", label: "Pièces jointes client", countKey: "attachments" },
  { table: "documents", label: "Documents", countKey: "documents" },
  { table: "clients", label: "Clients", countKey: null },
];

/**
 * ORDRE DE SUPPRESSION SÛR — les enfants avant les parents.
 *
 * Cet ordre n’est pas une précaution de style : `documents."clientId"` et
 * `projects."clientId"` sont en `on delete restrict`, donc supprimer un client
 * avant ses documents échouerait. Les tables filles des documents
 * (`document_lines`, `payments`, `payment_promises`, `document_share_links`) les
 * suivraient par cascade, mais on les nomme explicitement : c’est ce qui permet
 * de COMPTER ce qui disparaît, et donc de le comparer à ce qui a été annoncé.
 */
export function planPurgeStatements(input: {
  clients: readonly DemoScopeClient[];
  documents: readonly { id: number; clientId: number }[];
}): PurgeStatement[] {
  const clientIds = input.clients.map(client => client.clientId);
  const documentIds = input.documents.map(document => document.id);
  const sum = (key: keyof DemoRecordCounts) => input.clients.reduce((total, client) => total + client.counts[key], 0);

  return PURGE_TABLE_LABELS.map(entry => {
    const isClientScoped = PURGE_TABLE_COLUMNS[entry.table] !== "documentId";
    const values = isClientScoped ? clientIds : documentIds;
    const expected = entry.countKey === null ? clientIds.length : sum(entry.countKey);
    return { table: entry.table, column: PURGE_TABLE_COLUMNS[entry.table], values, expected };
    // Une table dont l’inventaire annonce ZÉRO ligne n’est pas visitée : émettre
    // un `delete` qui ne peut rien trouver ajoute un geste sans rien apporter, et
    // chaque geste en moins est une occasion de moins de se tromper de cible.
  }).filter(statement => statement.values.length > 0 && statement.expected > 0);
}

/** Total attendu d’un plan : doit coïncider avec la somme des inventaires. */
export function expectedTotalOf(statements: readonly PurgeStatement[]): number {
  return statements.reduce((total, statement) => total + statement.expected, 0);
}

/* ------------------------------------------------------------------ */
/* Phrase de confirmation                                              */
/* ------------------------------------------------------------------ */

/**
 * Phrase exacte attendue. Le nombre y est ÉCRIT EN CHIFFRES, et il vient du
 * serveur : l’écran ne fait que le recopier, il ne le choisit pas.
 */
export function expectedConfirmation(totalRecords: number): string {
  return `SUPPRIMER ${totalRecords} ENREGISTREMENTS`;
}

/**
 * Compare la phrase saisie à celle attendue.
 *
 * Seuls les ESPACES sont normalisés (espaces insécables d’un copier-coller,
 * espaces multiples, bords) : la casse, elle, doit être exacte. Assouplir la
 * casse retirerait à la recopie ce qu’elle apporte — un geste délibéré.
 */
export function confirmationMatches(value: unknown, totalRecords: number): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.replace(/[\s\u00a0]+/g, " ").trim();
  return normalized === expectedConfirmation(totalRecords);
}

/* ------------------------------------------------------------------ */
/* Sélection revalidée côté serveur                                    */
/* ------------------------------------------------------------------ */

/** Le périmètre retenu, une fois chaque identifiant revalidé contre l’inventaire. */
export type SelectedScope = {
  clients: DemoScopeClient[];
  documents: Array<{ id: number; clientId: number }>;
  totalRecords: number;
};

function refuse(code: "NOT_FOUND" | "PRECONDITION_FAILED" | "BAD_REQUEST", message: string): never {
  throw new TRPCError({ code, message });
}

/** Normalise une liste d’identifiants reçue du réseau : entiers positifs, uniques. */
export function normalizeSelectedIds(clientIds: readonly number[]): number[] {
  return Array.from(new Set(clientIds.filter(id => Number.isInteger(id) && id > 0))).sort((a, b) => a - b);
}

/**
 * Charge les documents du périmètre. Lecture stricte : même filtre que la
 * suppression (tenant + identifiants sélectionnés), pour que le décompte et le
 * geste portent sur le même ensemble.
 */
async function loadScopeDocuments(
  runQuery: RawQueryRunner,
  tenantId: number,
  clientIds: readonly number[],
): Promise<Array<{ id: number; clientId: number }>> {
  const rows = await runQuery(sql`
    select "id", "clientId"
    from documents
    where "tenantId" = ${tenantId} and "clientId" in (${sql.join(
      clientIds.map(id => sql`${id}`),
      sql`, `,
    )})
    order by "id" asc
  `);
  return rows
    .map(row => ({ id: Number(row.id), clientId: Number(row.clientId) }))
    .filter(row => Number.isInteger(row.id) && row.id > 0);
}

/**
 * REVALIDATION — le cœur du refus « par ressemblance ».
 *
 * Chaque identifiant demandé doit être, DANS L’INVENTAIRE COURANT, un candidat
 * purgeable. Trois refus distincts, parce qu’ils n’appellent pas la même
 * réaction : le client n’existe pas, il existe mais ne porte aucun motif de
 * donnée de recette, ou il en porte un mais quelque chose interdit sa purge.
 */
async function resolveSelection(
  deps: DataDeps,
  tenantId: number | null,
  clientIds: readonly number[],
): Promise<SelectedScope> {
  if (tenantId === null) {
    refuse("PRECONDITION_FAILED", "Aucune instance associée à cette session : aucune donnée n’a été modifiée.");
  }
  if (clientIds.length === 0) {
    refuse("BAD_REQUEST", "Aucun enregistrement n’a été sélectionné.");
  }
  if (clientIds.length > MAX_SELECTED_CLIENTS) {
    refuse(
      "BAD_REQUEST",
      `La sélection dépasse ${MAX_SELECTED_CLIENTS} clients : ce n’est pas une sélection manuelle. Le geste est refusé.`,
    );
  }

  const read = await readDemoScope({ runQuery: deps.runQuery, now: deps.now, tenantId });
  if (read.unavailable) {
    refuse(
      "PRECONDITION_FAILED",
      "L’inventaire des données n’a pas pu être lu : la base n’a pas répondu. Aucune donnée n’a été modifiée.",
    );
  }

  const candidates = new Map(read.clients.filter(client => client.blockedReason === null).map(client => [client.clientId, client]));
  const matched = new Map(read.clients.map(client => [client.clientId, client]));
  const existing = new Set(read.knownClientIds);

  const selection: DemoScopeClient[] = [];
  for (const id of clientIds) {
    const candidate = candidates.get(id);
    if (candidate) {
      selection.push(candidate);
      continue;
    }
    if (!existing.has(id)) {
      refuse("NOT_FOUND", `Le client ${id} n’existe pas sur cette instance. La liste a peut-être changé — actualisez-la.`);
    }
    const reconnu = matched.get(id);
    if (!reconnu) {
      refuse(
        "PRECONDITION_FAILED",
        `Le client ${id} ne porte aucun motif de donnée de recette : la console ne supprime rien « par ressemblance ».`,
      );
    }
    refuse("PRECONDITION_FAILED", `Le client ${id} (${reconnu.companyName}) ne peut pas être purgé : ${reconnu.blockedReason ?? "raison inconnue."}`);
  }

  const runQuery = deps.runQuery ?? (await defaultRunQuery());
  const scopeDocuments = await loadScopeDocuments(
    runQuery,
    tenantId,
    selection.map(client => client.clientId),
  );
  const totalRecords = selection.reduce((total, client) => total + client.totalRecords, 0);

  // CONTRÔLE DE COHÉRENCE : la somme des inventaires doit égaler la somme du
  // plan. Si les deux divergent, l’un des deux comptages est faux, et on ne
  // détruit rien sur une base dont on ne sait pas compter les lignes.
  const plan = planPurgeStatements({ clients: selection, documents: scopeDocuments });
  if (expectedTotalOf(plan) !== totalRecords) {
    refuse(
      "PRECONDITION_FAILED",
      "L’inventaire et le plan de suppression ne concordent pas : le geste est refusé plutôt que d’annoncer un nombre faux.",
    );
  }

  return { clients: selection, documents: scopeDocuments, totalRecords };
}

async function defaultRunQuery(): Promise<RawQueryRunner> {
  const db = await getDb();
  if (!db) {
    return async () => {
      throw new Error("Base de données indisponible.");
    };
  }
  return async query => Array.from((await db.execute(query)) as unknown as Record<string, unknown>[]);
}

/* ------------------------------------------------------------------ */
/* Exécution des suppressions                                          */
/* ------------------------------------------------------------------ */

export type PurgeExecution = Map<PurgeTable, number>;

export type PurgeDeps = {
  /** Remplace l’accès en lecture (inventaire). Les tests peuvent le faire échouer. */
  runQuery?: RawQueryRunner;
  /**
   * Remplace l’exécution du plan. Les tests l’injectent pour prouver le
   * périmètre SANS toucher à une base ; la production prend la transaction
   * `executeWithDatabase` juste en dessous.
   */
  execute?: (statements: readonly PurgeStatement[]) => Promise<PurgeExecution>;
  now?: () => Date;
  /** Secret d’instance, injectable pour prouver qu’un jeton d’une autre clé est refusé. */
  secret?: string;
};

/**
 * Exécute le plan dans UNE transaction, par instructions typées.
 *
 * Aucune requête SQL brute : les tables viennent du schéma Drizzle, donc une
 * faute de nom de colonne serait une erreur de compilation, pas une suppression
 * inattendue. Chaque instruction est filtrée par `tenantId` EN PLUS des
 * identifiants — ceinture et bretelles : un identifiant d’un autre espace ne
 * pourrait rien emporter.
 */
export async function executeWithDatabase(
  statements: readonly PurgeStatement[],
  tenantId: number,
): Promise<PurgeExecution> {
  const db = await getDb();
  if (!db) {
    refuse(
      "PRECONDITION_FAILED",
      "La base de données n’a pas répondu : aucune donnée n’a été supprimée.",
    );
  }

  const counts: PurgeExecution = new Map();
  await db.transaction(async tx => {
    for (const statement of statements) {
      counts.set(statement.table, await deleteRows(tx, statement, tenantId));
    }
  });
  return counts;
}

/** Type de la transaction Drizzle, dérivé de `getDb` — jamais recopié à la main. */
type PurgeDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type PurgeTx = Parameters<Parameters<PurgeDatabase["transaction"]>[0]>[0];

/**
 * Supprime UNE table du plan, en une instruction, et rend le nombre de lignes
 * réellement supprimées (`returning`). C’est ce nombre — pas une estimation —
 * qui est comparé à l’inventaire.
 *
 * Chaque branche est écrite en toutes lettres plutôt que déduite d’une boucle :
 * le nom de la table, la colonne filtrée et la contrainte de tenant sont ainsi
 * relus par un humain, ce qui est exactement ce qu’on attend d’un code qui
 * détruit des données.
 */
async function deleteRows(tx: PurgeTx, statement: PurgeStatement, tenantId: number): Promise<number> {
  const { values } = statement;
  switch (statement.table) {
    case "document_lines": {
      const rows = await tx
        .delete(documentLines)
        .where(and(eq(documentLines.tenantId, tenantId), inArray(documentLines.documentId, values)))
        .returning({ id: documentLines.id });
      return rows.length;
    }
    case "payments": {
      const rows = await tx
        .delete(payments)
        .where(and(eq(payments.tenantId, tenantId), inArray(payments.documentId, values)))
        .returning({ id: payments.id });
      return rows.length;
    }
    case "payment_promises": {
      const rows = await tx
        .delete(paymentPromises)
        .where(and(eq(paymentPromises.tenantId, tenantId), inArray(paymentPromises.documentId, values)))
        .returning({ id: paymentPromises.id });
      return rows.length;
    }
    case "document_share_links": {
      const rows = await tx
        .delete(documentShareLinks)
        .where(and(eq(documentShareLinks.tenantId, tenantId), inArray(documentShareLinks.documentId, values)))
        .returning({ id: documentShareLinks.id });
      return rows.length;
    }
    case "client_activities": {
      const rows = await tx
        .delete(clientActivities)
        .where(and(eq(clientActivities.tenantId, tenantId), inArray(clientActivities.clientId, values)))
        .returning({ id: clientActivities.id });
      return rows.length;
    }
    case "client_attachments": {
      const rows = await tx
        .delete(clientAttachments)
        .where(and(eq(clientAttachments.tenantId, tenantId), inArray(clientAttachments.clientId, values)))
        .returning({ id: clientAttachments.id });
      return rows.length;
    }
    case "documents": {
      const rows = await tx
        .delete(documents)
        .where(and(eq(documents.tenantId, tenantId), inArray(documents.clientId, values)))
        .returning({ id: documents.id });
      return rows.length;
    }
    case "clients": {
      const rows = await tx
        .delete(clients)
        .where(and(eq(clients.tenantId, tenantId), inArray(clients.id, values)))
        .returning({ id: clients.id });
      return rows.length;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Export préalable                                                    */
/* ------------------------------------------------------------------ */

/**
 * Colonnes VOLONTAIREMENT absentes de l’export, et pourquoi.
 *
 * Un export qui laisserait croire qu’il contient tout, alors qu’il omet une clé
 * d’accès, serait plus dangereux qu’un export qui le dit : le lecteur saurait
 * qu’il lui manque quelque chose.
 */
export const EXPORT_OMITTED_COLUMNS: ReadonlyArray<{ table: string; columns: readonly string[]; reason: string }> = [
  {
    table: "document_share_links",
    columns: ["tokenHash"],
    reason: "Empreinte du jeton de partage : c’est une clé d’accès, elle n’est jamais exportée.",
  },
  {
    table: "client_attachments",
    columns: ["storageKey", "storageUrl"],
    reason:
      "Référence de stockage, potentiellement signée. Le fichier vit chez l’hébergeur : la base n’en garde que la fiche.",
  },
];

export type DataExportInput = {
  actor: ConsoleActor;
  tenantId: number | null;
  clientIds: readonly number[];
  now?: () => Date;
};

export type DataExportResult = {
  generatedAt: string;
  filename: string;
  contentType: string;
  /** Contenu JSON complet, prêt à être écrit dans un fichier par l’écran. */
  content: string;
  /** Nombre d’enregistrements couverts — c’est celui que la purge exigera. */
  totalRecords: number;
  clientIds: number[];
  counts: ReadonlyArray<{ label: string; count: number }>;
  token: string;
  tokenExpiresAt: string;
};

/** Date locale (AAAA-MM-JJ) pour un nom de fichier lisible. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type DataExportDeps = { runQuery?: RawQueryRunner; secret?: string };

/**
 * Produit l’export JSON du périmètre sélectionné et le jeton signé qui
 * l’atteste. LECTURE SEULE côté base : ce chemin ne supprime rien, il ne peut
 * donc pas être confondu avec la purge.
 */
export async function exportDemoData(
  input: DataExportInput,
  deps: DataExportDeps = {},
): Promise<DataExportResult> {
  const now = input.now ?? (() => new Date());
  const clientIds = normalizeSelectedIds(input.clientIds);
  // Une seule résolution du lecteur : l’inventaire et l’export lisent par le
  // même chemin, donc sur le même état de la base.
  const runQuery = deps.runQuery ?? (await defaultRunQuery());
  const scope = await resolveSelection({ runQuery, now: input.now }, input.tenantId, clientIds);
  const tenantId = input.tenantId as number;

  const clientIdList = sql.join(
    scope.clients.map(client => sql`${client.clientId}`),
    sql`, `,
  );

  const clientRows = await runQuery(sql`
    select "id", "companyName", "contactName", "email", "phone", "address", "taxId",
           "identityKind"::text as identity_kind, "registrationNumber", "notes",
           "defaultDiscountPercent", "createdAt", "updatedAt"
      from clients
     where "tenantId" = ${tenantId} and "id" in (${clientIdList})
     order by "id" asc
  `);

  const documentRows = await runQuery(sql`
    select "id", "kind"::text as kind, "number", "clientId", "projectId", "relatedDocumentId",
           "invoiceStage"::text as invoice_stage, "status"::text as status, "issueDate", "dueDate", "validUntil",
           "depositPercent", "depositDueDate", "balanceDueDate", "discountPercent", "discountAmount",
           "currency", "subtotal", "taxTotal", "total", "notes", "isAiDraft"::text as is_ai_draft,
           "collectionStatus"::text as collection_status, "collectionReminderDate", "createdAt", "updatedAt"
      from documents
     where "tenantId" = ${tenantId} and "clientId" in (${clientIdList})
     order by "id" asc
  `);

  const lineRows = await runQuery(sql`
    select l."id", l."documentId", l."position", l."description", l."quantity", l."unit",
           l."unitPrice", l."taxRate", l."lineTotal", l."serviceId"
      from document_lines l
      join documents d on d."id" = l."documentId"
     where d."tenantId" = ${tenantId} and d."clientId" in (${clientIdList})
     order by l."id" asc
  `);

  const paymentRows = await runQuery(sql`
    select p."id", p."documentId", p."amount", p."paidAt", p."method"::text as method,
           p."reference", p."notes", p."createdAt"
      from payments p
      join documents d on d."id" = p."documentId"
     where d."tenantId" = ${tenantId} and d."clientId" in (${clientIdList})
     order by p."id" asc
  `);

  const promiseRows = await runQuery(sql`
    select pp."id", pp."documentId", pp."promisedDate", pp."note", pp."createdAt", pp."updatedAt"
      from payment_promises pp
      join documents d on d."id" = pp."documentId"
     where d."tenantId" = ${tenantId} and d."clientId" in (${clientIdList})
     order by pp."id" asc
  `);

  const shareRows = await runQuery(sql`
    select s."id", s."documentId", s."recipientEmail", s."expiresAt", s."revokedAt",
           s."lastAccessAt", s."accessCount", s."createdAt"
      from document_share_links s
      join documents d on d."id" = s."documentId"
     where d."tenantId" = ${tenantId} and d."clientId" in (${clientIdList})
     order by s."id" asc
  `);

  const activityRows = await runQuery(sql`
    select a."id", a."clientId", a."documentId", a."type"::text as type, a."title",
           a."description", a."createdAt"
      from client_activities a
     where a."tenantId" = ${tenantId} and a."clientId" in (${clientIdList})
     order by a."id" asc
  `);

  const attachmentRows = await runQuery(sql`
    select ca."id", ca."clientId", ca."fileName", ca."contentType", ca."size", ca."createdAt"
      from client_attachments ca
     where ca."tenantId" = ${tenantId} and ca."clientId" in (${clientIdList})
     order by ca."id" asc
  `);

  const generatedAt = now();
  const payload = {
    version: 1 as const,
    generatedAt: generatedAt.toISOString(),
    scope: { tenantId, clientIds: scope.clients.map(client => client.clientId) },
    totals: { records: scope.totalRecords },
    selection: scope.clients.map(client => ({
      clientId: client.clientId,
      companyName: client.companyName,
      motifs: client.motifs,
      counts: client.counts,
      totalRecords: client.totalRecords,
    })),
    // Ce que le fichier ne contient pas, dit AVANT ce qu’il contient.
    omitted: EXPORT_OMITTED_COLUMNS,
    tables: {
      clients: clientRows,
      documents: documentRows,
      document_lines: lineRows,
      payments: paymentRows,
      payment_promises: promiseRows,
      document_share_links: shareRows,
      client_activities: activityRows,
      client_attachments: attachmentRows,
    },
  };

  const tokenScope: ExportTokenScope = {
    tenantId,
    actorId: input.actor.id,
    clientIds: scope.clients.map(client => client.clientId),
    totalRecords: scope.totalRecords,
  };
  const issued = issueExportToken(tokenScope, { now: input.now, secret: deps.secret });

  const counts = DEMO_COUNT_LABELS.map(entry => ({
    label: entry.label,
    count: scope.clients.reduce((total, client) => total + client.counts[entry.key], 0),
  }));
  counts.push({ label: "Clients", count: scope.clients.length });

  return {
    generatedAt: payload.generatedAt,
    filename: `lucepress-donnees-demonstration-${isoDay(generatedAt)}.json`,
    contentType: "application/json; charset=utf-8",
    content: JSON.stringify(payload, null, 2),
    totalRecords: scope.totalRecords,
    clientIds: tokenScope.clientIds,
    counts,
    token: issued.token,
    tokenExpiresAt: issued.expiresAt,
  };
}

/* ------------------------------------------------------------------ */
/* Purge                                                               */
/* ------------------------------------------------------------------ */

export type PurgeDataInput = {
  actor: ConsoleActor;
  tenantId: number | null;
  clientIds: readonly number[];
  /** Phrase recopiée à la main : `SUPPRIMER <n> ENREGISTREMENTS`. */
  confirmation: string;
  /** Jeton rendu par l’export préalable du MÊME périmètre. */
  exportToken: string;
  now?: () => Date;
};

export type PurgeDataResult = {
  clientIds: number[];
  totalRecords: number;
  deleted: ReadonlyArray<{ table: PurgeTable; label: string; count: number }>;
  purgedAt: string;
};

/**
 * PURGE SÉLECTIVE — le seul geste destructif de la console.
 *
 * L’ordre des contrôles est celui de la gravité : on vérifie d’abord QUE l’on a
 * le droit (périmètre revalidé), ensuite QUE l’on a bien confirmé (phrase et
 * nombre), enfin QUE l’on a un filet (jeton d’export). Aucun de ces contrôles
 * n’écrit : tout ce qui précède la transaction ne peut rien détruire.
 */
export async function purgeDemoData(input: PurgeDataInput, deps: PurgeDeps = {}): Promise<PurgeDataResult> {
  const now = input.now ?? (() => new Date());
  const clientIds = normalizeSelectedIds(input.clientIds);

  // 1. PÉRIMÈTRE — chaque identifiant revalidé contre l’inventaire courant.
  const scope = await resolveSelection(deps, input.tenantId, clientIds);
  const tenantId = input.tenantId as number;

  // 2. CONFIRMATION — le nombre vient du serveur, jamais de la requête.
  if (!confirmationMatches(input.confirmation, scope.totalRecords)) {
    refuse(
      "BAD_REQUEST",
      `La phrase de confirmation ne correspond pas à la sélection : ${scope.totalRecords} enregistrement(s) sont concernés. Recopiez la phrase exacte affichée par l’écran.`,
    );
  }

  // 3. FILET — l’export préalable, sur EXACTEMENT ce périmètre.
  const check = verifyExportToken(
    input.exportToken,
    {
      tenantId,
      actorId: input.actor.id,
      clientIds: scope.clients.map(client => client.clientId),
      totalRecords: scope.totalRecords,
    },
    { now: input.now, secret: deps.secret },
  );
  if (!check.ok) {
    const messages: Record<ExportTokenReason, string> = {
      malformed: "Le jeton d’export est illisible. Exportez à nouveau le périmètre, puis relancez la suppression.",
      signature: "Le jeton d’export n’est pas valide : il n’a pas été produit par cette instance.",
      expired:
        "L’export préalable a expiré (dix minutes). Exportez à nouveau le périmètre avant de supprimer : on ne détruit pas sans filet.",
      scope:
        "Le jeton d’export ne couvre pas cette sélection : l’export doit porter sur EXACTEMENT les mêmes clients. Exportez ce périmètre-ci.",
      unavailable:
        "Le secret d’instance est indisponible : impossible de vérifier qu’un export a eu lieu. La suppression reste fermée.",
    };
    refuse("PRECONDITION_FAILED", messages[check.reason]);
  }

  // 4. PLAN ET EXÉCUTION — le plan est bâti sur le périmètre revalidé, jamais
  //    sur la liste reçue : seuls des identifiants recontrôlés y figurent.
  const statements = planPurgeStatements({ clients: scope.clients, documents: scope.documents });
  const execute = deps.execute ?? (statementsToRun => executeWithDatabase(statementsToRun, tenantId));

  // 5. EXÉCUTION PUIS VÉRIFICATION, DANS LE MÊME BLOC GARDÉ. Un écart entre ce
  //    qui a été annoncé et ce qui a été supprimé lève ICI, donc à l’intérieur de
  //    la transaction ouverte par `executeWithDatabase` : la transaction est
  //    annulée, et rien de ce qui a été supprimé ne l’est resté.
  let actual: PurgeExecution;
  try {
    actual = await execute(statements);
    const mismatch = statements.filter(statement => (actual.get(statement.table) ?? 0) !== statement.expected);
    if (mismatch.length > 0) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Le nombre de lignes supprimées ne correspond pas à l’inventaire affiché : la transaction a été annulée, aucune donnée n’a été supprimée.",
      });
    }
  } catch (error) {
    // Le refus est journalisé, et il ne prétend PAS que des lignes ont disparu :
    // `supprimes:0`, parce que la transaction est annulée.
    logConsoleAction({
      action: "donnees.purge",
      outcome: classifyConsoleOutcome(error),
      target: `donnees#clients=${scope.clients.length}`,
      role: input.actor.role,
      actor: input.actor.email,
      actorId: input.actor.id,
      tenantId: input.actor.tenantId,
      counts: { enregistrements: scope.totalRecords, supprimes: 0 },
    });
    throw error;
  }

  const deleted = PURGE_TABLE_LABELS.filter(entry => statements.some(statement => statement.table === entry.table)).map(
    entry => ({
      table: entry.table,
      label: entry.label,
      count: actual.get(entry.table) ?? 0,
    }),
  );

  const purgedAt = now().toISOString();
  // 6. JOURNALISATION — acteur, périmètre et comptes, une ligne par suppression
  //    effectivement enregistrée (voir `systemAccessLog.ts`).
  logConsoleAction({
    action: "donnees.purge",
    outcome: "ok",
    target: `donnees#clients=${scope.clients.map(client => client.clientId).join(",")}`,
    role: input.actor.role,
    actor: input.actor.email,
    actorId: input.actor.id,
    tenantId: input.actor.tenantId,
    counts: Object.fromEntries([["enregistrements", scope.totalRecords], ...deleted.map(entry => [entry.table, entry.count])]),
  });

  return {
    clientIds: scope.clients.map(client => client.clientId),
    totalRecords: scope.totalRecords,
    deleted,
    purgedAt,
  };
}
