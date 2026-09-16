import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEASURED_TABLES, collectSystemMetrics, type RawQueryRunner } from "./systemMetrics";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Module 2 — « Santé & supervision ». Ces tests ne sollicitent aucune base :
 * les mesures sont injectées, ce qui permet de prouver la robustesse (aucune
 * exception ne doit remonter) et l’absence de secret dans le relevé.
 */
const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

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
  return {
    user: null,
    tenantId: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

/** Horloge déterministe : +5 ms entre le début du ping et la fin de la mesure. */
function clockAdvancingBy5ms() {
  let ticks = 0;
  return () => new Date(1_757_923_200_000 + (ticks += 5));
}

/** Motifs qui ne doivent jamais apparaître dans un relevé transmis au client. */
const SENSITIVE_PATTERNS = [
  /DATABASE_URL/,
  /postgres:\/\//i,
  /password/i,
  /secret/i,
  /token/i,
  /stack/i,
  /node_modules/i,
  /permission denied/i,
];

/** Clés sensibles interdites, à toute profondeur de l’objet. */
const SENSITIVE_KEY = /password|secret|token|credential|databaseurl|connectionstring|stack|env$/i;

function collectKeys(input: unknown, keys: string[] = []): string[] {
  if (Array.isArray(input)) {
    for (const value of input) collectKeys(value, keys);
    return keys;
  }
  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      keys.push(key);
      collectKeys(value, keys);
    }
  }
  return keys;
}

describe("system.metrics — contrôle serveur de la console", () => {
  it("répond au rôle système avec un relevé réel, sérialisable et sans secret", async () => {
    const payload = await appRouter.createCaller(contextFor("systeme")).system.metrics();

    expect(Object.keys(payload).sort()).toEqual(["counts", "database", "generatedAt", "migration", "unavailable"]);
    expect(typeof payload.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(payload.generatedAt))).toBe(false);
    expect(typeof payload.database.reachable).toBe("boolean");
    expect(typeof payload.database.pool.limit).toBe("number");
    expect(Array.isArray(payload.database.tables)).toBe(true);
    expect(Array.isArray(payload.unavailable)).toBe(true);
    expect(Object.keys(payload.counts).sort()).toEqual(["accounts", "clients", "documents", "pendingInvitations"]);
    expect(Object.keys(payload.migration).sort()).toEqual(["appliedAt", "hash", "tracked"]);

    // Sérialisable sans perte : aucun objet non JSON n’est transmis.
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);

    const serialized = JSON.stringify(payload);
    for (const pattern of SENSITIVE_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
    for (const key of collectKeys(payload)) {
      expect(key).not.toMatch(SENSITIVE_KEY);
    }
    expect(serialized).not.toContain("staff-systeme");
  });

  it("répond aussi à l’admin (croisement explicite)", async () => {
    const payload = await appRouter.createCaller(contextFor("admin")).system.metrics();
    expect(typeof payload.database.reachable).toBe("boolean");
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("refuse les rôles non habilités en 403", async () => {
    for (const role of ["cadre", "directeur", "client"]) {
      await expect(appRouter.createCaller(contextFor(role)).system.metrics()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("refuse un visiteur non authentifié", async () => {
    await expect(appRouter.createCaller(anonymousContext()).system.metrics()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("Mesures système — robustesse et honnêteté", () => {
  const now = clockAdvancingBy5ms();

  it("ne lève pas quand la requête de santé elle-même échoue", async () => {
    const metrics = await collectSystemMetrics({
      ping: async () => {
        throw new Error("connect ETIMEDOUT 10.0.0.1:5432");
      },
      now,
    });

    expect(metrics.database.reachable).toBe(false);
    expect(metrics.database.latencyMs).toBeNull();
    expect(metrics.database.sizeBytes).toBeNull();
    expect(metrics.database.tables).toEqual([]);
    expect(metrics.database.pool.observedConnections).toBeNull();
    expect(metrics.counts).toEqual({ clients: null, documents: null, pendingInvitations: null, accounts: null });
    expect(metrics.migration).toEqual({ tracked: false, appliedAt: null, hash: null });
    expect(metrics.unavailable).toEqual([
      "observedConnections",
      "databaseSize",
      "tableSizes",
      "counts",
      "migration",
    ]);
    // L’erreur de connexion ne doit jamais être recopiée dans le relevé.
    expect(JSON.stringify(metrics)).not.toMatch(/ETIMEDOUT|10\.0\.0\.1|5432/);
  });

  it("ne lève pas quand une mesure échoue et la marque indisponible", async () => {
    const failingQuery: RawQueryRunner = async () => {
      throw new Error('permission denied for relation "clients"');
    };

    const metrics = await collectSystemMetrics({ ping: async () => true, runQuery: failingQuery, now });

    expect(metrics.database.reachable).toBe(true);
    // Latence mesurée côté serveur autour du ping : 5 ms avec l’horloge injectée.
    expect(metrics.database.latencyMs).toBe(5);
    expect(metrics.database.sizeBytes).toBeNull();
    expect(metrics.counts.clients).toBeNull();
    expect(metrics.unavailable).toHaveLength(5);
    expect(JSON.stringify(metrics)).not.toMatch(/permission denied|Error/);
  });

  it("extrait les mesures d’une réponse PostgreSQL typique (bigints en chaîne)", async () => {
    // `postgres.js` rend les `bigint` en chaîne : la conversion est du ressort du
    // serveur, sinon la console afficherait « 4096 » octets à la place de 4 Ko.
    const row = {
      relation: "drizzle.__drizzle_migrations",
      value: "12",
      bytes: "4096",
      name: "clients",
      clients: "7",
      documents: "23",
      pending_invitations: "2",
      accounts: "4",
      hash: "9f2c1a",
      created_at: "1757923200000",
    };
    const metrics = await collectSystemMetrics({
      ping: async () => true,
      runQuery: async () => [row],
      now,
      poolLimit: 20,
    });

    expect(metrics.database.reachable).toBe(true);
    expect(metrics.database.latencyMs).toBe(5);
    expect(metrics.database.pool).toEqual({ limit: 20, observedConnections: 12 });
    expect(metrics.database.sizeBytes).toBe(4096);
    expect(metrics.database.tables).toEqual([{ name: "clients", bytes: 4096 }]);
    expect(metrics.counts).toEqual({ clients: 7, documents: 23, pendingInvitations: 2, accounts: 4 });
    expect(metrics.migration).toEqual({
      tracked: true,
      appliedAt: "2025-09-15T08:00:00.000Z",
      hash: "9f2c1a",
    });
    expect(metrics.unavailable).toEqual([]);
  });

  it("n’invente aucune valeur quand la base ne renvoie aucune ligne", async () => {
    const metrics = await collectSystemMetrics({ ping: async () => true, runQuery: async () => [], now });

    expect(metrics.database.sizeBytes).toBeNull();
    expect(metrics.database.tables).toEqual([]);
    expect(metrics.counts).toEqual({ clients: null, documents: null, pendingInvitations: null, accounts: null });
    expect(metrics.migration).toEqual({ tracked: false, appliedAt: null, hash: null });
  });

  it("ne mesure que des tables déclarées par le schéma", () => {
    const schema = readSource("drizzle/schema.ts");
    for (const table of MEASURED_TABLES) {
      expect(schema).toContain(`"${table}"`);
    }
  });

  it("n’émet que des lectures : aucun DDL, aucune écriture", () => {
    // Preuve statique : toutes les requêtes du module commencent par `select`.
    const source = readSource("server/systemMetrics.ts");
    const bodies = [...source.matchAll(/sql`([\s\S]*?)`/g)].map(match => match[1].trim());
    // On écarte les fragments purement paramétriques (`${name}`) et les séparateurs.
    const statements = bodies.filter(body => !/^\$\{[^}]*\}$/.test(body) && body !== ",");

    expect(statements.length).toBeGreaterThanOrEqual(4);
    for (const statement of statements) {
      expect(statement.toLowerCase()).toMatch(/^select\b/);
      expect(statement.toLowerCase()).not.toMatch(/\b(insert|update|delete|create|alter|drop|truncate|grant|comment)\b/);
    }
  });
});
