import { sql, type SQL } from "drizzle-orm";
import { DOCUMENT_STATUSES, documentStatusLabel } from "../shared/billing";
import { peekTenant } from "./_core/tenantContext";
import { getDb } from "./db";

/**
 * INVENTAIRE DES DONNÉES POUR LA CONSOLE D’EXPLOITATION (module « Données &
 * conformité », lot 3).
 *
 * Ce module ne fait que LIRE : il n’émet que des `select`. Les suppressions
 * vivent dans `server/systemDataPurge.ts`, et elles passent toutes par
 * l’inventaire ci-dessous — c’est ce qui garantit que ce qui est ANNONCÉ à
 * l’écran est exactement ce qui est SUPPRIMÉ.
 *
 * Règles de restitution (identiques à `systemMetrics.ts` et `systemAccess.ts`) :
 * - jamais de valeur inventée : une mesure illisible vaut `null` et son nom est
 *   inscrit dans `unavailable` ;
 * - jamais de secret : la liste des colonnes lues est écrite à la main, et ni
 *   `passwordHash`, ni `mfaSecretCipher`, ni `tokenHash` n’y figurent ;
 * - jamais de message d’erreur brut : un échec peut contenir des détails de
 *   connexion, on ne les remonte pas ;
 * - l’objet retourné est sérialisable tel quel.
 *
 * DEUX PÉRIMÈTRES, ET ILS NE SE CONFONDENT PAS
 * --------------------------------------------
 * - les VOLUMES de `collectDataOverview` portent sur l’INSTANCE ENTIÈRE, tous
 *   espaces confondus : c’est la question « qu’y a-t-il dans cette base ? », et
 *   la réponse doit couvrir tout ce qui existe. L’écran le dit.
 * - les CANDIDATS de `collectDemoCandidates` portent sur le TENANT courant, et
 *   rien d’autre : on ne propose jamais de supprimer ce qu’on ne peut pas
 *   relire. C’est aussi le périmètre qu’appliquent l’export et la purge.
 */

/** Mesure pouvant rester indisponible (base injoignable, droits manquants…). */
export type DataUnavailableMeasure = "volumes" | "documentsByStatus" | "databaseSize" | "candidates";

/** Volume d’une table significative. `count: null` = mesure indisponible. */
export type DataVolumeKind =
  | "accounts"
  | "clients"
  | "documents"
  | "documentLines"
  | "payments"
  | "paymentPromises"
  | "agentDelegations"
  | "agentMessageJobs"
  | "clientActivities";

export type DataVolume = {
  key: DataVolumeKind;
  label: string;
  /** Nom exact de la table comptée — l’écran peut le montrer, il n’est pas secret. */
  table: string;
  count: number | null;
};

/** Ce qui est compté, et où. Liste FERMÉE : aucun comptage implicite. */
export const DATA_VOLUMES: readonly Omit<DataVolume, "count">[] = [
  { key: "accounts", label: "Comptes", table: "users" },
  { key: "clients", label: "Clients", table: "clients" },
  { key: "documents", label: "Documents (devis et factures)", table: "documents" },
  { key: "documentLines", label: "Lignes de document", table: "document_lines" },
  { key: "payments", label: "Paiements", table: "payments" },
  { key: "paymentPromises", label: "Promesses de paiement", table: "payment_promises" },
  { key: "agentDelegations", label: "Délégations d’agent", table: "agent_delegations" },
  { key: "agentMessageJobs", label: "Tâches d’agent préparées", table: "agent_message_jobs" },
  { key: "clientActivities", label: "Activités client", table: "client_activities" },
];

export type DocumentStatusVolume = { status: string; label: string; count: number };

export type SystemDataOverview = {
  /** Horodatage serveur du relevé (ISO 8601). */
  generatedAt: string;
  /** Les volumes couvrent l’instance entière : c’est dit, pas sous-entendu. */
  scope: "instance";
  database: { sizeBytes: number | null };
  volumes: DataVolume[];
  documentsByStatus: DocumentStatusVolume[] | null;
  unavailable: DataUnavailableMeasure[];
};

export type DataDeps = {
  /** Remplace l’accès à la base. Les tests peuvent le faire échouer. */
  runQuery?: RawQueryRunner;
  /** Horloge injectable. */
  now?: () => Date;
  /** Tenant lu. `undefined` = aucun périmètre lisible : on ne lit rien. */
  tenantId?: number;
};

/** Exécuteur de requêtes brutes — injectable pour tester la robustesse. */
export type RawQueryRunner = (query: SQL) => Promise<Record<string, unknown>[]>;

/* ------------------------------------------------------------------ */
/* Conversions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Les agrégats PostgreSQL (`count`) reviennent en `bigint`, que `postgres.js`
 * sérialise en chaîne : on convertit explicitement.
 */
function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Compteur d’une mesure : `null` reste `null`, jamais 0 par complaisance. */
function asCount(value: unknown): number {
  return Math.max(0, asNumber(value) ?? 0);
}

/** Ouvre le client une seule fois, puis sert toutes les lectures. */
async function resolveRunQuery(deps: DataDeps): Promise<RawQueryRunner> {
  if (deps.runQuery) return deps.runQuery;
  const db = await getDb();
  if (!db) {
    return async () => {
      throw new Error("Base de données indisponible.");
    };
  }
  return async query => Array.from((await db.execute(query)) as unknown as Record<string, unknown>[]);
}

/**
 * Liste d’identifiants liée en PARAMÈTRES (`$1, $2, …`).
 *
 * Jamais de concaténation : les identifiants viennent d’une requête HTTP, et une
 * chaîne interpolée dans du SQL serait une injection. `sql.join` produit
 * exactement ce qu’un `in (…)` attend.
 */
function idList(ids: readonly number[]): SQL {
  return sql.join(
    ids.map(id => sql`${id}`),
    sql`, `,
  );
}

/**
 * Plafond du nombre de clients traités en une fois.
 *
 * Une sélection humaine reste petite ; au-delà, c’est une requête forgée. Refuser
 * vaut mieux que bâtir un `in (…)` de dix mille paramètres.
 */
export const MAX_SELECTED_CLIENTS = 200;

/* ------------------------------------------------------------------ */
/* Volumes (lecture, périmètre instance)                               */
/* ------------------------------------------------------------------ */

async function measureVolumes(runQuery: RawQueryRunner): Promise<DataVolume[]> {
  const rows = await runQuery(sql`
    select
      (select count(*) from users) as accounts,
      (select count(*) from clients) as clients,
      (select count(*) from documents) as documents,
      (select count(*) from document_lines) as document_lines,
      (select count(*) from payments) as payments,
      (select count(*) from payment_promises) as payment_promises,
      (select count(*) from agent_delegations) as agent_delegations,
      (select count(*) from agent_message_jobs) as agent_message_jobs,
      (select count(*) from client_activities) as client_activities
  `);
  const row = rows[0];
  if (!row) {
    // Aucune ligne : la mesure n’a pas eu lieu. On ne fabrique pas des zéros.
    return DATA_VOLUMES.map(volume => ({ ...volume, count: null }));
  }
  const byColumn: Record<DataVolumeKind, unknown> = {
    accounts: row.accounts,
    clients: row.clients,
    documents: row.documents,
    documentLines: row.document_lines,
    payments: row.payments,
    paymentPromises: row.payment_promises,
    agentDelegations: row.agent_delegations,
    agentMessageJobs: row.agent_message_jobs,
    clientActivities: row.client_activities,
  };
  return DATA_VOLUMES.map(volume => ({ ...volume, count: asNumber(byColumn[volume.key]) }));
}

async function measureDatabaseSize(runQuery: RawQueryRunner): Promise<number | null> {
  const rows = await runQuery(sql`select pg_database_size(current_database()) as bytes`);
  return asNumber(rows[0]?.bytes);
}

/**
 * Documents par statut. L’ordre suit `DOCUMENT_STATUSES` ; un statut rencontré en
 * base qui n’est pas au vocabulaire est AJOUTÉ en fin de liste plutôt que perdu —
 * un décompte qui disparaît laisserait croire qu’il n’existe pas.
 */
async function measureDocumentsByStatus(runQuery: RawQueryRunner): Promise<DocumentStatusVolume[]> {
  const rows = await runQuery(sql`
    select "status"::text as status, count(*) as count
    from documents
    group by "status"
  `);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const status = asText(row.status);
    if (status === null) continue;
    counts.set(status, asCount(row.count));
  }
  const ordered: string[] = [...DOCUMENT_STATUSES];
  for (const status of Array.from(counts.keys())) {
    if (!ordered.includes(status)) ordered.push(status);
  }
  return ordered.map(status => ({ status, label: documentStatusLabel(status), count: counts.get(status) ?? 0 }));
}

/**
 * Relève les volumes de l’instance. Ne lève jamais : une mesure illisible vaut
 * `null` et se déclare, plutôt que d’afficher un zéro trompeur.
 */
export async function collectDataOverview(deps: DataDeps = {}): Promise<SystemDataOverview> {
  const now = deps.now ?? (() => new Date());
  const unavailable: DataUnavailableMeasure[] = [];
  const runQuery = await resolveRunQuery(deps);

  let volumes: DataVolume[] = DATA_VOLUMES.map(volume => ({ ...volume, count: null }));
  try {
    volumes = await measureVolumes(runQuery);
  } catch {
    unavailable.push("volumes");
  }

  let documentsByStatus: DocumentStatusVolume[] | null = null;
  try {
    documentsByStatus = await measureDocumentsByStatus(runQuery);
  } catch {
    unavailable.push("documentsByStatus");
  }

  let sizeBytes: number | null = null;
  try {
    sizeBytes = await measureDatabaseSize(runQuery);
  } catch {
    unavailable.push("databaseSize");
  }

  return {
    generatedAt: now().toISOString(),
    scope: "instance",
    database: { sizeBytes },
    volumes,
    documentsByStatus,
    unavailable,
  };
}

/* ------------------------------------------------------------------ */
/* Règle de sélection des candidats — FERMÉE, EXPLICITE, PUBLIÉE       */
/* ------------------------------------------------------------------ */

/**
 * POURQUOI UNE LISTE FERMÉE DE MOTIFS, ET PAS UN SCORE DE RESSEMBLANCE.
 *
 * Cette règle décide quels clients sont PROPOSÉS à la suppression. Une
 * heuristique floue (score de similarité, modèle de langage) produirait des
 * propositions qu’on ne saurait pas justifier : l’administrateur devrait faire
 * confiance à une boîte noire pour décider de détruire des données. Ici, la
 * règle est courte, lisible, et CHAQUE candidat porte le motif exact qui l’a
 * fait retenir. Un client sans motif n’est jamais candidat — c’est une
 * propriété de construction, pas une promesse (voir `findDemoMotifs`).
 *
 * POURQUOI CES MOTIFS-LÀ SONT PRUDENTS.
 * 1. `test`, `demo` et `smtp` ne sont reconnus QUE comme MOTS ENTIERS. Le motif
 *    exige un caractère non alphanumérique (ou un bord) avant et après :
 *    « Test SARL » et « client-demo » sont reconnus, « Démolition »,
 *    « Contestation » et « Testament » ne le sont pas. Un `includes()` naïf
 *    aurait signalé une entreprise de démolition comme donnée de recette.
 * 2. Les adresses sont jugées sur le DOMAINE, avec les domaines que l’IETF a
 *    réservés à la documentation et aux tests (RFC 2606, RFC 6761) :
 *    `example.*`, et les TLD `.test`, `.invalid`, `.example`, `.localhost`.
 *    Aucune de ces adresses ne peut appartenir à un vrai client : elles ne
 *    résolvent pas.
 * 3. La comparaison ignore la casse et les accents, mais la VALEUR AFFICHÉE est
 *    celle de la base — on ne montre jamais une version retouchée du nom.
 * 4. Les chantiers, les tâches d’agent et les références croisées entre clients
 *    EXCLUENT un candidat au lieu d’être ignorés : ce sont des données métier
 *    réelles qui empêcheraient la suppression, ou que la suppression abîmerait.
 */

/** Champ examiné pour décider qu’un client est une donnée de recette. */
export type DemoField = "companyName" | "contactName" | "email";

/** Motif élémentaire, publié tel quel dans la réponse. */
export type DemoMatcher = {
  key: string;
  label: string;
  /** Motif EXACT appliqué (expression régulière, sur une copie normalisée). */
  pattern: string;
  /** Champs auxquels ce motif s’applique. */
  fields: readonly DemoField[];
  explanation: string;
};

/** Mots reconnus comme marqueurs de recette, en MOTS ENTIERS. */
export const DEMO_WORDS = ["test", "demo", "smtp"] as const;

/**
 * Domaines de test : `example.*` (RFC 2606) et les TLD réservés à la
 * documentation (RFC 6761). Ces domaines ne résolvent pas — un vrai client ne
 * peut pas en avoir.
 */
export const RESERVED_EMAIL_TLDS = ["test", "invalid", "example", "localhost"] as const;

export const DEMO_MATCHERS: readonly DemoMatcher[] = [
  {
    key: "mot_de_test",
    label: "Mot « test » (mot entier)",
    pattern: "(^|[^a-z0-9])tests?([^a-z0-9]|$)",
    fields: ["companyName", "contactName", "email"],
    explanation:
      "Le nom ou l’adresse contient « test » comme mot séparé. « Testament » ou « Contestation » ne sont pas reconnus : le motif exige une frontière de part et d’autre.",
  },
  {
    key: "mot_de_demo",
    label: "Mot « demo » ou « démo » (mot entier)",
    pattern: "(^|[^a-z0-9])demos?([^a-z0-9]|$)",
    fields: ["companyName", "contactName", "email"],
    explanation:
      "Le nom ou l’adresse contient « demo » comme mot séparé. « Démolition » n’est pas reconnu — le motif exige une frontière après « demo ».",
  },
  {
    key: "mot_smtp",
    label: "Mot « smtp » (mot entier)",
    pattern: "(^|[^a-z0-9])smtps?([^a-z0-9]|$)",
    fields: ["companyName", "contactName", "email"],
    explanation:
      "Le nom ou l’adresse contient « smtp » comme mot séparé : c’est une adresse de recette de messagerie, jamais un client.",
  },
  {
    key: "domaine_example",
    label: "Domaine example.* (RFC 2606)",
    pattern: "(^|\\.)example\\.[a-z]{2,}$",
    fields: ["email"],
    explanation:
      "Le domaine de l’adresse est `example.<quelque chose>`. Ces domaines sont réservés à la documentation et ne résolvent pas.",
  },
  {
    key: "domaine_reserve",
    label: "Domaine de test réservé (RFC 6761)",
    pattern: "\\.(test|invalid|example|localhost)$",
    fields: ["email"],
    explanation:
      "Le domaine de l’adresse se termine par un TLD réservé à la documentation (.test, .invalid, .example, .localhost). Aucune de ces adresses ne peut être celle d’un vrai client.",
  },
];

/**
 * Normalise une valeur pour la COMPARAISON : minuscules, accents retirés.
 *
 * La valeur affichée reste celle de la base ; seule la copie examinée est
 * normalisée, sinon « Démo » échapperait au motif « demo ».
 */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Motif de mot entier — compilé une fois, jamais construit à la volée. */
function wordMatcher(word: string): RegExp {
  return new RegExp(`(^|[^a-z0-9])${word}s?([^a-z0-9]|$)`);
}

const WORD_MATCHERS = DEMO_WORDS.map((word, index) => ({
  matcher: DEMO_MATCHERS[index],
  regex: wordMatcher(word),
}));

const EXAMPLE_DOMAIN = /(^|\.)example\.[a-z]{2,}$/;
const RESERVED_DOMAIN = /\.(test|invalid|example|localhost)$/;

/** Un motif retenu, avec la valeur RÉELLE qui l’a déclenché. */
export type DemoMotif = {
  /** Clé du motif (`DEMO_MATCHERS[].key`) — jamais un libellé libre. */
  matcher: string;
  field: DemoField;
  /** Libellé du motif, recopié du descripteur publié. */
  label: string;
  /** Motif exact appliqué. */
  pattern: string;
  /** Valeur examinée, TELLE QU’EN BASE (jamais la copie normalisée). */
  value: string;
  /** Portion reconnue, dans la valeur d’origine. */
  matched: string;
};

/** Partie locale et domaine d’une adresse, ou `null` si elle n’est pas exploitable. */
function splitEmail(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return { local: email.slice(0, at), domain: email.slice(at + 1).replace(/\.$/, "") };
}

function motif(matcher: DemoMatcher, field: DemoField, value: string, matched: string): DemoMotif {
  return { matcher: matcher.key, field, label: matcher.label, pattern: matcher.pattern, value, matched };
}

/** Client examiné : trois champs, et rien d’autre. */
export type DemoClientFields = {
  companyName: string;
  contactName: string | null;
  email: string | null;
};

/**
 * MOTIFS QUI DÉCLENCHENT, pour un client. Fonction PURE.
 *
 * C’est le seul point d’entrée de la décision : un client est candidat si et
 * seulement si cette fonction rend au moins un motif. Il n’existe donc pas de
 * candidat sans justification — la propriété tient à la forme du code, pas à la
 * vigilance de qui le relit.
 */
export function findDemoMotifs(client: DemoClientFields): DemoMotif[] {
  const motifs: DemoMotif[] = [];

  const nameFields: Array<{ field: DemoField; value: string | null }> = [
    { field: "companyName", value: client.companyName },
    { field: "contactName", value: client.contactName },
  ];
  for (const { field, value } of nameFields) {
    if (value === null || value.trim().length === 0) continue;
    const normalized = normalizeForMatch(value);
    for (const { matcher, regex } of WORD_MATCHERS) {
      if (regex.test(normalized)) motifs.push(motif(matcher, field, value, matcher.label));
    }
  }

  const email = client.email;
  if (email !== null && email.trim().length > 0) {
    const parts = splitEmail(email);
    if (parts) {
      const local = normalizeForMatch(parts.local);
      for (const { matcher, regex } of WORD_MATCHERS) {
        if (regex.test(local)) motifs.push(motif(matcher, "email", email, matcher.label));
      }
      const domain = normalizeForMatch(parts.domain);
      for (const matcher of DEMO_MATCHERS) {
        if (matcher.key === "domaine_example" && EXAMPLE_DOMAIN.test(domain)) {
          motifs.push(motif(matcher, "email", email, parts.domain));
        }
        if (matcher.key === "domaine_reserve" && RESERVED_DOMAIN.test(domain)) {
          motifs.push(motif(matcher, "email", email, parts.domain));
        }
      }
    }
  }

  return motifs;
}

/* ------------------------------------------------------------------ */
/* Périmètre d’un client candidat                                      */
/* ------------------------------------------------------------------ */

/**
 * Ce qui SERAIT supprimé avec un client. Chaque nombre est un comptage réel.
 *
 * `documents`, `payments` et `paymentPromises` sont les tables nommées par le
 * cahier des charges ; les autres sont incluses parce que la purge les supprime
 * vraiment, et qu’un décompte qui les tairait serait faux.
 */
export type DemoRecordCounts = {
  documents: number;
  documentLines: number;
  payments: number;
  paymentPromises: number;
  shareLinks: number;
  activities: number;
  attachments: number;
};

/** Ordre d’affichage et libellés des compteurs — un seul endroit à tenir à jour. */
export const DEMO_COUNT_LABELS: ReadonlyArray<{ key: keyof DemoRecordCounts; label: string }> = [
  { key: "documents", label: "Documents" },
  { key: "documentLines", label: "Lignes de document" },
  { key: "payments", label: "Paiements" },
  { key: "paymentPromises", label: "Promesses de paiement" },
  { key: "shareLinks", label: "Liens de partage" },
  { key: "activities", label: "Activités client" },
  { key: "attachments", label: "Pièces jointes client" },
];

/** Un client du périmètre, avec ses motifs et ses compteurs. */
export type DemoScopeClient = {
  clientId: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  motifs: DemoMotif[];
  counts: DemoRecordCounts;
  /**
   * Nombre d’enregistrements qu’une purge de ce client supprimerait, client
   * compris. C’est le nombre que la confirmation doit recopier.
   */
  totalRecords: number;
  /** `null` si le client est purgeable ; sinon la raison exacte du refus. */
  blockedReason: string | null;
};

export const EMPTY_DEMO_COUNTS: DemoRecordCounts = {
  documents: 0,
  documentLines: 0,
  payments: 0,
  paymentPromises: 0,
  shareLinks: 0,
  activities: 0,
  attachments: 0,
};

/**
 * Total annoncé pour un client : le client lui-même, plus tout ce que la purge
 * supprime avec lui. Une seule formule, employée par l’inventaire ET par la
 * purge — c’est ce qui rend les deux nombres identiques par construction.
 */
export function totalRecordsFor(counts: DemoRecordCounts): number {
  return (
    1 +
    counts.documents +
    counts.documentLines +
    counts.payments +
    counts.paymentPromises +
    counts.shareLinks +
    counts.activities +
    counts.attachments
  );
}

export type DemoScopeRead = {
  clients: DemoScopeClient[];
  /**
   * Identifiants de TOUS les clients du tenant, motifs ou pas.
   *
   * Sert à distinguer deux refus qui n’appellent pas la même réaction :
   * « ce client n’existe pas » (l’identifiant est périmé) et « ce client existe
   * mais ne porte aucun motif de recette » (la demande n’est pas légitime).
   */
  knownClientIds: number[];
  /** `true` quand l’inventaire n’a pas pu être lu : on ne propose RIEN. */
  unavailable: boolean;
};

type ClientRow = { id: number; companyName: string; contactName: string | null; email: string | null };

async function loadTenantClients(runQuery: RawQueryRunner, tenantId: number): Promise<ClientRow[]> {
  const rows = await runQuery(sql`
    select "id", "companyName", "contactName", "email"
    from clients
    where "tenantId" = ${tenantId}
    order by "companyName" asc, "id" asc
  `);
  return rows
    .map(row => ({
      id: asNumber(row.id) ?? 0,
      companyName: asText(row.companyName) ?? "",
      contactName: asText(row.contactName),
      email: asText(row.email),
    }))
    .filter(row => row.id > 0 && row.companyName.length > 0);
}

/** Documents des clients visés : sert à la fois aux comptages et aux blocages. */
async function loadDocumentsOfClients(
  runQuery: RawQueryRunner,
  tenantId: number,
  clientIds: readonly number[],
): Promise<Array<{ id: number; clientId: number }>> {
  const rows = await runQuery(sql`
    select "id", "clientId"
    from documents
    where "tenantId" = ${tenantId} and "clientId" in (${idList(clientIds)})
  `);
  return rows
    .map(row => ({ id: asNumber(row.id) ?? 0, clientId: asNumber(row.clientId) ?? 0 }))
    .filter(row => row.id > 0);
}

/**
 * Comptages par client, en UNE requête.
 *
 * Les prédicats (`"clientId" = c.id`, `"tenantId" = …`) sont ceux que la purge
 * emploiera pour supprimer : mesurer autrement que l’on supprime est la façon la
 * plus sûre d’annoncer un nombre faux.
 */
/**
 * Comptage mesuré d’un client, avec les deux mesures qui ne sont PAS des
 * suppressions : `projects` (ce qui empêcherait la purge) et `agentJobs` (les
 * tâches d’agent qui la bloqueraient). Les additionner au total annoncé serait
 * une faute — elles ne disparaissent pas.
 */
type MeasuredClientCounts = DemoRecordCounts & { projects: number; agentJobs: number };

async function measureClientCounts(
  runQuery: RawQueryRunner,
  tenantId: number,
  clientIds: readonly number[],
): Promise<Map<number, MeasuredClientCounts>> {
  const rows = await runQuery(sql`
    select
      c."id" as client_id,
      (select count(*) from documents d where d."clientId" = c."id" and d."tenantId" = ${tenantId}) as documents,
      (select count(*) from document_lines l
         join documents d on d."id" = l."documentId"
        where d."clientId" = c."id" and d."tenantId" = ${tenantId}) as document_lines,
      (select count(*) from payments p
         join documents d on d."id" = p."documentId"
        where d."clientId" = c."id" and d."tenantId" = ${tenantId}) as payments,
      (select count(*) from payment_promises pp
         join documents d on d."id" = pp."documentId"
        where d."clientId" = c."id" and d."tenantId" = ${tenantId}) as payment_promises,
      (select count(*) from document_share_links s
         join documents d on d."id" = s."documentId"
        where d."clientId" = c."id" and d."tenantId" = ${tenantId}) as share_links,
      (select count(*) from client_activities a
        where a."clientId" = c."id" and a."tenantId" = ${tenantId}) as activities,
      (select count(*) from client_attachments ca
        where ca."clientId" = c."id" and ca."tenantId" = ${tenantId}) as attachments,
      (select count(*) from projects pr
        where pr."clientId" = c."id" and pr."tenantId" = ${tenantId}) as projects,
      (select count(*) from agent_message_jobs j
        where j."clientId" = c."id" and j."tenantId" = ${tenantId}) as agent_jobs
    from clients c
    where c."tenantId" = ${tenantId} and c."id" in (${idList(clientIds)})
  `);
  const counts = new Map<number, MeasuredClientCounts>();
  for (const row of rows) {
    const clientId = asNumber(row.client_id);
    if (clientId === null) continue;
    counts.set(clientId, {
      documents: asCount(row.documents),
      documentLines: asCount(row.document_lines),
      payments: asCount(row.payments),
      paymentPromises: asCount(row.payment_promises),
      shareLinks: asCount(row.share_links),
      activities: asCount(row.activities),
      attachments: asCount(row.attachments),
      projects: asCount(row.projects),
      agentJobs: asCount(row.agent_jobs),
    });
  }
  return counts;
}

/**
 * Documents du périmètre qu’une suppression ABÎMERAIT au-delà du périmètre.
 *
 * Trois cas, tous réels dans ce schéma :
 * 1. une tâche d’agent référence un document (`agent_message_jobs.documentId`,
 *    `on delete restrict`) : la suppression serait refusée par la base ;
 * 2. une activité d’un AUTRE client référence un de ces documents
 *    (`client_activities.documentId`, `on delete set null`) : la ligne
 *    survivrait, mais perdrait son rattachement — une donnée réelle abîmée ;
 * 3. un document d’un AUTRE client référence un de ces documents
 *    (`documents.relatedDocumentId`, sans contrainte) : la référence
 *    deviendrait pendante.
 *
 * On ne supprime pas « à peu près » : ces documents rendent leur client non
 * purgeable, avec le motif écrit.
 */
async function loadBlockingDocumentIds(
  runQuery: RawQueryRunner,
  tenantId: number,
  documentIds: readonly number[],
  clientIds: readonly number[],
): Promise<Set<number>> {
  if (documentIds.length === 0) return new Set();
  const rows = await runQuery(sql`
    select j."documentId" as document_id
      from agent_message_jobs j
     where j."tenantId" = ${tenantId} and j."documentId" in (${idList(documentIds)})
    union
    select a."documentId" as document_id
      from client_activities a
     where a."tenantId" = ${tenantId} and a."documentId" in (${idList(documentIds)})
       and a."clientId" not in (${idList(clientIds)})
    union
    select d."relatedDocumentId" as document_id
      from documents d
     where d."tenantId" = ${tenantId} and d."relatedDocumentId" in (${idList(documentIds)})
       and d."clientId" not in (${idList(clientIds)})
  `);
  const ids = new Set<number>();
  for (const row of rows) {
    const id = asNumber(row.document_id);
    if (id !== null && id > 0) ids.add(id);
  }
  return ids;
}

/**
 * Inventaire du périmètre : tous les clients qui portent au moins un motif, avec
 * leurs compteurs et, le cas échéant, la raison qui interdit leur purge.
 *
 * Ne lève jamais. Un inventaire illisible rend une liste VIDE et
 * `unavailable: true` — c’est-à-dire « rien à proposer », jamais « tout est
 * bon à supprimer ».
 */
export async function readDemoScope(deps: DataDeps = {}): Promise<DemoScopeRead> {
  const tenantId = deps.tenantId ?? peekTenant();
  if (tenantId === undefined) return { clients: [], knownClientIds: [], unavailable: true };

  try {
    const runQuery = await resolveRunQuery(deps);

    const allClients = await loadTenantClients(runQuery, tenantId);
    const knownClientIds = allClients.map(client => client.id);
    const matching = allClients
      .map(client => ({ client, motifs: findDemoMotifs(client) }))
      .filter(entry => entry.motifs.length > 0);
    if (matching.length === 0) return { clients: [], knownClientIds, unavailable: false };

    const matchingIds = matching.map(entry => entry.client.id);
    const documents = await loadDocumentsOfClients(runQuery, tenantId, matchingIds);
    const perClient = await measureClientCounts(runQuery, tenantId, matchingIds);

    /**
     * LE PÉRIMÈTRE RÉELLEMENT PURGEABLE EST CALCULÉ AVANT LA RECHERCHE DES
     * RÉFÉRENCES CROISÉES, et l’ordre compte.
     *
     * Un client retenu par un chantier ou par une tâche d’agent est écarté de
     * toute façon. Chercher ensuite si « un AUTRE client » référence ses
     * documents donnerait un faux négatif : l’autre client est peut-être
     * lui-même un candidat — écarté — et sa ligne d’activité survivrait à la
     * suppression en perdant son rattachement. En comparant à l’ensemble
     * effectivement purgé, la question posée est la bonne : « qu’est-ce que
     * cette suppression abîmerait AILLEURS que dans le périmètre ? »
     */
    const purgableIds = matching
      .filter(({ client }) => {
        const measured = perClient.get(client.id);
        return (measured?.projects ?? 0) === 0 && (measured?.agentJobs ?? 0) === 0;
      })
      .map(entry => entry.client.id);
    const purgableDocuments = documents.filter(document => purgableIds.includes(document.clientId));
    const blockingDocumentIds = await loadBlockingDocumentIds(
      runQuery,
      tenantId,
      purgableDocuments.map(document => document.id),
      purgableIds,
    );

    const clients = matching.map(({ client, motifs }) => {
      const measured = perClient.get(client.id);
      const counts: DemoRecordCounts = measured
        ? {
            documents: measured.documents,
            documentLines: measured.documentLines,
            payments: measured.payments,
            paymentPromises: measured.paymentPromises,
            shareLinks: measured.shareLinks,
            activities: measured.activities,
            attachments: measured.attachments,
          }
        : { ...EMPTY_DEMO_COUNTS };
      const projets = measured?.projects ?? 0;
      const taches = measured?.agentJobs ?? 0;
      const documentsBloquants = documents.filter(
        document => document.clientId === client.id && blockingDocumentIds.has(document.id),
      ).length;

      // L’ORDRE DES RAISONS SUIT LA GRAVITÉ : ce qui empêcherait la base de
      // supprimer d’abord, ce qui abîmerait une donnée réelle ensuite.
      const raisons: string[] = [];
      if (projets > 0) {
        raisons.push(
          `${projets} chantier(s) rattaché(s) à ce client : un chantier n’est pas une donnée de recette et n’est jamais supprimé ici.`,
        );
      }
      if (taches > 0) {
        raisons.push(`${taches} tâche(s) d’agent référencent ce client.`);
      }
      if (documentsBloquants > 0) {
        raisons.push(
          `${documentsBloquants} document(s) de ce client sont référencés ailleurs (tâche d’agent, activité ou document d’un autre client).`,
        );
      }

      return {
        clientId: client.id,
        companyName: client.companyName,
        contactName: client.contactName,
        email: client.email,
        motifs,
        counts,
        totalRecords: totalRecordsFor(counts),
        blockedReason: raisons.length > 0 ? raisons.join(" ") : null,
      };
    });

    return { clients, knownClientIds, unavailable: false };
  } catch {
    // Aucun message d’erreur brut : il peut contenir des détails de connexion.
    return { clients: [], knownClientIds: [], unavailable: true };
  }
}

/* ------------------------------------------------------------------ */
/* Réponse de l’inventaire                                             */
/* ------------------------------------------------------------------ */

/** Client proposé à la purge : il porte un motif ET aucun blocage. */
export type DemoCandidate = DemoScopeClient & { motifs: DemoMotif[]; blockedReason: null };

/** Client reconnu comme donnée de recette, mais NON purgeable — et pourquoi. */
export type DemoExcluded = {
  clientId: number;
  companyName: string;
  motifs: DemoMotif[];
  reason: string;
};

export type SystemDemoCandidates = {
  generatedAt: string;
  scope: "tenant";
  /** La règle appliquée, publiée en entier : rien n’est caché. */
  rules: readonly DemoMatcher[];
  candidates: DemoCandidate[];
  excluded: DemoExcluded[];
  /**
   * Somme des enregistrements des CANDIDATS seuls (bloqués exclus). C’est le
   * nombre que la confirmation doit recopier pour purger toute la sélection.
   * `null` quand l’inventaire est illisible : jamais un zéro trompeur.
   */
  totalRecords: number | null;
  unavailable: DataUnavailableMeasure[];
};

/**
 * Candidats « données de démonstration ». LECTURE SEULE : cette fonction ne
 * supprime rien, et n’a aucun moyen de le faire (pas une seule instruction
 * d’écriture dans ce module).
 */
export async function collectDemoCandidates(deps: DataDeps = {}): Promise<SystemDemoCandidates> {
  const now = deps.now ?? (() => new Date());
  const read = await readDemoScope(deps);

  if (read.unavailable) {
    return {
      generatedAt: now().toISOString(),
      scope: "tenant",
      rules: DEMO_MATCHERS,
      candidates: [],
      excluded: [],
      totalRecords: null,
      unavailable: ["candidates"],
    };
  }

  const candidates: DemoCandidate[] = [];
  const excluded: DemoExcluded[] = [];
  for (const client of read.clients) {
    if (client.blockedReason === null) {
      candidates.push({ ...client, blockedReason: null });
    } else {
      excluded.push({
        clientId: client.clientId,
        companyName: client.companyName,
        motifs: client.motifs,
        reason: client.blockedReason,
      });
    }
  }

  return {
    generatedAt: now().toISOString(),
    scope: "tenant",
    rules: DEMO_MATCHERS,
    candidates,
    excluded,
    totalRecords: candidates.reduce((total, candidate) => total + candidate.totalRecords, 0),
    unavailable: [],
  };
}
