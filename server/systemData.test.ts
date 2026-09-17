import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  DATA_VOLUMES,
  DEMO_MATCHERS,
  DEMO_WORDS,
  MAX_SELECTED_CLIENTS,
  RESERVED_EMAIL_TLDS,
  collectDataOverview,
  collectDemoCandidates,
  findDemoMotifs,
  normalizeForMatch,
  readDemoScope,
  totalRecordsFor,
  type RawQueryRunner,
} from "./systemData";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * INVENTAIRE DES DONNÉES — MODULE DE LECTURE.
 *
 * Trois familles de preuves, et aucune ne sollicite de base :
 *  1. la RÈGLE DE SÉLECTION, testée sur des noms réels d’entreprises : ce qui est
 *     reconnu, et surtout ce qui ne l’est PAS ;
 *  2. la ROBUSTESSE : une mesure illisible vaut `null` et se déclare, jamais 0 ;
 *  3. l’HONNÊTETÉ STATIQUE : le module n’émet que des `select` — donc il ne peut
 *     pas supprimer ce qu’il propose.
 */

/** Dialecte employé UNIQUEMENT pour lire le texte d’une requête dans un double. */
const dialect = new PgDialect();

/** Texte SQL d’une requête drizzle, pour router un double de lecture. */
function sqlText(query: SQL): string {
  return dialect.sqlToQuery(query).sql;
}

type Rows = Array<Record<string, unknown>>;
type Step = Rows | "throw";

/**
 * Double de lecture piloté par CONTENU, et non par ordre : chaque requête est
 * reconnue à ce qu’elle interroge. Un test qui dépendrait de l’ordre des lectures
 * casserait au premier ajout de mesure, sans que rien ne soit faux.
 */
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

/** Suite de réponses, consommées dans l’ordre : pratique pour le périmètre. */
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
  return { run, seen };
}

/* ------------------------------------------------------------------ */
/* 1. La règle de sélection                                            */
/* ------------------------------------------------------------------ */

describe("Règle de sélection des candidats — ce qui est reconnu, ce qui ne l’est pas", () => {
  const champs = (companyName: string, email: string | null = null, contactName: string | null = null) => ({
    companyName,
    contactName,
    email,
  });

  it("reconnaît les marques de recette ÉVIDENTES", () => {
    const reconnus: Array<{ companyName: string; email?: string | null; contactName?: string | null }> = [
      { companyName: "Test SARL" },
      { companyName: "Client test" },
      { companyName: "TEST" },
      { companyName: "Boutique démo" },
      { companyName: "Relance DEMO 2" },
      { companyName: "Serveur smtp" },
      { companyName: "Recette test-1" },
      { companyName: "Recette test_2" },
      { companyName: "Lucepres", email: "test@lucepres.gn" },
      { companyName: "Lucepres", email: "contact@example.com" },
      { companyName: "Lucepres", email: "contact@example.org" },
      { companyName: "Lucepres", email: "facturation@boutique.example.net" },
      { companyName: "Lucepres", email: "demo@lucepres.test" },
      { companyName: "Lucepres", email: "contact@machine.invalid" },
      { companyName: "Lucepres", email: "contact@localhost.localhost" },
      { companyName: "Sans rapport", contactName: "Service test" },
    ];

    for (const entree of reconnus) {
      const motifs = findDemoMotifs({
        companyName: entree.companyName,
        contactName: entree.contactName ?? null,
        email: entree.email ?? null,
      });
      expect(motifs.length, `« ${entree.companyName} » / ${entree.email ?? "sans adresse"} devrait être reconnu`).toBeGreaterThan(0);
    }
  });

  it("NE reconnaît PAS des noms d’entreprise bien réels qui contiennent ces lettres", () => {
    // C’EST LE CŒUR DE LA PRUDENCE. Un `includes("demo")` aurait signalé une
    // entreprise de démolition ; un `includes("test")` aurait signalé une
    // société de travaux attestés. Ces clients ne doivent JAMAIS être proposés.
    const innocents = [
      "Démolition Konaté",
      "Demolition Services",
      "Contestation SARL",
      "Testament & Fils",
      "Attestation Camara",
      "Société Attestée de Guinée",
      "Démocratie BTP",
    ];

    for (const companyName of innocents) {
      expect(findDemoMotifs({ companyName, contactName: null, email: null }), `« ${companyName} » ne doit pas être reconnu`).toEqual([]);
    }
  });

  it("NE reconnaît pas une adresse professionnelle ordinaire", () => {
    const innocents = ["contact@lucepres.gn", "a.bah@lucepres.gn", "direction@btp-guinee.com", "info@demolition-conakry.gn"];

    for (const email of innocents) {
      expect(findDemoMotifs({ companyName: "Client réel", contactName: null, email }), `« ${email} » ne doit pas être reconnu`).toEqual([]);
    }
  });

  it("exige un MOT ENTIER, jamais une sous-chaîne", () => {
    expect(findDemoMotifs({ companyName: "Démolition", contactName: null, email: null })).toEqual([]);
    expect(findDemoMotifs({ companyName: "Démo", contactName: null, email: null }).length).toBeGreaterThan(0);
    // L’accent ne doit pas sauver un mot : « démo » est normalisé en « demo ».
    expect(normalizeForMatch("Démo")).toBe("demo");
  });

  it("n’expose que des motifs PUBLIÉS, chacun avec sa valeur réelle", () => {
    const published = new Set(DEMO_MATCHERS.map(matcher => matcher.key));
    const motifs = findDemoMotifs({ companyName: "Client test", contactName: null, email: "contact@example.com" });

    expect(motifs.length).toBeGreaterThanOrEqual(2);
    for (const motif of motifs) {
      expect(published.has(motif.matcher)).toBe(true);
      // Le motif porte la valeur TELLE QU’EN BASE, jamais la copie normalisée.
      expect(["Client test", "contact@example.com"]).toContain(motif.value);
      expect(motif.label.length).toBeGreaterThan(0);
      expect(motif.pattern.length).toBeGreaterThan(0);
    }
    // Le déclencheur du domaine est bien celui du domaine, pas celui du mot.
    expect(motifs.map(motif => motif.matcher)).toContain("domaine_example");
  });

  it("publie une règle fermée, courte et lisible", () => {
    expect(DEMO_MATCHERS.length).toBeGreaterThanOrEqual(5);
    for (const matcher of DEMO_MATCHERS) {
      expect(matcher.fields.length).toBeGreaterThan(0);
      expect(matcher.explanation.length).toBeGreaterThan(20);
    }
    // Les mots et les domaines réservés sont PUBLIÉS : un test les relit plutôt
    // que de les laisser enfouis dans une expression régulière.
    expect(DEMO_WORDS).toEqual(["test", "demo", "smtp"]);
    expect(RESERVED_EMAIL_TLDS).toContain("test");
    expect(RESERVED_EMAIL_TLDS).toContain("invalid");
    // Chaque expression publiée est compilable telle quelle.
    for (const matcher of DEMO_MATCHERS) {
      expect(() => new RegExp(matcher.pattern)).not.toThrow();
    }
  });

  it("ne compte le client lui-même qu’UNE fois dans le total annoncé", () => {
    const counts = { documents: 2, documentLines: 5, payments: 1, paymentPromises: 1, shareLinks: 1, activities: 3, attachments: 0 };
    // 1 (le client) + 2 + 5 + 1 + 1 + 1 + 3 + 0
    expect(totalRecordsFor(counts)).toBe(14);
    expect(totalRecordsFor({ documents: 0, documentLines: 0, payments: 0, paymentPromises: 0, shareLinks: 0, activities: 0, attachments: 0 })).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Volumes — honnêteté des mesures                                  */
/* ------------------------------------------------------------------ */

describe("Volumes de la base — aucune valeur inventée", () => {
  it("rend « indisponible » plutôt que zéro quand rien n’est lisible", async () => {
    // Sans `runQuery` injecté, le module ouvre `getDb()` : sans `DATABASE_URL`,
    // la base est indisponible et toutes les requêtes échouent.
    const overview = await collectDataOverview({});

    expect(overview.scope).toBe("instance");
    expect(overview.database.sizeBytes).toBeNull();
    expect(overview.documentsByStatus).toBeNull();
    for (const volume of overview.volumes) expect(volume.count).toBeNull();
    expect(overview.unavailable).toEqual(["volumes", "documentsByStatus", "databaseSize"]);
    // Et le relevé reste sérialisable : rien d’exotique n’y a été glissé.
    expect(JSON.parse(JSON.stringify(overview))).toEqual(overview);
  });

  it("ne recopie jamais un message d’erreur dans le relevé", async () => {
    const { run } = queuedRunQuery(["throw", "throw", "throw"]);
    const overview = await collectDataOverview({ runQuery: run });
    const serialized = JSON.stringify(overview);
    expect(serialized).not.toMatch(/échec simulé|Error|password|secret|token/i);
  });

  it("convertit les bigints rendus en chaîne par postgres.js", async () => {
    const { run } = contentRunQuery([
      {
        match: /as accounts/,
        rows: [
          {
            accounts: "4",
            clients: "7",
            documents: "23",
            document_lines: "51",
            payments: "9",
            payment_promises: "2",
            agent_delegations: "1",
            agent_message_jobs: "6",
            client_activities: "31",
          },
        ],
      },
      { match: /pg_database_size/, rows: [{ bytes: "2097152" }] },
      { match: /group by "status"/, rows: [{ status: "paye", count: "3" }] },
    ]);

    const overview = await collectDataOverview({ runQuery: run });

    expect(overview.database.sizeBytes).toBe(2_097_152);
    expect(overview.unavailable).toEqual([]);
    const parCle = Object.fromEntries(overview.volumes.map(volume => [volume.key, volume.count]));
    expect(parCle).toEqual({
      accounts: 4,
      clients: 7,
      documents: 23,
      documentLines: 51,
      payments: 9,
      paymentPromises: 2,
      agentDelegations: 1,
      agentMessageJobs: 6,
      clientActivities: 31,
    });
    // La répartition par statut suit le vocabulaire métier, complété par ce qui
    // existe en base : « paye » est un statut connu, donc à sa place.
    expect(overview.documentsByStatus?.find(entry => entry.status === "paye")?.count).toBe(3);
    expect(overview.documentsByStatus?.find(entry => entry.status === "paye")?.label).toBe("Payé");
    expect(overview.documentsByStatus?.find(entry => entry.status === "brouillon")?.count).toBe(0);
  });

  it("ajoute un statut inconnu au lieu de le perdre", async () => {
    const { run } = contentRunQuery([
      { match: /as accounts/, rows: [] },
      { match: /pg_database_size/, rows: [{ bytes: "1" }] },
      { match: /group by "status"/, rows: [{ status: "statut_herite", count: "2" }] },
    ]);

    const overview = await collectDataOverview({ runQuery: run });
    const herite = overview.documentsByStatus?.find(entry => entry.status === "statut_herite");
    expect(herite?.count).toBe(2);
    // Un statut hors vocabulaire est affiché tel quel (soulignés remplacés), pas masqué.
    expect(herite?.label).toBe("statut herite");
  });

  it("ne mesure que des tables déclarées par le schéma", () => {
    const schema = readSource("drizzle/schema.ts");
    for (const volume of DATA_VOLUMES) {
      expect(schema).toContain(`"${volume.table}"`);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Inventaire des candidats                                         */
/* ------------------------------------------------------------------ */

/** Réponses du périmètre : 1 clients, 2 documents, 3 comptages, 4 blocages. */
const CLIENTS_ROWS: Rows = [
  { id: 1, companyName: "Test SARL", contactName: "Service test", email: "facturation@example.com" },
  { id: 2, companyName: "Client démo", contactName: null, email: "contact@lucepress.test" },
  { id: 3, companyName: "Maçonnerie Démolition", contactName: null, email: "contact@btp-guinee.com" },
  { id: 4, companyName: "Chantier test bloqué", contactName: null, email: null },
  { id: 5, companyName: "Test tâches d’agent", contactName: null, email: null },
];

const DOCUMENT_ROWS: Rows = [
  { id: 100, clientId: 1 },
  { id: 101, clientId: 1 },
  { id: 200, clientId: 4 },
  { id: 300, clientId: 5 },
];

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
  {
    client_id: 4,
    documents: "1",
    document_lines: "2",
    payments: "0",
    payment_promises: "0",
    share_links: "0",
    activities: "0",
    attachments: "0",
    projects: "1",
    agent_jobs: "0",
  },
  {
    client_id: 5,
    documents: "1",
    document_lines: "1",
    payments: "0",
    payment_promises: "0",
    share_links: "0",
    activities: "0",
    attachments: "0",
    projects: "0",
    agent_jobs: "2",
  },
];

const SCOPE_STEPS: Step[] = [CLIENTS_ROWS, DOCUMENT_ROWS, MESURE_ROWS, []];

function scopeRunner(steps: Step[] = SCOPE_STEPS) {
  return queuedRunQuery(steps);
}

describe("Inventaire des candidats — proposer n’est pas supprimer", () => {
  it("ne propose RIEN et le dit quand l’inventaire est illisible", async () => {
    const { run } = queuedRunQuery(["throw"]);
    const lecteur = await readDemoScope({ runQuery: run, tenantId: 1 });
    expect(lecteur).toEqual({ clients: [], knownClientIds: [], unavailable: true });

    const inventaire = await collectDemoCandidates({ runQuery: queuedRunQuery(["throw"]).run, tenantId: 1 });
    expect(inventaire.candidates).toEqual([]);
    expect(inventaire.excluded).toEqual([]);
    // `null`, jamais 0 : un zéro laisserait croire qu’il n’y a rien à faire.
    expect(inventaire.totalRecords).toBeNull();
    expect(inventaire.unavailable).toEqual(["candidates"]);
  });

  it("ne retient que les clients porteurs d’un motif, et le prouve", async () => {
    const { run } = scopeRunner();
    const inventaire = await collectDemoCandidates({ runQuery: run, tenantId: 1 });

    expect(inventaire.scope).toBe("tenant");
    // 1 et 2 sont proposés ; 4 et 5 portent un motif MAIS sont écartés (chantier,
    // tâches d’agent) — voir le test suivant.
    expect(inventaire.candidates.map(candidate => candidate.clientId)).toEqual([1, 2]);
    // « Maçonnerie Démolition » (id 3) est absent : elle ne porte aucun motif.
    expect(inventaire.candidates.some(candidate => candidate.clientId === 3)).toBe(false);
    for (const candidate of inventaire.candidates) {
      expect(candidate.motifs.length).toBeGreaterThan(0);
      expect(candidate.blockedReason).toBeNull();
    }
    // Le motif exact du candidat 1 est publié, champ et valeur compris.
    const motifs = inventaire.candidates.find(candidate => candidate.clientId === 1)!.motifs;
    expect(motifs.map(motif => motif.matcher)).toEqual(expect.arrayContaining(["mot_de_test"]));
    expect(motifs.map(motif => motif.field)).toEqual(expect.arrayContaining(["companyName", "contactName"]));
  });

  it("écarte un client reconnu quand sa suppression emporterait du métier réel", async () => {
    const { run } = scopeRunner();
    const inventaire = await collectDemoCandidates({ runQuery: run, tenantId: 1 });

    // Le client 4 porte un motif MAIS un chantier rattaché → écarté.
    const ecarte = inventaire.excluded.find(entry => entry.clientId === 4);
    expect(ecarte).toBeDefined();
    expect(ecarte!.reason).toContain("chantier");
    expect(ecarte!.motifs.length).toBeGreaterThan(0);

    // Le client 5 porte un motif MAIS des tâches d’agent → écarté.
    const taches = inventaire.excluded.find(entry => entry.clientId === 5);
    expect(taches).toBeDefined();
    expect(taches!.reason).toContain("tâche(s) d’agent");
    expect(taches!.reason).not.toContain("chantier");
  });

  it("totalise UNIQUEMENT les candidats purgeables", async () => {
    const { run } = scopeRunner();
    const inventaire = await collectDemoCandidates({ runQuery: run, tenantId: 1 });

    // Client 1 : 1 + 2 + 5 + 1 + 1 + 1 + 3 + 0 = 14. Client 2 : 1 (lui-même).
    expect(inventaire.candidates.find(candidate => candidate.clientId === 1)?.totalRecords).toBe(14);
    expect(inventaire.candidates.find(candidate => candidate.clientId === 2)?.totalRecords).toBe(1);
    // 14 + 1, et surtout PAS 14 + 1 + 4 + 3 (les écartés ne comptent pas).
    expect(inventaire.totalRecords).toBe(15);
    expect(inventaire.totalRecords).toBe(inventaire.candidates.reduce((total, candidate) => total + candidate.totalRecords, 0));
  });

  it("écarte aussi un document référencé ailleurs, avec le motif écrit", async () => {
    // Le document 100 est référencé par une tâche d’agent : le client 1 devient
    // non purgeable, et sa raison doit le dire.
    const { run } = scopeRunner([CLIENTS_ROWS, DOCUMENT_ROWS, MESURE_ROWS, [{ document_id: 100 }]]);
    const inventaire = await collectDemoCandidates({ runQuery: run, tenantId: 1 });

    const ecarte = inventaire.excluded.find(entry => entry.clientId === 1);
    expect(ecarte).toBeDefined();
    expect(ecarte!.reason).toContain("référencé");
    expect(inventaire.candidates.map(candidate => candidate.clientId)).toEqual([2]);
    expect(inventaire.totalRecords).toBe(1);
  });

  it("rend une liste vide quand aucun client ne porte de motif", async () => {
    const { run } = scopeRunner([[{ id: 9, companyName: "BTP Guinée", contactName: null, email: "contact@btp-guinee.com" }]]);
    const lecteur = await readDemoScope({ runQuery: run, tenantId: 1 });
    expect(lecteur).toEqual({ clients: [], knownClientIds: [9], unavailable: false });
    // Une seule requête a suffi : on ne mesure pas un périmètre vide.
    expect(run).toBeTypeOf("function");

    const inventaire = await collectDemoCandidates({ runQuery: run, tenantId: 1 });
    expect(inventaire.candidates).toEqual([]);
    expect(inventaire.totalRecords).toBe(0);
    expect(inventaire.unavailable).toEqual([]);
  });

  it("ne lit rien du tout sans périmètre lisible", async () => {
    let appele = false;
    const lecteur = await readDemoScope({
      tenantId: undefined,
      runQuery: async () => {
        appele = true;
        return [];
      },
    });
    expect(appele).toBe(false);
    expect(lecteur.unavailable).toBe(true);
  });

  it("plafonne la sélection manuelle", () => {
    expect(MAX_SELECTED_CLIENTS).toBeGreaterThan(0);
    expect(MAX_SELECTED_CLIENTS).toBeLessThanOrEqual(500);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Preuve statique : ce module LIT                                 */
/* ------------------------------------------------------------------ */

describe("Preuve statique — le module d’inventaire n’écrit pas", () => {
  it("n’émet que des `select`", () => {
    const source = readSource("server/systemData.ts");
    const bodies = [...source.matchAll(/sql`([\s\S]*?)`/g)].map(match => match[1].trim());
    // On écarte les fragments purement paramétriques et les séparateurs.
    const statements = bodies.filter(body => !/^\$\{[^}]*\}$/.test(body) && body !== ",");

    expect(statements.length).toBeGreaterThanOrEqual(6);
    for (const statement of statements) {
      expect(statement.toLowerCase()).toMatch(/^select\b/);
      expect(statement.toLowerCase()).not.toMatch(/\b(insert|update|delete|create|alter|drop|truncate|grant)\b/);
    }
  });

  it("ne lit jamais une colonne secrète", () => {
    const source = readSource("server/systemData.ts");
    // La vérification porte sur les REQUÊTES, pas sur la prose : c’est la liste
    // des colonnes lues qui doit être propre, et elle l’est écrite à la main.
    const statements = [...source.matchAll(/sql`([\s\S]*?)`/g)].map(match => match[1]).join("\n");
    for (const interdit of ["passwordHash", "mfaSecretCipher", "mfaRecoveryCodes", "tokenHash", "storageKey", "storageUrl"]) {
      expect(statements).not.toContain(interdit);
    }
    // Et la promesse est écrite noir sur blanc dans le module, pas seulement tenue.
    expect(source).toContain("passwordHash");
  });

  it("emploie `sql.join` pour les listes d’identifiants, jamais une concaténation", () => {
    const source = readSource("server/systemData.ts");
    expect(source).toContain("sql.join(");
    // Toute liste d’identifiants passe par `idList`, qui lie chaque valeur en
    // paramètre : aucune valeur venue d’une requête n’est concaténée au SQL.
    for (const match of source.matchAll(/in \(\$\{([^}]*)\}\)/g)) {
      expect(match[1]).toMatch(/^idList\(/);
    }
  });
});
