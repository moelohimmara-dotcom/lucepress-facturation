import { sql, type SQL } from "drizzle-orm";
import { APP_ROLES, APP_ROLE_LABELS } from "@shared/roles";
import { peekTenant } from "./_core/tenantContext";
import { getDb } from "./db";

/**
 * Lecture des accès de l’instance pour la console d’exploitation (Phase 3
 * « Protéger », étape A — lecture seule).
 *
 * Ce module n’émet QUE des `select` : aucune écriture, aucune migration, aucun
 * DDL. Il ne peut donc pas modifier un compte, un rôle ni un mot de passe.
 *
 * Règles de restitution (identiques à `systemMetrics.ts`) :
 * - jamais de valeur inventée : une lecture impossible vaut `[]` / `null` et son
 *   nom est inscrit dans `unavailable` ;
 * - jamais de secret, jamais de jeton : la liste des colonnes lues est écrite en
 *   clair ci-dessous et ne comporte ni `passwordHash` ni `tokenHash` ;
 * - jamais de message d’erreur brut ni de variable d’environnement : un échec de
 *   requête peut contenir des détails de connexion, on ne les remonte pas ;
 * - l’objet retourné est sérialisable tel quel (nombres, chaînes, booléens, tableaux).
 */

/** Mesure pouvant rester indisponible (base injoignable, droits manquants…). */
export type SystemAccessUnavailable = "accounts" | "invitations";

/** Compte de l’instance, réduit aux champs utiles à une revue d’accès. */
export type SystemAccessAccount = {
  id: number;
  name: string | null;
  email: string | null;
  /** Valeur brute de `users.role` (énumération `role_admin_directeur`). */
  role: string;
  /** Horodatage ISO 8601, ou `null` si la colonne est vide. */
  lastSignedIn: string | null;
  createdAt: string | null;
};

/** Nombre de comptes ou d’invitations pour un rôle. */
export type SystemAccessRoleCount = { role: string; label: string; count: number };

export type SystemAccessInvitations = {
  /** Invitations au statut `pending`, tous rôles confondus. */
  total: number;
  byRole: SystemAccessRoleCount[];
};

/** Moyen d’accès ou de session, avec son état RÉEL. */
export type SystemAccessMean = {
  key: "password" | "mfa" | "sso" | "sessions";
  label: string;
  available: boolean;
  /** Ce qui est vrai aujourd’hui, y compris quand le moyen est indisponible. */
  detail: string;
};

export type SystemAccessPasswordPolicy = {
  minLength: number;
  maxLength: number;
  hashing: {
    algorithm: string;
    saltBytes: number;
    keyBytes: number;
    storedFormat: string;
    comparison: string;
    implementation: string;
  };
  /** `null` : aucune règle de complexité n’est appliquée (à dire, pas à cacher). */
  complexity: string | null;
  resetLinkTtlMinutes: number;
  protections: string[];
  /** Procédures qui imposent réellement ces règles. */
  enforcedBy: string[];
};

export type SystemAccess = {
  /** Horodatage serveur du relevé (ISO 8601). */
  generatedAt: string;
  /** Périmètre de lecture : le tenant courant, jamais la table entière. */
  scope: "tenant";
  accounts: SystemAccessAccount[];
  accountsTotal: number;
  roleCounts: SystemAccessRoleCount[];
  invitations: SystemAccessInvitations | null;
  accessMeans: SystemAccessMean[];
  passwordPolicy: SystemAccessPasswordPolicy;
  unavailable: SystemAccessUnavailable[];
};

/** Exécuteur de requêtes brutes — injectable pour tester la robustesse. */
export type RawQueryRunner = (query: SQL) => Promise<Record<string, unknown>[]>;

export type SystemAccessDeps = {
  /** Remplace l’accès à la base. Les tests peuvent le faire échouer. */
  runQuery?: RawQueryRunner;
  /** Horloge injectable. */
  now?: () => Date;
  /** Tenant lu. `undefined` = aucun périmètre lisible : on ne lit rien. */
  tenantId?: number;
};

/**
 * Politique de mot de passe RÉELLEMENT appliquée par le code.
 *
 * Chaque valeur est vérifiable dans les sources citées, et un test confronte ce
 * descripteur au code (`server/routers.ts`, `server/_core/password.ts`,
 * `server/db.ts`) : le descripteur ne peut pas dériver de ce qui est appliqué.
 */
export const PASSWORD_POLICY: SystemAccessPasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  hashing: {
    algorithm: "scrypt (module node:crypto, sans dépendance native)",
    saltBytes: 16,
    keyBytes: 64,
    storedFormat: "salt:hash, les deux en hexadécimal",
    comparison: "timingSafeEqual — comparaison à temps constant",
    implementation: "server/_core/password.ts",
  },
  // Aucune exigence de majuscule, de chiffre ou de caractère spécial n’existe
  // dans le code : le dire vaut mieux que laisser croire l’inverse.
  complexity: null,
  // Recopié depuis `PASSWORD_RESET_TTL_MS` (server/db.ts = 60 min) plutôt
  // qu’importé : ce module est chargé par le routeur, et plus de trente tests
  // remplacent `./db` par un double qui n’exposerait pas la constante — un
  // import ferait échouer leur chargement. Un test confronte la valeur au source.
  resetLinkTtlMinutes: 60,
  protections: [
    "Verrouillage progressif par compte et par IP après plusieurs échecs (server/_core/loginRateLimit.ts).",
    "Limitation de débit HTTP sur les routes d’authentification.",
    "Inscription libre fermée dès qu’un compte doté d’un mot de passe existe.",
    "Lien de réinitialisation à usage unique et à durée limitée.",
  ],
  enforcedBy: [
    "auth.register",
    "auth.changePassword",
    "auth.resetPassword",
    "users.create",
    "users.resetPassword",
    "acceptInvitation",
  ],
};

/**
 * Moyens d’accès et de session, à l’état réel du code.
 *
 * - Mot de passe local : disponible (c’est le seul chemin qui ouvre une session,
 *   voir `server/_core/context.ts`).
 * - MFA : non implémentée ; elle exige des colonnes qui n’existent pas encore en
 *   base — migration à appliquer par le propriétaire de la base (étape B).
 * - SSO : aucun fournisseur d’identité externe n’est câblé à la connexion ; le
 *   service OAuth historique n’est plus appelé pour authentifier une requête.
 * - Sessions : non listables et non révocables ; le jeton est un JWT autoporteur.
 */
export const ACCESS_MEANS: SystemAccessMean[] = [
  {
    key: "password",
    label: "Mot de passe local (e-mail)",
    available: true,
    detail: "Seul chemin d’authentification actif : mot de passe vérifié par scrypt, session signée en cookie.",
  },
  {
    key: "mfa",
    label: "MFA / TOTP",
    available: false,
    detail: "Non implémentée — migration requise (colonnes MFA absentes de la base).",
  },
  {
    key: "sso",
    label: "SSO / fournisseur d’identité externe",
    available: false,
    detail: "Aucun fournisseur externe n’ouvre de session : l’authentification de chaque requête repose sur le seul mot de passe local.",
  },
  {
    key: "sessions",
    label: "Sessions actives & révocation à distance",
    available: false,
    detail: "Non implémenté — migration requise (table des sessions absente). Les sessions en cours ne peuvent être ni listées ni révoquées.",
  },
];

/**
 * Les agrégats PostgreSQL (`count`) reviennent en `bigint`, que `postgres.js`
 * sérialise en chaîne : on convertit explicitement.
 */
function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asIsoString(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Libellé d’un rôle ; une valeur inconnue est affichée telle quelle, jamais masquée. */
function roleLabel(role: string): string {
  return (APP_ROLE_LABELS as Record<string, string | undefined>)[role] ?? `${role} (hors vocabulaire connu)`;
}

/**
 * Ordre d’affichage des rôles : le vocabulaire applicatif, puis toute valeur
 * rencontrée en base qui n’y figure pas — un rôle inédit doit se voir, pas
 * disparaître du décompte.
 */
function roleOrdering(seen: readonly string[]): string[] {
  const ordered: string[] = [...APP_ROLES];
  for (const role of seen) {
    if (!ordered.includes(role)) ordered.push(role);
  }
  return ordered;
}

function countByRole(rows: Array<{ role: string }>): SystemAccessRoleCount[] {
  return roleOrdering(rows.map(row => row.role)).map(role => ({
    role,
    label: roleLabel(role),
    count: rows.filter(row => row.role === role).length,
  }));
}

/** Ouvre le client une seule fois, puis sert les deux lectures. */
async function resolveRunQuery(deps: SystemAccessDeps): Promise<RawQueryRunner> {
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
 * Comptes du tenant courant : staff ET portail client.
 *
 * La liste des colonnes est volontairement écrite à la main — `passwordHash` ne
 * peut pas s’y glisser par inadvertance, contrairement à un `select *`. Le
 * filtre `"tenantId"` reproduit celui de `db.listUsers()` : les comptes sans
 * tenant (lignes héritées, sans session possible) restent hors périmètre, comme
 * partout ailleurs dans l’application.
 */
async function loadAccounts(runQuery: RawQueryRunner, tenantId: number): Promise<SystemAccessAccount[]> {
  const rows = await runQuery(sql`
    select id, name, email, role, "lastSignedIn", "createdAt"
    from users
    where "tenantId" = ${tenantId}
    order by coalesce(name, email, '') asc
  `);
  return rows.map(row => ({
    id: asNumber(row.id) ?? 0,
    name: asText(row.name),
    email: asText(row.email),
    role: typeof row.role === "string" ? row.role : String(row.role ?? ""),
    lastSignedIn: asIsoString(row.lastSignedIn),
    createdAt: asIsoString(row.createdAt),
  }));
}

/** Invitations en attente, agrégées par rôle ciblé — jamais par jeton. */
async function loadPendingInvitations(runQuery: RawQueryRunner, tenantId: number): Promise<SystemAccessInvitations> {
  const rows = await runQuery(sql`
    select role, count(*) as count
    from invitations
    where "tenantId" = ${tenantId} and status = 'pending'
    group by role
  `);
  const counts = rows.map(row => ({
    role: typeof row.role === "string" ? row.role : String(row.role ?? ""),
    count: asNumber(row.count) ?? 0,
  }));
  // Aucun jeton, aucune adresse : on ne remonte que des nombres par rôle.
  const byRole = roleOrdering(counts.map(row => row.role)).map(role => ({
    role,
    label: roleLabel(role),
    count: counts.find(row => row.role === role)?.count ?? 0,
  }));
  return { total: counts.reduce((sum, row) => sum + row.count, 0), byRole };
}

/**
 * Relève les accès de l’instance. Ne lève jamais : une base injoignable produit
 * un relevé partiel explicitement marqué, jamais des comptes inventés.
 */
export async function collectSystemAccess(deps: SystemAccessDeps = {}): Promise<SystemAccess> {
  const now = deps.now ?? (() => new Date());
  const tenantId = deps.tenantId ?? peekTenant();
  const unavailable: SystemAccessUnavailable[] = [];

  const base = {
    generatedAt: now().toISOString(),
    scope: "tenant" as const,
    accessMeans: ACCESS_MEANS,
    passwordPolicy: PASSWORD_POLICY,
  };

  if (tenantId === undefined) {
    // Sans tenant, on ne lit rien plutôt que de lire trop large.
    return {
      ...base,
      accounts: [],
      accountsTotal: 0,
      roleCounts: countByRole([]),
      invitations: null,
      unavailable: ["accounts", "invitations"],
    };
  }

  const runQuery = await resolveRunQuery(deps);

  let accounts: SystemAccessAccount[] = [];
  try {
    accounts = await loadAccounts(runQuery, tenantId);
  } catch {
    unavailable.push("accounts");
  }

  let invitations: SystemAccessInvitations | null = null;
  try {
    invitations = await loadPendingInvitations(runQuery, tenantId);
  } catch {
    unavailable.push("invitations");
  }

  return {
    ...base,
    accounts,
    accountsTotal: accounts.length,
    roleCounts: countByRole(accounts),
    // `null` quand le comptage a échoué : la console affiche « indisponible »
    // plutôt qu’un zéro qui laisserait croire à une absence d’invitation.
    invitations,
    unavailable,
  };
}
