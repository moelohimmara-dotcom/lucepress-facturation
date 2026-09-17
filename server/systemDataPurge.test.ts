import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { RawQueryRunner } from "./systemData";
import {
  PURGE_TABLE_LABELS,
  confirmationMatches,
  executeWithDatabase,
  expectedConfirmation,
  expectedTotalOf,
  exportDemoData,
  normalizeSelectedIds,
  planPurgeStatements,
  purgeDemoData,
  type PurgeStatement,
} from "./systemDataPurge";
import { EXPORT_TOKEN_TTL_MS, issueExportToken, verifyExportToken } from "./systemDataExportToken";
import type { DemoScopeClient } from "./systemData";

/**
 * EXPORT PRÉALABLE ET PURGE SÉLECTIVE — CE QUI PASSE, CE QUI EST REFUSÉ, ET CE
 * QUI EST ÉCRIT.
 *
 * Ce fichier prouve les quatre verrous, DANS LES DEUX SENS :
 *  1. QUI A LE DROIT — 403 pour `admin`, `directeur`, `cadre`, `client` et
 *     anonyme sur les QUATRE procédures ; aucun n’atteint le corps.
 *  2. PAS DE SUPPRESSION SANS EXPORT — sans jeton, avec un jeton d’un autre
 *     périmètre, ou avec un jeton expiré, l’exécution n’est JAMAIS appelée.
 *  3. LA PHRASE ET LE NOMBRE — la phrase exacte est exigée, porte le nombre
 *     recalculé par le serveur, et un écart refuse le geste.
 *  4. LE PÉRIMÈTRE ÉCRIT — le plan ne contient QUE les identifiants
 *     sélectionnés, et les comptes annoncés par l’inventaire sont ceux qui sont
 *     supprimés. Un écart annule tout.
 *
 * Aucune base n’est sollicitée : les lectures sont injectées, l’exécution est
 * doublée. `vi.hoisted` fixe un secret d’instance AVANT tout import, sinon le
 * jeton d’export ne pourrait pas être signé et les tests porteraient sur un
 * refus de configuration, pas sur la règle.
 */

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    /** Secret d’une AUTRE instance : il ne doit valider aucun jeton émis ici. */
    autreSecret: "un-tout-autre-secret-de-32-caracteres-minimum",
  };
});

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");
const dialect = new PgDialect();
const sqlText = (query: SQL) => dialect.sqlToQuery(query).sql;

function contextFor(role: string): TrpcContext {
  return {
    user: {
      id: 42,
      openId: `staff-${role}`,
      name: `Compte ${role}`,
      email: `${role}@example.com`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    tenantId: 1,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

function anonymousContext(): TrpcContext {
  return { user: null, tenantId: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
}

type Rows = Array<Record<string, unknown>>;
type Step = Rows | "throw";

function queuedRunQuery(steps: Step[]) {
  const seen: string[] = [];
  let index = 0;
  const run: RawQueryRunner = async query => {
    seen.push(sqlText(query));
    const step = steps[index] ?? [];
    index += 1;
    if (step === "throw") throw new Error("échec simulé");
    return step;
  };
  return { run, seen, get appels() { return index; } };
}

function contentRunQuery(handlers: Array<{ match: RegExp; rows: Rows }>) {
  const seen: string[] = [];
  const run: RawQueryRunner = async query => {
    const text = sqlText(query);
    seen.push(text);
    const handler = handlers.find(entry => entry.match.test(text));
    if (!handler) throw new Error(`Requête non prévue par le double : ${text}`);
    return handler.rows;
  };
  return { run, seen };
}

/* ------------------------------------------------------------------ */
/* Jeu de données partagé                                              */
/* ------------------------------------------------------------------ */

const TENANT = 1;
const ACTOR_ID = 42;

/** 1 : candidat complet (14 enregistrements). 2 : candidat sans document (1). */
const CLIENT_ROWS: Rows = [
  { id: 1, companyName: "Test SARL", contactName: "Service test", email: "facturation@example.com" },
  { id: 2, companyName: "Client démo", contactName: null, email: "contact@lucepress.test" },
  { id: 3, companyName: "Maçonnerie Konaté", contactName: null, email: "contact@btp-guinee.com" },
];

const DOCUMENT_ROWS: Rows = [
  { id: 100, clientId: 1 },
  { id: 101, clientId: 1 },
];

/** Comptages mesurés (les `bigint` arrivent en chaîne) pour les clients 1 et 2. */
const MESURE_ROWS: Rows = [
  {
    client_id: 1,
    documents: "2",
    document_lines: "5",
    payments: "1",
    payment_promises: "1",
    share_links: "1",
    activities: "3",
    attachments: "0",
    projects: "0",
    agent_jobs: "0",
  },
  {
    client_id: 2,
    documents: "0",
    document_lines: "0",
    payments: "0",
    payment_promises: "0",
    share_links: "0",
    activities: "0",
    attachments: "0",
    projects: "0",
    agent_jobs: "0",
  },
];

/** Les cinq lectures du périmètre : clients, documents, comptages, blocages, puis la relecture. */
const SCOPE_STEPS: Step[] = [CLIENT_ROWS, DOCUMENT_ROWS, MESURE_ROWS, [], DOCUMENT_ROWS];

const TOTAL_CLIENT_1 = 14;
const TOTAL_CLIENT_2 = 1;

function purgeDeps(execute: (statements: readonly PurgeStatement[]) => Promise<Map<string, number>>, steps: Step[] = SCOPE_STEPS) {
  const { run } = queuedRunQuery(steps);
  return {
    runQuery: run,
    execute: execute as never,
    secret: undefined,
  };
}

/** Exécution conforme : chaque table rend exactement ce que l’inventaire annonce. */
function honestExecute() {
  const captured: Array<readonly PurgeStatement[]> = [];
  const execute = async (statements: readonly PurgeStatement[]) => {
    captured.push(statements);
    return new Map(statements.map(statement => [statement.table, statement.expected]));
  };
  return { execute, captured };
}

/* ------------------------------------------------------------------ */
/* 1. Qui a le droit                                                   */
/* ------------------------------------------------------------------ */

describe("system.data.* — contrôle serveur de la console", () => {
  const ROLES_REFUSES = ["admin", "directeur", "cadre", "client"];

  const appels: Array<{ nom: string; appel: (ctx: TrpcContext) => Promise<unknown> }> = [
    { nom: "overview", appel: ctx => appRouter.createCaller(ctx).system.data.overview() },
    { nom: "demoCandidates", appel: ctx => appRouter.createCaller(ctx).system.data.demoCandidates() },
    {
      nom: "export",
      appel: ctx => appRouter.createCaller(ctx).system.data.export({ clientIds: [1] }),
    },
    {
      nom: "purge",
      appel: ctx =>
        appRouter.createCaller(ctx).system.data.purge({ clientIds: [1], confirmation: "SUPPRIMER 14 ENREGISTREMENTS", exportToken: "v1.x.y" }),
    },
  ];

  it("refuse TOUS les autres rôles en 403, sur les quatre procédures", async () => {
    for (const { nom, appel } of appels) {
      for (const role of ROLES_REFUSES) {
        await expect(appel(contextFor(role)), `${nom} doit refuser « ${role} »`).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
  });

  it("refuse un visiteur non authentifié, sur les quatre procédures", async () => {
    for (const { nom, appel } of appels) {
      await expect(appel(anonymousContext()), `${nom} doit refuser un visiteur`).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("réserve les quatre procédures à `systemProcedure`, et à elle seule", () => {
    const source = readSource("server/_core/systemRouter.ts");
    const bloc = source.slice(source.indexOf("  data: router({"), source.indexOf("  llmModels:"));
    const procedures = [...bloc.matchAll(/(overview|demoCandidates|export|purge): (systemProcedure|protectedProcedure|adminProcedure)/g)];
    expect(procedures.map(entry => entry[1]).sort()).toEqual(["demoCandidates", "export", "overview", "purge"]);
    for (const procedure of procedures) {
      expect(procedure[2], `${procedure[1]} doit être sous systemProcedure`).toBe("systemProcedure");
    }
  });

  it("sert un inventaire VIDE et DÉCLARÉ au rôle système quand la base manque", async () => {
    // Sans base, l’inventaire ne peut pas être lu : il doit le DIRE, et surtout
    // ne proposer aucun candidat. `null`, jamais 0.
    const payload = await appRouter.createCaller(contextFor("systeme")).system.data.demoCandidates();
    expect(payload.candidates).toEqual([]);
    expect(payload.excluded).toEqual([]);
    expect(payload.totalRecords).toBeNull();
    expect(payload.unavailable).toEqual(["candidates"]);
    expect(payload.rules.length).toBeGreaterThan(0);

    const volumes = await appRouter.createCaller(contextFor("systeme")).system.data.overview();
    expect(volumes.scope).toBe("instance");
    expect(volumes.unavailable.length).toBeGreaterThan(0);
    for (const volume of volumes.volumes) expect(volume.count).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 2. La phrase et le nombre                                           */
/* ------------------------------------------------------------------ */

describe("Phrase de confirmation — le nombre est celui du serveur", () => {
  it("attend la phrase exacte, en majuscules et avec le bon nombre", () => {
    expect(expectedConfirmation(14)).toBe("SUPPRIMER 14 ENREGISTREMENTS");
    expect(confirmationMatches("SUPPRIMER 14 ENREGISTREMENTS", 14)).toBe(true);
    // Les espaces sont assouplis (copier-coller, espaces insécables)…
    expect(confirmationMatches("  SUPPRIMER\u00a014   ENREGISTREMENTS ", 14)).toBe(true);
    // …la casse et le NOMBRE, non.
    expect(confirmationMatches("supprimer 14 enregistrements", 14)).toBe(false);
    expect(confirmationMatches("SUPPRIMER 15 ENREGISTREMENTS", 14)).toBe(false);
    expect(confirmationMatches("SUPPRIMER 14 ENREGISTREMENT", 14)).toBe(false);
    expect(confirmationMatches("SUPPRIMER ENREGISTREMENTS", 14)).toBe(false);
    expect(confirmationMatches("SUPPRIMER 14, ENREGISTREMENTS", 14)).toBe(false);
    expect(confirmationMatches("", 14)).toBe(false);
    expect(confirmationMatches(undefined, 14)).toBe(false);
    expect(confirmationMatches(14, 14)).toBe(false);
  });

  it("ne confond jamais deux totaux voisins", () => {
    for (const total of [1, 9, 10, 14, 99, 100, 1000]) {
      expect(confirmationMatches(expectedConfirmation(total), total)).toBe(true);
      expect(confirmationMatches(expectedConfirmation(total), total + 1)).toBe(false);
      expect(confirmationMatches(expectedConfirmation(total + 1), total)).toBe(false);
    }
  });

  it("la phrase affichée par l’écran est EXACTEMENT celle que le serveur exige", () => {
    // Le serveur est la référence. On relit les deux SOURCES plutôt que
    // d’exécuter le module client : la preuve est la même, sans dépendance.
    const serveur = readSource("server/systemDataPurge.ts");
    const ecran = readSource("client/src/components/SystemData.tsx");
    const gabarit = "SUPPRIMER ${totalRecords} ENREGISTREMENTS";
    expect(serveur).toContain(gabarit);
    expect(ecran).toContain(gabarit);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Le jeton d’export                                                */
/* ------------------------------------------------------------------ */

describe("Jeton d’export préalable — signé, court, lié au périmètre", () => {
  const now = () => new Date("2026-09-17T09:00:00.000Z");
  const scope = { tenantId: TENANT, actorId: ACTOR_ID, clientIds: [1, 2], totalRecords: 15 };

  it("valide un jeton émis pour le MÊME périmètre", () => {
    const { token, expiresAt } = issueExportToken(scope, { now });
    expect(expiresAt).toBe(new Date(now().getTime() + EXPORT_TOKEN_TTL_MS).toISOString());
    expect(verifyExportToken(token, scope, { now }).ok).toBe(true);
  });

  it("compare les identifiants comme un ENSEMBLE, pas comme une liste", () => {
    const { token } = issueExportToken(scope, { now });
    expect(verifyExportToken(token, { ...scope, clientIds: [2, 1] }, { now }).ok).toBe(true);
  });

  it("refuse un jeton émis par une AUTRE clé", () => {
    const { token } = issueExportToken(scope, { now, secret: mocks.autreSecret });
    expect(verifyExportToken(token, scope, { now })).toEqual({ ok: false, reason: "signature" });
  });

  it("refuse un jeton expiré", () => {
    const { token } = issueExportToken(scope, { now });
    const plusTard = () => new Date(now().getTime() + EXPORT_TOKEN_TTL_MS + 1);
    expect(verifyExportToken(token, scope, { now: plusTard })).toEqual({ ok: false, reason: "expired" });
  });

  it("tient dix minutes, pas plus", () => {
    expect(EXPORT_TOKEN_TTL_MS).toBe(10 * 60 * 1000);
  });

  it("refuse un périmètre différent : autres clients, autre total, autre acteur, autre tenant", () => {
    const { token } = issueExportToken(scope, { now });
    expect(verifyExportToken(token, { ...scope, clientIds: [1] }, { now })).toEqual({ ok: false, reason: "scope" });
    expect(verifyExportToken(token, { ...scope, clientIds: [1, 2, 3] }, { now })).toEqual({ ok: false, reason: "scope" });
    expect(verifyExportToken(token, { ...scope, totalRecords: 14 }, { now })).toEqual({ ok: false, reason: "scope" });
    expect(verifyExportToken(token, { ...scope, actorId: 43 }, { now })).toEqual({ ok: false, reason: "scope" });
    expect(verifyExportToken(token, { ...scope, tenantId: 2 }, { now })).toEqual({ ok: false, reason: "scope" });
  });

  it("refuse un jeton illisible ou trafiqué", () => {
    const { token } = issueExportToken(scope, { now });
    const [version, payload] = token.split(".");

    for (const mauvais of ["", "n’importe quoi", "v1", "v1.x", "v1.x.y.z", "v2.x.y", `${version}.${payload}.`]) {
      expect(verifyExportToken(mauvais, scope, { now }).ok).toBe(false);
    }
    // Charge utile modifiée : la signature ne suit pas.
    const falsifie = Buffer.from(JSON.stringify({ ...scope, v: "v1", exp: now().getTime() + 1_000_000, totalRecords: 1 }), "utf8").toString("base64url");
    expect(verifyExportToken(`v1.${falsifie}.${token.split(".")[2]}`, scope, { now })).toEqual({ ok: false, reason: "signature" });
    // Non-chaîne : refus, jamais exception.
    expect(verifyExportToken(null, scope, { now })).toEqual({ ok: false, reason: "malformed" });
    expect(verifyExportToken(42, scope, { now })).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuse de signer — donc d’autoriser — sans secret d’instance", () => {
    expect(() => issueExportToken(scope, { now, secret: "" })).toThrow();
    const { token } = issueExportToken(scope, { now });
    expect(verifyExportToken(token, scope, { now, secret: "" })).toEqual({ ok: false, reason: "unavailable" });
  });
});

/* ------------------------------------------------------------------ */
/* 4. Le plan de suppression                                           */
/* ------------------------------------------------------------------ */

function scopeClient(overrides: Partial<DemoScopeClient> & { clientId: number }): DemoScopeClient {
  return {
    companyName: `Client ${overrides.clientId}`,
    contactName: null,
    email: null,
    motifs: [],
    counts: { documents: 0, documentLines: 0, payments: 0, paymentPromises: 0, shareLinks: 0, activities: 0, attachments: 0 },
    totalRecords: 1,
    blockedReason: null,
    ...overrides,
  };
}

describe("Plan de suppression — l’ordre, la colonne, et les seuls identifiants retenus", () => {
  const client = scopeClient({
    clientId: 7,
    counts: { documents: 2, documentLines: 5, payments: 1, paymentPromises: 1, shareLinks: 1, activities: 3, attachments: 0 },
    totalRecords: TOTAL_CLIENT_1,
  });
  const documents = [
    { id: 100, clientId: 7 },
    { id: 101, clientId: 7 },
  ];

  it("supprime les enfants AVANT les parents, dans un ordre sûr", () => {
    const plan = planPurgeStatements({ clients: [client], documents });
    const ordre = plan.map(statement => statement.table);
    // La base refuse de supprimer un client tant que ses documents existent
    // (`on delete restrict`) : l’ordre n’est pas cosmétique.
    expect(ordre.indexOf("documents")).toBeGreaterThan(ordre.indexOf("document_lines"));
    expect(ordre.indexOf("documents")).toBeGreaterThan(ordre.indexOf("payments"));
    expect(ordre.indexOf("documents")).toBeGreaterThan(ordre.indexOf("payment_promises"));
    expect(ordre.indexOf("documents")).toBeGreaterThan(ordre.indexOf("document_share_links"));
    expect(ordre.indexOf("clients")).toBe(ordre.length - 1);
    expect(ordre).toEqual([
      "document_lines",
      "payments",
      "payment_promises",
      "document_share_links",
      "client_activities",
      "documents",
      "clients",
    ]);
    // `client_attachments` est absent de ce plan parce que l’inventaire annonce
    // zéro pièce jointe : une table à zéro ligne n’est pas visitée.
  });

  it("ne retient QUE les identifiants du périmètre, et la bonne colonne", () => {
    const plan = planPurgeStatements({ clients: [client], documents });

    for (const statement of plan) {
      const attendu = statement.column === "documentId" ? [100, 101] : [7];
      expect(statement.values, `${statement.table}`).toEqual(attendu);
      // Aucun identifiant hors périmètre ne peut s’y glisser.
      for (const value of statement.values) expect([7, 100, 101]).toContain(value);
    }
    expect(plan.find(statement => statement.table === "clients")?.column).toBe("id");
    expect(plan.find(statement => statement.table === "documents")?.column).toBe("clientId");
    expect(plan.find(statement => statement.table === "document_lines")?.column).toBe("documentId");
  });

  it("n’émet aucune instruction pour une table vide", () => {
    const sansDocument = scopeClient({ clientId: 8 });
    const plan = planPurgeStatements({ clients: [sansDocument], documents: [] });
    // Seul le client lui-même reste : les tables filles n’ont rien à supprimer.
    expect(plan.map(statement => statement.table)).toEqual(["clients"]);
    expect(plan[0]).toEqual({ table: "clients", column: "id", values: [8], expected: 1 });
  });

  it("annonce exactement ce que l’inventaire annonce", () => {
    const plan = planPurgeStatements({ clients: [client], documents });
    // 1 (client) + 2 + 5 + 1 + 1 + 1 + 3 + 0
    expect(expectedTotalOf(plan)).toBe(TOTAL_CLIENT_1);
    expect(expectedTotalOf(plan)).toBe(client.totalRecords);

    const parTable = Object.fromEntries(plan.map(statement => [statement.table, statement.expected]));
    expect(parTable).toEqual({
      document_lines: 5,
      payments: 1,
      payment_promises: 1,
      document_share_links: 1,
      client_activities: 3,
      documents: 2,
      clients: 1,
    });
  });

  it("ne purge QUE huit tables, et jamais un compte, un réglage ou une intégration", () => {
    expect(PURGE_TABLE_LABELS.map(entry => entry.table)).toEqual([
      "document_lines",
      "payments",
      "payment_promises",
      "document_share_links",
      "client_activities",
      "client_attachments",
      "documents",
      "clients",
    ]);

    // PREUVE STATIQUE : le module n’IMPORTE du schéma que ces huit tables. Un
    // compte, un réglage ou une intégration ne peuvent donc pas être supprimés,
    // même par accident — le module n’a pas leur nom sous la main.
    const source = readSource("server/systemDataPurge.ts");
    const importBlock = source.match(/import\s*\{([^}]*)\}\s*from "\.\.\/drizzle\/schema"/);
    expect(importBlock, "le module doit importer ses tables du schéma Drizzle").not.toBeNull();
    const imported = (importBlock?.[1] ?? "")
      .split(",")
      .map(name => name.trim())
      .filter(name => name.length > 0);
    // Les identifiants importés sont exactement les huit tables du plan.
    expect(new Set(imported)).toEqual(
      new Set([
        "clientActivities",
        "clientAttachments",
        "clients",
        "documentLines",
        "documentShareLinks",
        "documents",
        "paymentPromises",
        "payments",
      ]),
    );
    for (const interdit of ["users", "companySettings", "integrationConnections", "tenants", "invitations"]) {
      expect(imported, `« ${interdit} » ne doit pas être importé`).not.toContain(interdit);
    }
  });

  it("n’écrit jamais ailleurs que dans les huit tables du plan, et filtre par tenant", () => {
    const source = readSource("server/systemDataPurge.ts");
    const suppressions = [...source.matchAll(/tx\s*\n?\s*\.delete\((\w+)\)/g)].map(match => match[1]);
    expect(suppressions.length).toBe(8);
    expect(new Set(suppressions).size).toBe(8);
    // Chaque suppression porte la contrainte de tenant : ceinture et bretelles.
    expect([...source.matchAll(/\.delete\((\w+)\)([\s\S]{0,200}?)returning/g)].length).toBe(8);
    for (const bloc of source.matchAll(/\.delete\(\w+\)([\s\S]*?)returning/g)) {
      expect(bloc[1]).toContain("tenantId");
    }
  });
});

/* ------------------------------------------------------------------ */
/* 5. Export                                                           */
/* ------------------------------------------------------------------ */

const EXPORT_HANDLERS = [
  { match: /as client_id/, rows: MESURE_ROWS },
  { match: /\bunion\b/, rows: [] },
  { match: /from document_lines l/, rows: [{ id: 1, documentId: 100, position: 1, description: "Ligne", quantity: "1.00" }] },
  { match: /from payments p/, rows: [{ id: 1, documentId: 100, amount: 1000, method: "especes" }] },
  { match: /from payment_promises pp/, rows: [{ id: 1, documentId: 100, promisedDate: new Date("2026-10-01") }] },
  { match: /from document_share_links s/, rows: [{ id: 1, documentId: 100, recipientEmail: "x@example.com" }] },
  { match: /from client_activities a/, rows: [{ id: 1, clientId: 1, title: "Relance" }] },
  { match: /from client_attachments ca/, rows: [{ id: 1, clientId: 1, fileName: "plan.pdf", contentType: "application/pdf", size: 12 }] },
  { match: /"defaultDiscountPercent"/, rows: [{ id: 1, companyName: "Test SARL", email: "facturation@example.com" }] },
  { match: /"invoiceStage"/, rows: [{ id: 100, clientId: 1, number: "DEV-100", total: 5000 }] },
  {
    match: /select "id", "companyName", "contactName", "email"\s+from clients/,
    rows: CLIENT_ROWS,
  },
  { match: /from documents\s+where "tenantId" = \$1 and "clientId" in/, rows: DOCUMENT_ROWS },
];

const actor = { id: ACTOR_ID, name: "Système", email: "systeme@example.com", role: "systeme", tenantId: TENANT };

describe("system.data.export — le filet, produit avant la chute", () => {
  it("rend un contenu JSON téléchargeable ET le jeton du périmètre", async () => {
    const { run } = contentRunQuery(EXPORT_HANDLERS);
    const result = await exportDemoData({ actor, tenantId: TENANT, clientIds: [1] }, { runQuery: run });

    expect(result.contentType).toBe("application/json; charset=utf-8");
    expect(result.filename).toMatch(/^lucepress-donnees-demonstration-\d{4}-\d{2}-\d{2}\.json$/);
    expect(result.clientIds).toEqual([1]);
    expect(result.totalRecords).toBe(TOTAL_CLIENT_1);

    // Le contenu EST le fichier : il se relit tel quel.
    const payload = JSON.parse(result.content);
    expect(payload.tables.clients).toHaveLength(1);
    expect(payload.tables.clients[0].companyName).toBe("Test SARL");
    expect(payload.tables.documents).toHaveLength(1);
    expect(payload.tables.documents[0].number).toBe("DEV-100");
    expect(payload.tables.document_lines).toHaveLength(1);
    expect(payload.tables.payments).toHaveLength(1);
    expect(payload.tables.payment_promises).toHaveLength(1);
    expect(payload.totals.records).toBe(TOTAL_CLIENT_1);
    // Le motif de chaque client exporté est dans le fichier : la sélection reste justifiable après coup.
    expect(payload.selection[0].motifs.length).toBeGreaterThan(0);
    expect(JSON.stringify(payload.selection[0].motifs)).toContain("mot_de_test");

    // Le jeton vaut pour CE périmètre, et pour lui seul.
    expect(
      verifyExportToken(
        result.token,
        { tenantId: TENANT, actorId: ACTOR_ID, clientIds: [1], totalRecords: TOTAL_CLIENT_1 },
        {},
      ).ok,
    ).toBe(true);
  });

  it("déclare ce qu’il n’emporte PAS, et n’y met aucune clé d’accès", async () => {
    const { run } = contentRunQuery(EXPORT_HANDLERS);
    const result = await exportDemoData({ actor, tenantId: TENANT, clientIds: [1] }, { runQuery: run });

    const payload = JSON.parse(result.content);
    // Les empreintes de jeton de partage et les références de stockage sont
    // exclues — et c’est DIT dans le fichier, avant son contenu. Le lecteur sait
    // donc ce qui lui manque au lieu de le découvrir en restaurant.
    expect(payload.omitted.map((entry: { table: string }) => entry.table)).toEqual(["document_share_links", "client_attachments"]);
    expect(payload.omitted.map((entry: { columns: string[] }) => entry.columns).flat()).toEqual([
      "tokenHash",
      "storageKey",
      "storageUrl",
    ]);
    for (const entry of payload.omitted) expect(entry.reason.length).toBeGreaterThan(20);

    // Et AUCUNE ligne exportée ne porte ces colonnes : la déclaration n’est pas
    // un rideau, c’est la vérité sur le contenu.
    for (const row of payload.tables.document_share_links) {
      expect(Object.keys(row)).not.toContain("tokenHash");
    }
    for (const row of payload.tables.client_attachments) {
      expect(Object.keys(row)).not.toContain("storageKey");
      expect(Object.keys(row)).not.toContain("storageUrl");
    }
    expect(result.content).not.toMatch(/[a-f0-9]{64}/);
  });

  it("ne SELECTIONNE jamais une colonne secrète", () => {
    const source = readSource("server/systemDataPurge.ts");
    const requetes = [...source.matchAll(/sql`([\s\S]*?)`/g)].map(match => match[1]).join("\n");
    for (const interdit of ["tokenHash", "storageKey", "storageUrl", "passwordHash", "mfaSecret"]) {
      expect(requetes).not.toContain(interdit);
    }
  });

  it("refuse un client qui ne porte AUCUN motif de recette", async () => {
    const { run } = contentRunQuery(EXPORT_HANDLERS);
    // Le client 3 existe, mais son nom et son adresse sont ceux d’une vraie
    // entreprise : on n’exporte pas « par ressemblance ».
    await expect(exportDemoData({ actor, tenantId: TENANT, clientIds: [3] }, { runQuery: run })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("ressemblance"),
    });
  });

  it("refuse un identifiant inconnu, et distingue ce refus du précédent", async () => {
    const { run } = contentRunQuery(EXPORT_HANDLERS);
    await expect(exportDemoData({ actor, tenantId: TENANT, clientIds: [99] }, { runQuery: run })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuse un client reconnu mais bloqué, avec la raison", async () => {
    const steps: Step[] = [
      CLIENT_ROWS,
      DOCUMENT_ROWS,
      [...MESURE_ROWS, { client_id: 3, documents: "1", projects: "1" }],
      [],
      DOCUMENT_ROWS,
    ];
    const { run } = queuedRunQuery(steps);
    await expect(exportDemoData({ actor, tenantId: TENANT, clientIds: [3] }, { runQuery: run })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("aucun motif"),
    });
  });

  it("refuse une sélection vide ou démesurée", async () => {
    const { run } = contentRunQuery(EXPORT_HANDLERS);
    await expect(exportDemoData({ actor, tenantId: TENANT, clientIds: [] }, { runQuery: run })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const trop = Array.from({ length: 500 }, (_, index) => index + 1);
    await expect(exportDemoData({ actor, tenantId: TENANT, clientIds: trop }, { runQuery: run })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuse d’exporter sans instance associée à la session", async () => {
    const { run } = contentRunQuery(EXPORT_HANDLERS);
    await expect(exportDemoData({ actor, tenantId: null, clientIds: [1] }, { runQuery: run })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});

/* ------------------------------------------------------------------ */
/* 6. Purge — aucun chemin ne mène à une suppression non couverte      */
/* ------------------------------------------------------------------ */

describe("system.data.purge — les verrous, dans l’ordre", () => {
  let lignes: string[] = [];
  let espion: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    lignes = [];
    espion = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      lignes.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    espion.mockRestore();
  });

  it("REFUSE et n’écrit RIEN sans export préalable", async () => {
    const { execute, captured } = honestExecute();
    const { run } = queuedRunQuery(SCOPE_STEPS);

    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [1], confirmation: expectedConfirmation(TOTAL_CLIENT_1), exportToken: "" },
        { runQuery: run, execute },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("jeton d’export") });

    // L’essentiel : l’exécution n’a JAMAIS été appelée.
    expect(captured).toEqual([]);
  });

  it("REFUSE un jeton d’un AUTRE périmètre, même valide", async () => {
    const { execute, captured } = honestExecute();
    const { run } = queuedRunQuery(SCOPE_STEPS);
    const autre = issueExportToken({ tenantId: TENANT, actorId: ACTOR_ID, clientIds: [2], totalRecords: TOTAL_CLIENT_2 }, {});

    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [1], confirmation: expectedConfirmation(TOTAL_CLIENT_1), exportToken: autre.token },
        { runQuery: run, execute },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("mêmes clients") });
    expect(captured).toEqual([]);
  });

  it("REFUSE un jeton expiré ou mal signé, sans rien exécuter", async () => {
    const { execute, captured } = honestExecute();
    const perimetre = { tenantId: TENANT, actorId: ACTOR_ID, clientIds: [1], totalRecords: TOTAL_CLIENT_1 };
    const { token } = issueExportToken(perimetre, { now: () => new Date(1_700_000_000_000) });

    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [1], confirmation: expectedConfirmation(TOTAL_CLIENT_1), exportToken: token },
        { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute, now: () => new Date(1_800_000_000_000) },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("expiré") });

    const { token: autreCle } = issueExportToken(perimetre, { secret: mocks.autreSecret });
    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [1], confirmation: expectedConfirmation(TOTAL_CLIENT_1), exportToken: autreCle },
        { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("pas été produit par cette instance") });

    expect(captured).toEqual([]);
  });

  it("REFUSE une phrase fausse, et n’exécute rien", async () => {
    const { execute, captured } = honestExecute();
    const perimetre = { tenantId: TENANT, actorId: ACTOR_ID, clientIds: [1], totalRecords: TOTAL_CLIENT_1 };
    const { token } = issueExportToken(perimetre, {});

    const phrases = [
      "",
      "SUPPRIMER 1 ENREGISTREMENTS",
      "SUPPRIMER 4 ENREGISTREMENTS",
      "SUPPRIMER ENREGISTREMENTS",
      "supprimer 14 enregistrements",
      "SUPPRIMER 14 ENREGISTREMENT",
      "OUI",
    ];
    for (const confirmation of phrases) {
      await expect(
        purgeDemoData(
          { actor, tenantId: TENANT, clientIds: [1], confirmation, exportToken: token },
          { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
        ),
        `la phrase « ${confirmation} » doit être refusée`,
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("14 enregistrement(s)") });
    }
    expect(captured).toEqual([]);
  });

  it("REFUSE un client réel sans motif, et un identifiant inconnu", async () => {
    const { execute, captured } = honestExecute();
    const { token } = issueExportToken({ tenantId: TENANT, actorId: ACTOR_ID, clientIds: [3], totalRecords: 1 }, {});

    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [3], confirmation: expectedConfirmation(1), exportToken: token },
        { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("ressemblance") });

    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [99], confirmation: expectedConfirmation(1), exportToken: token },
        { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(captured).toEqual([]);
  });

  it("PURGE la sélection : export, phrase, périmètre, exécution — et rien d’autre", async () => {
    const { execute, captured } = honestExecute();
    const exportation = await exportDemoData({ actor, tenantId: TENANT, clientIds: [1] }, { runQuery: contentRunQuery(EXPORT_HANDLERS).run });

    const result = await purgeDemoData(
      {
        actor,
        tenantId: TENANT,
        clientIds: [1],
        confirmation: expectedConfirmation(exportation.totalRecords),
        exportToken: exportation.token,
      },
      { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
    );

    // L’exécution a eu lieu UNE fois, avec le plan du seul client demandé.
    expect(captured).toHaveLength(1);
    const plan = captured[0];
    for (const statement of plan) {
      const attendu = statement.column === "documentId" ? [100, 101] : [1];
      expect(statement.values, `${statement.table}`).toEqual(attendu);
    }

    // Ce qui est ANNONCÉ est ce qui est SUPPRIMÉ.
    expect(result.totalRecords).toBe(TOTAL_CLIENT_1);
    expect(result.totalRecords).toBe(expectedTotalOf(plan));
    expect(result.totalRecords).toBe(exportation.totalRecords);
    expect(result.clientIds).toEqual([1]);
    expect(result.deleted.reduce((total, entry) => total + entry.count, 0)).toBe(TOTAL_CLIENT_1);
    // Les tables dont l’inventaire annonce zéro ligne ne sont pas visitées : elles
    // n’apparaissent donc pas ici. Le client 1 n’a aucune pièce jointe.
    expect(Object.fromEntries(result.deleted.map(entry => [entry.table, entry.count]))).toEqual({
      document_lines: 5,
      payments: 1,
      payment_promises: 1,
      document_share_links: 1,
      client_activities: 3,
      documents: 2,
      clients: 1,
    });
  });

  it("n’écrit QUE les identifiants sélectionnés, jamais ceux des autres clients", async () => {
    const { execute, captured } = honestExecute();
    const perimetre = { tenantId: TENANT, actorId: ACTOR_ID, clientIds: [2], totalRecords: TOTAL_CLIENT_2 };
    const { token } = issueExportToken(perimetre, {});

    const result = await purgeDemoData(
      {
        actor,
        tenantId: TENANT,
        clientIds: [2],
        confirmation: expectedConfirmation(TOTAL_CLIENT_2),
        exportToken: token,
      },
      { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
    );

    // Le client 2 n’a aucun document : le plan ne doit contenir que le client 2.
    const plan = captured[0];
    expect(plan.map(statement => statement.table)).toEqual(["clients"]);
    expect(plan[0].values).toEqual([2]);
    // Ni 1 (l’autre candidat), ni 100/101 (les documents du client 1).
    for (const statement of plan) {
      expect(statement.values).not.toContain(1);
      expect(statement.values).not.toContain(100);
      expect(statement.values).not.toContain(101);
    }
    expect(result.totalRecords).toBe(1);
  });

  it("ANNULE tout si le nombre supprimé ne correspond pas à l’inventaire", async () => {
    // L’exécution rend un compte faux : la purge doit refuser de conclure, et
    // c’est la transaction qui porte l’annulation (aucune ligne validée).
    const execute = async (statements: readonly PurgeStatement[]) =>
      new Map(statements.map(statement => [statement.table, Math.max(0, statement.expected - 1)]));
    const { token } = issueExportToken({ tenantId: TENANT, actorId: ACTOR_ID, clientIds: [1], totalRecords: TOTAL_CLIENT_1 }, {});

    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [1], confirmation: expectedConfirmation(TOTAL_CLIENT_1), exportToken: token },
        { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
      ),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("annulée") });

    // Le refus est journalisé, et il ne prétend PAS que des lignes ont disparu.
    const ecritures = lignes.filter(ligne => ligne.startsWith("[console] écriture"));
    expect(ecritures).toHaveLength(1);
    expect(ecritures[0]).toContain("action=donnees.purge");
    expect(ecritures[0]).toContain("resultat=echec");
    expect(ecritures[0]).toContain("supprimes:0");
  });

  it("JOURNALISE chaque suppression : acteur, périmètre et comptes", async () => {
    const { execute } = honestExecute();
    const { token } = issueExportToken({ tenantId: TENANT, actorId: ACTOR_ID, clientIds: [1], totalRecords: TOTAL_CLIENT_1 }, {});

    await purgeDemoData(
      { actor, tenantId: TENANT, clientIds: [1], confirmation: expectedConfirmation(TOTAL_CLIENT_1), exportToken: token },
      { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
    );

    const ecritures = lignes.filter(ligne => ligne.startsWith("[console] écriture"));
    expect(ecritures).toHaveLength(1);
    const ligne = ecritures[0];
    expect(ligne).toContain("action=donnees.purge");
    expect(ligne).toContain("resultat=ok");
    expect(ligne).toContain("acteur=systeme@example.com(id 42)");
    expect(ligne).toContain("role=systeme");
    expect(ligne).toContain("tenant=1");
    // Le périmètre ET les comptes par table : ce qu’on cherche en relisant.
    expect(ligne).toContain("cible=donnees#clients=1");
    expect(ligne).toContain("comptes=");
    expect(ligne).toContain("enregistrements:14");
    expect(ligne).toContain("documents:2");
    expect(ligne).toContain("clients:1");
    // Aucun secret, aucun contenu de ligne, aucun nom de client dans le journal.
    expect(ligne).not.toMatch(/password|secret|token|mfa/i);
    expect(ligne).not.toContain("Test SARL");
    expect(ligne).not.toContain("facturation@example.com");
  });

  it("JOURNALISE aussi les refus, sans jamais exécuter", async () => {
    const { execute, captured } = honestExecute();
    await expect(
      purgeDemoData(
        { actor, tenantId: TENANT, clientIds: [1], confirmation: "NON", exportToken: "" },
        { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
      ),
    ).rejects.toBeTruthy();

    expect(captured).toEqual([]);
    // Un refus AVANT l’exécution n’est pas journalisé comme un échec de base :
    // rien n’a été tenté, et le journal ne doit pas laisser croire le contraire.
    expect(lignes.filter(ligne => ligne.startsWith("[console] écriture"))).toEqual([]);
  });

  it("refuse de purger sans instance associée", async () => {
    const { execute, captured } = honestExecute();
    await expect(
      purgeDemoData(
        { actor, tenantId: null, clientIds: [1], confirmation: expectedConfirmation(1), exportToken: "v1.x.y" },
        { runQuery: queuedRunQuery(SCOPE_STEPS).run, execute },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(captured).toEqual([]);
  });

  it("normalise la sélection reçue du réseau : entiers positifs, uniques, triés", () => {
    expect(normalizeSelectedIds([3, 1, 3, -2, 0, 2.5, Number.NaN, 7])).toEqual([1, 3, 7]);
    expect(normalizeSelectedIds([])).toEqual([]);
  });

  it("n’exécute jamais le plan en base sans base disponible", async () => {
    // `executeWithDatabase` sans `DATABASE_URL` : refus explicite, aucune écriture.
    await expect(executeWithDatabase(planPurgeStatements({ clients: [scopeClient({ clientId: 1 })], documents: [] }), TENANT)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});
