import { sql, type SQL } from "drizzle-orm";
import { parseDatabasePoolSize } from "./_core/dbPool";
import { getDb, pingDatabase } from "./db";

/**
 * Mesures de la console d’exploitation (Phase 2 « Voir », module 2 — Santé &
 * supervision).
 *
 * Toutes les mesures sont des **lectures** : `select`, `count`, `pg_catalog`.
 * Aucune écriture, aucune migration, aucun DDL n’est émis par ce module.
 *
 * Règles de restitution :
 * - jamais de valeur inventée : une mesure illisible vaut `null` et son nom est
 *   inscrit dans `unavailable` ;
 * - jamais de message d’erreur brut ni de valeur d’environnement : un échec de
 *   requête peut contenir des détails de connexion, on ne les remonte pas ;
 * - l’objet retourné est sérialisable tel quel (nombres, chaînes, booléens, tableaux).
 */

/** Tables principales dont la taille est relevée (lecture seule). */
export const MEASURED_TABLES = [
  "clients",
  "documents",
  "document_lines",
  "payments",
  "projects",
  "project_costs",
  "client_activities",
  "users",
  "invitations",
  "integration_connections",
] as const;

/** Mesure pouvant rester indisponible (droits manquants, base injoignable…). */
export type UnavailableMeasure = "observedConnections" | "databaseSize" | "tableSizes" | "counts" | "migration";

export type SystemTableSize = { name: string; bytes: number };

export type SystemMetricsCounts = {
  clients: number | null;
  documents: number | null;
  pendingInvitations: number | null;
  accounts: number | null;
};

export type SystemMetrics = {
  /** Horodatage serveur du relevé (ISO 8601). */
  generatedAt: string;
  database: {
    /** `false` si la requête de santé échoue (l’application, elle, répond). */
    reachable: boolean;
    /** Latence mesurée côté serveur autour du `select 1` de santé, en ms. */
    latencyMs: number | null;
    pool: {
      /** Taille configurée du pool de connexions (`DATABASE_POOL_SIZE`). */
      limit: number;
      /**
       * Connexions ouvertes sur la base, vues par le serveur PostgreSQL.
       * `null` quand la mesure est indisponible.
       */
      observedConnections: number | null;
    };
    /** `pg_database_size(current_database())`, en octets. */
    sizeBytes: number | null;
    /** `pg_total_relation_size` des tables principales, plus grosses d’abord. */
    tables: SystemTableSize[];
  };
  counts: SystemMetricsCounts;
  migration: {
    /** `true` si le schéma de suivi `drizzle.__drizzle_migrations` existe. */
    tracked: boolean;
    /** Horodatage de la dernière migration enregistrée (ISO 8601). */
    appliedAt: string | null;
    /** Empreinte de la dernière migration (contenu du fichier, pas un secret). */
    hash: string | null;
  };
  /** Noms des mesures restées indisponibles (voir `UnavailableMeasure`). */
  unavailable: UnavailableMeasure[];
};

/** Exécuteur de requêtes brutes — injectable pour tester la robustesse. */
export type RawQueryRunner = (query: SQL) => Promise<Record<string, unknown>[]>;

export type SystemMetricsDeps = {
  /** Remplace `pingDatabase` (latence mesurée autour de cet appel). */
  ping?: () => Promise<boolean>;
  /** Remplace l’accès à la base. Les tests peuvent le faire échouer. */
  runQuery?: RawQueryRunner;
  /** Horloge injectable. */
  now?: () => Date;
  /** Taille de pool injectable. */
  poolLimit?: number;
};

const EMPTY_COUNTS: SystemMetricsCounts = {
  clients: null,
  documents: null,
  pendingInvitations: null,
  accounts: null,
};

/**
 * Les agrégats PostgreSQL (`count`, `pg_*_size`) reviennent en `bigint`, que
 * `postgres.js` sérialise en chaîne : on convertit explicitement, sinon on
 * afficherait « 12 » pour douze octets.
 */
function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Isole une mesure : une erreur la rend `null` et l’inscrit comme indisponible,
 * sans jamais laisser l’exception remonter jusqu’à la procédure tRPC.
 */
async function guarded<T>(key: UnavailableMeasure, unavailable: UnavailableMeasure[], run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    if (!unavailable.includes(key)) unavailable.push(key);
    return null;
  }
}

/** Ouvre le client une seule fois, puis sert toutes les mesures. */
async function resolveRunQuery(deps: SystemMetricsDeps): Promise<RawQueryRunner> {
  if (deps.runQuery) return deps.runQuery;
  const db = await getDb();
  if (!db) {
    return async () => {
      throw new Error("Base de données indisponible.");
    };
  }
  return async query => Array.from((await db.execute(query)) as unknown as Record<string, unknown>[]);
}

async function measureObservedConnections(runQuery: RawQueryRunner): Promise<number | null> {
  const rows = await runQuery(sql`select count(*) as value from pg_stat_activity where datname = current_database()`);
  return asNumber(rows[0]?.value);
}

async function measureDatabaseSize(runQuery: RawQueryRunner): Promise<number | null> {
  const rows = await runQuery(sql`select pg_database_size(current_database()) as bytes`);
  return asNumber(rows[0]?.bytes);
}

async function measureTableSizes(runQuery: RawQueryRunner): Promise<SystemTableSize[]> {
  // `sql.join` plutôt qu’un tableau lié : drizzle déploierait un tableau en
  // liste de paramètres, ce qui casserait la comparaison `in (...)`.
  const names = sql.join(
    MEASURED_TABLES.map(name => sql`${name}`),
    sql`, `,
  );
  const rows = await runQuery(sql`
    select c.relname as name, pg_total_relation_size(c.oid) as bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname in (${names})
    order by pg_total_relation_size(c.oid) desc
  `);
  return rows
    .map(row => ({ name: String(row.name ?? "").trim(), bytes: asNumber(row.bytes) ?? 0 }))
    .filter(row => row.name.length > 0);
}

async function measureCounts(runQuery: RawQueryRunner): Promise<SystemMetricsCounts> {
  const rows = await runQuery(sql`
    select
      (select count(*) from clients) as clients,
      (select count(*) from documents) as documents,
      (select count(*) from invitations where status = 'pending') as pending_invitations,
      (select count(*) from users) as accounts
  `);
  const row = rows[0];
  if (!row) return { ...EMPTY_COUNTS };
  return {
    clients: asNumber(row.clients),
    documents: asNumber(row.documents),
    pendingInvitations: asNumber(row.pending_invitations),
    accounts: asNumber(row.accounts),
  };
}

async function measureMigration(runQuery: RawQueryRunner): Promise<SystemMetrics["migration"]> {
  const tracked = await runQuery(sql`select to_regclass('drizzle.__drizzle_migrations') as relation`);
  if (tracked[0]?.relation === null || tracked[0]?.relation === undefined) {
    // Le schéma de suivi Drizzle n’existe pas dans cette base : on le dit au lieu
    // de fabriquer une date de migration.
    return { tracked: false, appliedAt: null, hash: null };
  }
  const rows = await runQuery(sql`
    select hash, created_at
    from drizzle.__drizzle_migrations
    order by created_at desc
    limit 1
  `);
  const row = rows[0];
  if (!row) return { tracked: true, appliedAt: null, hash: null };
  // `__drizzle_migrations.created_at` est un horodatage en millisecondes (bigint).
  const appliedAt = asNumber(row.created_at);
  return {
    tracked: true,
    appliedAt: appliedAt === null ? null : new Date(appliedAt).toISOString(),
    hash: typeof row.hash === "string" && row.hash.length <= 128 ? row.hash : null,
  };
}

/**
 * Relève les mesures de supervision. Ne lève jamais : une base injoignable ou
 * une requête refusée produit un relevé partiel explicitement marqué.
 */
export async function collectSystemMetrics(deps: SystemMetricsDeps = {}): Promise<SystemMetrics> {
  const ping = deps.ping ?? pingDatabase;
  const now = deps.now ?? (() => new Date());
  const poolLimit = deps.poolLimit ?? parseDatabasePoolSize(process.env.DATABASE_POOL_SIZE);
  const unavailable: UnavailableMeasure[] = [];

  // Latence mesurée côté serveur, autour du seul `pingDatabase()`.
  const startedAt = now().getTime();
  let reachable = false;
  try {
    reachable = await ping();
  } catch {
    reachable = false;
  }
  const latencyMs = reachable ? Math.max(0, Math.round(now().getTime() - startedAt)) : null;

  if (!reachable) {
    // Aucune mesure ne peut être relevée : on le déclare plutôt que d’émettre
    // des requêtes vouées à l’échec.
    return {
      generatedAt: now().toISOString(),
      database: {
        reachable: false,
        latencyMs: null,
        pool: { limit: poolLimit, observedConnections: null },
        sizeBytes: null,
        tables: [],
      },
      counts: { ...EMPTY_COUNTS },
      migration: { tracked: false, appliedAt: null, hash: null },
      unavailable: ["observedConnections", "databaseSize", "tableSizes", "counts", "migration"],
    };
  }

  const runQuery = await resolveRunQuery(deps);
  const [observedConnections, sizeBytes, tables, counts, migration] = await Promise.all([
    guarded("observedConnections", unavailable, () => measureObservedConnections(runQuery)),
    guarded("databaseSize", unavailable, () => measureDatabaseSize(runQuery)),
    guarded("tableSizes", unavailable, () => measureTableSizes(runQuery)),
    guarded("counts", unavailable, () => measureCounts(runQuery)),
    guarded("migration", unavailable, () => measureMigration(runQuery)),
  ]);

  return {
    generatedAt: now().toISOString(),
    database: {
      reachable: true,
      latencyMs,
      pool: { limit: poolLimit, observedConnections },
      sizeBytes,
      tables: tables ?? [],
    },
    counts: counts ?? { ...EMPTY_COUNTS },
    migration: migration ?? { tracked: false, appliedAt: null, hash: null },
    unavailable,
  };
}
