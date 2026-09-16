import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SystemSessionsPanel,
  formatSessionDate,
  sessionAccountName,
  sessionStateBadge,
  sessionsVerdict,
  type ConsoleSessions,
} from "../client/src/components/SystemSessions";
import {
  CONSOLE_MODULES,
  ConsoleModuleRail,
  DELIVERED_CONSOLE_MODULES,
} from "../client/src/components/SystemConsoleDashboard";
import { appRouter } from "./routers";
import {
  SESSION_LIST_LIMIT,
  collectSystemSessions,
  describeSessionClient,
  resolveSessionState,
  revokeSessionById,
} from "./systemSessions";
import {
  SESSION_TOUCH_INTERVAL_MS,
  hashSessionToken,
  readSessionState,
  recordSession,
  resetSessionTouchCache,
  revokeSessionByToken,
} from "./sessionRegistry";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { createContext } from "./_core/context";
import { SESSION_TTL_MS, signLocalSession } from "./_core/localAuth";

/**
 * Phase 3 « Protéger », étape B1 — sessions révocables.
 *
 * Ce fichier couvre les deux impératifs de l’étape, qui vont dans des directions
 * opposées et doivent donc être prouvés séparément :
 *
 *  DISPONIBILITÉ — `auth.login` ne doit JAMAIS échouer à cause du registre de
 *  sessions. L’application est en production, la table vient d’être créée : une
 *  table absente, des droits d’écriture manquants ou une base injoignable ne
 *  doivent pas empêcher quiconque de se connecter.
 *
 *  SÉCURITÉ — une session révoquée doit être REFUSÉE à la requête suivante. Il
 *  ne suffit pas d’écrire `revokedAt` en base : le refus est vérifié de bout en
 *  bout, en passant par `createContext` (le point de passage obligé de toute
 *  requête tRPC).
 */

const mocks = vi.hoisted(() => {
  // `vi.hoisted` s’exécute avant le chargement des modules : c’est le seul
  // moment où l’on peut fournir un JWT_SECRET avant que `_core/env.ts` ne le lise.
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    /** Requête SQL reçue par `db.execute`, pilotée test par test. */
    execute: vi.fn(),
    getDb: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByOpenId: vi.fn(),
    upsertUser: vi.fn(async () => undefined),
    verifyPassword: vi.fn(async (plain: string, stored: string) => stored === `hash:${plain}`),
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
  };
});

vi.mock("./db", () => mocks);
vi.mock("./_core/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

/** Texte SQL final et paramètres liés, pour inspecter ce qui part réellement en base. */
function sqlOf(query: SQL) {
  return new PgDialect().sqlToQuery(query);
}

/**
 * Une lecture, ou une écriture ? Le gabarit `sql` conserve ses retraits, donc le
 * texte commence par un saut de ligne : on normalise avant de regarder.
 */
function isSelect(query: SQL): boolean {
  return sqlOf(query).sql.trimStart().startsWith("select");
}

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

function ctxFor(user: TrpcContext["user"], cookie?: string): TrpcContext {
  return {
    user,
    tenantId: 1,
    req: { headers: cookie ? { cookie } : {}, ip: "41.66.1.9", socket: { remoteAddress: "41.66.1.9" }, protocol: "https" } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function staffContext(role: string, cookie?: string): TrpcContext {
  return ctxFor(
    {
      id: 7,
      openId: `staff-${role}`,
      name: `Compte ${role}`,
      email: `${role}@lucepres.gn`,
      loginMethod: "email",
      role,
      createdAt: new Date("2026-01-05T08:00:00.000Z"),
      updatedAt: new Date("2026-01-05T08:00:00.000Z"),
      lastSignedIn: new Date("2026-09-16T06:00:00.000Z"),
    },
    cookie,
  );
}

function anonymousContext(): TrpcContext {
  return { user: null, tenantId: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const FUTURE = new Date("2027-09-16T06:00:00.000Z");
const PAST = new Date("2026-01-01T00:00:00.000Z");

/** Chemin de toutes les clés d’une structure, pour épingler la forme d’une réponse. */
function collectKeys(value: unknown, prefix = "", acc = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach(entry => collectKeys(entry, prefix, acc));
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      acc.add(path);
      collectKeys(entry, path, acc);
    }
  }
  return acc;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionTouchCache();
  mocks.execute.mockResolvedValue([]);
  mocks.getDb.mockResolvedValue({ execute: mocks.execute });
});

/* ------------------------------------------------------------------ */
/* 1. Enregistrement de la session à la connexion                      */
/* ------------------------------------------------------------------ */

describe("Registre de sessions — enregistrement à la connexion", () => {
  const compte = {
    id: 4,
    openId: "local_dg",
    email: "dg@lucepres.gn",
    name: "Directrice Générale",
    passwordHash: "hash:bon-mot-de-passe",
    role: "admin",
    tenantId: 1,
  };

  it("délivre la session MÊME SI l’enregistrement échoue (table absente)", async () => {
    mocks.getUserByEmail.mockResolvedValue(compte);
    mocks.execute.mockRejectedValue(new Error('relation "sessions" does not exist'));
    const cookieCalls: Array<Record<string, unknown>> = [];
    const ctx = staffContext("admin");
    (ctx.res as { cookie: unknown }).cookie = (...args: unknown[]) => cookieCalls.push({ args });

    const result = await appRouter
      .createCaller(ctx)
      .auth.login({ email: "dg@lucepres.gn", password: "bon-mot-de-passe" });

    // Impératif de disponibilité : la connexion aboutit et le cookie est posé.
    expect(result).toEqual({ success: true });
    expect(cookieCalls).toHaveLength(1);
    // L’échec a bien été rencontré puis absorbé — pas contourné.
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const texte = sqlOf(mocks.execute.mock.calls[0][0] as SQL).sql;
    expect(texte).toContain("insert into sessions");
  });

  it("délivre la session même si la base n’est pas configurée (getDb → null)", async () => {
    mocks.getUserByEmail.mockResolvedValue(compte);
    mocks.getDb.mockResolvedValue(null);

    await expect(
      appRouter.createCaller(staffContext("admin")).auth.login({ email: "dg@lucepres.gn", password: "bon-mot-de-passe" }),
    ).resolves.toEqual({ success: true });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("enregistre l’EMPREINTE du jeton, jamais le jeton", async () => {
    mocks.getUserByEmail.mockResolvedValue(compte);
    const cookieCalls: string[] = [];
    const ctx = staffContext("admin");
    (ctx.res as { cookie: unknown }).cookie = (...args: unknown[]) => cookieCalls.push(String(args[1]));

    await appRouter.createCaller(ctx).auth.login({ email: "dg@lucepres.gn", password: "bon-mot-de-passe" });

    const jeton = cookieCalls[0];
    expect(jeton).toBeTruthy();

    const insert = mocks.execute.mock.calls[0][0] as SQL;
    const { sql: texte, params } = sqlOf(insert);
    expect(texte).toContain("insert into sessions");
    // Le jeton en clair ne figure NI dans la requête, NI dans les paramètres liés.
    expect(texte).not.toContain(jeton);
    expect(params).not.toContain(jeton);
    expect(params).toContain(hashSessionToken(jeton));
  });

  it("aligne l’échéance de la ligne sur la durée de vie réelle du jeton", async () => {
    const avant = Date.now();
    const result = await recordSession({ userId: 4, tenantId: 1, token: "jeton-de-test" });
    const apres = Date.now();

    expect(result.ok).toBe(true);
    const { params } = sqlOf(mocks.execute.mock.calls[0][0] as SQL);
    const expiresAt = params.find(value => value instanceof Date) as Date;
    expect(expiresAt).toBeInstanceOf(Date);
    // Une seule constante gouverne le cookie, le JWT et la ligne `sessions`.
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(avant + SESSION_TTL_MS - 1_000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(apres + SESSION_TTL_MS + 1_000);
  });

  it("ne lève jamais, quelle que soit la panne, et rend compte de l’échec", async () => {
    mocks.execute.mockRejectedValue(new Error("permission denied for table sessions"));
    await expect(recordSession({ userId: 1, tenantId: 1, token: "j" })).resolves.toMatchObject({ ok: false });

    mocks.getDb.mockRejectedValue(new Error("pool épuisé"));
    await expect(recordSession({ userId: 1, tenantId: 1, token: "j" })).resolves.toMatchObject({ ok: false });

    mocks.getDb.mockResolvedValue(null);
    const result = await recordSession({ userId: 1, tenantId: 1, token: "j" });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("indisponible");
  });

  it("révoque la session à la déconnexion, sans jamais faire échouer la déconnexion", async () => {
    const token = "jeton-de-session";
    const ctx = staffContext("cadre", `${COOKIE_NAME}=${token}`);
    const cleared: string[] = [];
    (ctx.res as { clearCookie: unknown }).clearCookie = (name: string) => cleared.push(name);

    await appRouter.createCaller(ctx).auth.logout();
    const update = sqlOf(mocks.execute.mock.calls[0][0] as SQL);
    expect(update.sql).toContain('set "revokedAt" = now()');
    expect(update.params).toContain(hashSessionToken(token));
    expect(update.params).not.toContain(token);
    expect(cleared).toEqual([COOKIE_NAME]);

    // Deuxième appel : la base refuse. La déconnexion reste un succès côté client.
    mocks.execute.mockRejectedValue(new Error("base injoignable"));
    await expect(appRouter.createCaller(ctx).auth.logout()).resolves.toEqual({ success: true, redirectTo: "/login" });
  });

  it("ne touche à aucune session quand aucun cookie n’est présenté", async () => {
    await appRouter.createCaller(staffContext("cadre")).auth.logout();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* 2. La révocation invalide réellement la session                     */
/* ------------------------------------------------------------------ */

describe("Contrôle de révocation — placement dans le cycle d’authentification", () => {
  function compteResolu() {
    return {
      id: 4,
      openId: "local_dg",
      email: "dg@lucepres.gn",
      name: "Directrice Générale",
      role: "admin",
      tenantId: 1,
      loginMethod: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }

  async function cookieDeSession() {
    const token = await signLocalSession({ openId: "local_dg", email: "dg@lucepres.gn", name: "DG", tenantId: 1 });
    return { token, cookie: `${COOKIE_NAME}=${token}` };
  }

  it("REFUSE la requête suivante quand la session a été révoquée", async () => {
    const { cookie, token } = await cookieDeSession();
    mocks.getUserByOpenId.mockResolvedValue(compteResolu());
    // La base répond : la ligne existe et porte un `revokedAt`.
    mocks.execute.mockResolvedValue([{ revokedAt: new Date("2026-09-16T06:30:00.000Z"), expiresAt: FUTURE }]);

    const ctx = await createContext({ req: { headers: { cookie } }, res: {} } as never);

    expect(ctx.user).toBeNull();
    // Rien n’est dérivé d’une session révoquée — pas même le tenant.
    expect(ctx.tenantId).toBeNull();
    // La ligne visée est bien celle du jeton présenté.
    expect(sqlOf(mocks.execute.mock.calls[0][0] as SQL).params).toContain(hashSessionToken(token));

    // Et la conséquence visible : la procédure protégée refuse.
    await expect(appRouter.createCaller(ctx).auth.me()).resolves.toBeNull();
    await expect(appRouter.createCaller(ctx).system.sessions.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("laisse passer la session non révoquée", async () => {
    const { cookie } = await cookieDeSession();
    mocks.getUserByOpenId.mockResolvedValue(compteResolu());
    mocks.execute.mockResolvedValue([{ revokedAt: null, expiresAt: FUTURE }]);

    const ctx = await createContext({ req: { headers: { cookie } }, res: {} } as never);

    expect(ctx.user).toMatchObject({ openId: "local_dg", role: "admin" });
    expect(ctx.tenantId).toBe(1);
  });

  it("laisse passer une session ANTÉRIEURE au registre (aucune ligne)", async () => {
    // Les sessions ouvertes avant la mise en place de la table n’ont pas de ligne.
    // Les refuser déconnecterait tout le monde au déploiement de l’étape B1.
    const { cookie } = await cookieDeSession();
    mocks.getUserByOpenId.mockResolvedValue(compteResolu());
    mocks.execute.mockResolvedValue([]);

    const ctx = await createContext({ req: { headers: { cookie } }, res: {} } as never);
    expect(ctx.user).toMatchObject({ openId: "local_dg" });
  });

  it("ne se transforme pas en panne d’authentification : panne de lecture = session ouverte", async () => {
    const { cookie } = await cookieDeSession();
    mocks.getUserByOpenId.mockResolvedValue(compteResolu());
    mocks.execute.mockRejectedValue(new Error('relation "sessions" does not exist'));

    const ctx = await createContext({ req: { headers: { cookie } }, res: {} } as never);
    expect(ctx.user).toMatchObject({ openId: "local_dg" });
  });

  it("consulte le registre pour CHAQUE requête authentifiée (aucun cache différé)", async () => {
    const { cookie } = await cookieDeSession();
    mocks.getUserByOpenId.mockResolvedValue(compteResolu());
    mocks.execute.mockResolvedValue([{ revokedAt: null, expiresAt: FUTURE }]);

    await createContext({ req: { headers: { cookie } }, res: {} } as never);
    const apresUne = mocks.execute.mock.calls.length;
    await createContext({ req: { headers: { cookie } }, res: {} } as never);

    // Un cache en mémoire aurait laissé le compteur inchangé : la révocation
    // serait alors appliquée avec du retard, ce que l’étape interdit.
    expect(mocks.execute.mock.calls.length).toBeGreaterThan(apresUne);
  });

  it("ne lit RIEN quand aucun jeton n’est présenté", async () => {
    const ctx = await createContext({ req: { headers: {} }, res: {} } as never);
    expect(ctx.user).toBeNull();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.getUserByOpenId).not.toHaveBeenCalled();
  });

  it("décrit le coût : une lecture d’index, menée en parallèle de la lecture du compte", () => {
    const context = readSource("server/_core/context.ts");
    // Le contrôle est bien dans le contexte, pas dans un middleware optionnel.
    expect(context).toContain("readSessionState(token)");
    expect(context).toContain("Promise.all([");
    expect(context).toContain("state.revoked");
    // Et il ne coûte pas une requête supplémentaire en série.
    expect(context).not.toMatch(/await readSessionState\(token\)/);
  });
});

describe("readSessionState — robustesse et empreinte", () => {
  it("n’expose jamais le jeton dans la requête", async () => {
    mocks.execute.mockResolvedValue([]);
    await readSessionState("jeton-secret-de-test");
    const { sql: texte, params } = sqlOf(mocks.execute.mock.calls[0][0] as SQL);
    expect(texte).toContain('from sessions');
    expect(texte).not.toContain("jeton-secret-de-test");
    expect(params).toEqual([hashSessionToken("jeton-secret-de-test")]);
  });

  it("rend un verdict explicite et stable", async () => {
    mocks.execute.mockResolvedValue([{ revokedAt: new Date(), expiresAt: FUTURE }]);
    await expect(readSessionState("j")).resolves.toMatchObject({ known: true, revoked: true });

    mocks.execute.mockResolvedValue([{ revokedAt: null, expiresAt: FUTURE }]);
    await expect(readSessionState("j")).resolves.toMatchObject({ known: true, revoked: false });

    mocks.execute.mockResolvedValue([]);
    await expect(readSessionState("j")).resolves.toMatchObject({ known: false, revoked: false });

    mocks.execute.mockRejectedValue(new Error("n’importe quoi"));
    await expect(readSessionState("j")).resolves.toMatchObject({ known: false, revoked: false });
  });

  it("calcule une empreinte stable, hexadécimale et non réversible", () => {
    const empreinte = hashSessionToken("jeton");
    expect(empreinte).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken("jeton")).toBe(empreinte);
    expect(hashSessionToken("jeton2")).not.toBe(empreinte);
    expect(empreinte).not.toContain("jeton");
  });

  it("ne rafraîchit pas `lastSeenAt` à chaque requête", () => {
    // Le rafraîchissement existe, mais il est borné dans le temps : sans cette
    // borne, chaque requête authentifiée écrirait en base.
    const registre = readSource("server/sessionRegistry.ts");
    expect(SESSION_TOUCH_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(registre).toContain("SESSION_TOUCH_INTERVAL_MS");
    expect(registre).toContain('set "lastSeenAt" = now()');
  });

  it("révoque par empreinte, jamais par jeton en clair", async () => {
    mocks.execute.mockResolvedValue([]);
    const result = await revokeSessionByToken("jeton-a-revoquer");
    expect(result.ok).toBe(true);
    const { sql: texte, params } = sqlOf(mocks.execute.mock.calls[0][0] as SQL);
    expect(texte).toContain('"revokedAt" = now()');
    expect(texte).not.toContain("jeton-a-revoquer");
    expect(params).toContain(hashSessionToken("jeton-a-revoquer"));
  });
});

/* ------------------------------------------------------------------ */
/* 3. Le relevé de la console                                          */
/* ------------------------------------------------------------------ */

const DECOY = "empreinte-qui-ne-doit-pas-sortir";

function ligneSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    userId: 4,
    createdAt: new Date("2026-09-16T06:00:00.000Z"),
    lastSeenAt: new Date("2026-09-16T07:25:00.000Z"),
    expiresAt: FUTURE,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
    ip: "41.66.1.9",
    revokedAt: null,
    isCurrent: false,
    accountName: "Aïssatou Bah",
    accountEmail: "a.bah@lucepres.gn",
    accountRole: "admin",
    // Colonne de trop, volontairement présente : le mappage est EXPLICITE, il ne
    // recopie pas la ligne. Une empreinte qui traînerait ici ne doit pas sortir.
    tokenHash: DECOY,
    ...overrides,
  };
}

/** Exécuteur simulé : répond à la requête de liste puis à celle des totaux. */
function runnerAvec(liste: Array<Record<string, unknown>>, totaux?: Record<string, unknown>) {
  return vi.fn(async (query: SQL) => {
    const { sql: texte } = sqlOf(query);
    if (texte.includes("count(*)")) {
      const actives = liste.filter(l => !l.revokedAt && (l.expiresAt as Date).getTime() > Date.now()).length;
      return [
        totaux ?? {
          total: String(liste.length),
          active: String(actives),
          revoked: String(liste.filter(l => l.revokedAt).length),
          expired: String(liste.length - actives - liste.filter(l => l.revokedAt).length),
        },
      ];
    }
    return liste;
  });
}

describe("systemSessions — relevé de l’instance", () => {
  it("remonte les sessions avec le compte, les dates, l’agent, l’IP et l’état", async () => {
    const runQuery = runnerAvec([
      ligneSession({ id: 3, isCurrent: true }),
      ligneSession({ id: 2, revokedAt: new Date("2026-09-16T07:00:00.000Z") }),
      ligneSession({ id: 1, expiresAt: PAST, createdAt: PAST, lastSeenAt: PAST }),
    ]);

    const relevé = await collectSystemSessions({ runQuery, tenantId: 1, currentTokenHash: "empreinte-courante" });

    expect(relevé.unavailable).toBe(false);
    expect(relevé.scope).toBe("tenant");
    expect(relevé.limit).toBe(SESSION_LIST_LIMIT);
    expect(relevé.sessions).toHaveLength(3);
    expect(relevé.sessions[0]).toMatchObject({
      id: 3,
      userId: 4,
      accountName: "Aïssatou Bah",
      accountEmail: "a.bah@lucepres.gn",
      accountRoleLabel: "Admin",
      ip: "41.66.1.9",
      clientLabel: "Chrome · Windows",
      state: "active",
      current: true,
    });
    expect(relevé.sessions[1].state).toBe("revoked");
    expect(relevé.sessions[2].state).toBe("expired");
    expect(relevé.sessions[0].createdAt).toBe("2026-09-16T06:00:00.000Z");
    expect(relevé.sessions[0].expiresAt).toBe(FUTURE.toISOString());
  });

  it("ne laisse sortir NI jeton NI empreinte", async () => {
    const runQuery = runnerAvec([ligneSession({ isCurrent: true })]);
    const relevé = await collectSystemSessions({ runQuery, tenantId: 1, currentTokenHash: "empreinte-courante" });

    const serialise = JSON.stringify(relevé);
    expect(serialise).not.toContain(DECOY);
    expect(serialise).not.toContain("empreinte-courante");
    expect(serialise).not.toMatch(/"tokenHash"/);
    expect(serialise).not.toMatch(/"token"/);

    // Épinglage de la forme : aucune clé inattendue ne peut apparaître en silence.
    expect([...collectKeys(relevé.sessions)].sort()).toEqual(
      [
        "accountEmail",
        "accountName",
        "accountRoleLabel",
        "clientLabel",
        "createdAt",
        "current",
        "expiresAt",
        "id",
        "ip",
        "lastSeenAt",
        "state",
        "userAgent",
        "userId",
      ].sort(),
    );
  });

  it("fait calculer la session courante PAR LA BASE, par comparaison d’empreinte", async () => {
    const runQuery = runnerAvec([ligneSession()]);
    await collectSystemSessions({ runQuery, tenantId: 1, currentTokenHash: "empreinte-courante" });

    const { sql: texte, params } = sqlOf(runQuery.mock.calls[0][0] as SQL);
    expect(texte).toContain('(s."tokenHash" = $');
    expect(params).toContain("empreinte-courante");
    // L’empreinte est comparée en base, elle n’est pas projetée en colonne.
    expect(texte).not.toMatch(/select[^;]*s\."tokenHash"\s*,/);
  });

  it("cloisonne par tenant", async () => {
    const runQuery = runnerAvec([ligneSession()]);
    await collectSystemSessions({ runQuery, tenantId: 42, currentTokenHash: null });

    const { sql: texte, params } = sqlOf(runQuery.mock.calls[0][0] as SQL);
    expect(texte).toContain('s."tenantId" = $');
    expect(params).toContain(42);
  });

  it("signale une table illisible au lieu d’annoncer « aucune session »", async () => {
    const runQuery = vi.fn(async () => {
      throw new Error('relation "sessions" does not exist');
    });
    const relevé = await collectSystemSessions({ runQuery, tenantId: 1 });

    expect(relevé.unavailable).toBe(true);
    expect(relevé.sessions).toEqual([]);
    expect(relevé.totals.total).toBe(0);
    expect(relevé.generatedAt).toBeTruthy();
    // Aucun message d’erreur brut n’est remonté (il peut contenir des détails de
    // connexion) : le drapeau `unavailable` suffit à la console.
    expect(JSON.stringify(relevé)).not.toContain("relation");
  });

  it("ne lit rien sans tenant plutôt que de lire trop large", async () => {
    const runQuery = runnerAvec([ligneSession()]);
    const relevé = await collectSystemSessions({ runQuery, tenantId: undefined });
    expect(relevé.unavailable).toBe(true);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("rend compte des lignes non affichées quand la liste est bornée", async () => {
    const runQuery = runnerAvec(
      [ligneSession({ id: 1 })],
      { total: "250", active: "240", revoked: "5", expired: "5" },
    );
    const relevé = await collectSystemSessions({ runQuery, tenantId: 1 });
    expect(relevé.sessions).toHaveLength(1);
    expect(relevé.totals.total).toBe(250);
    expect(relevé.omitted).toBe(249);
  });

  it("rend la règle d’état testable seule, sans base", () => {
    const maintenant = new Date("2026-09-16T08:00:00.000Z");
    // Une session révoquée le reste, même après son échéance : l’administrateur
    // doit continuer de voir que l’accès a été fermé.
    expect(resolveSessionState({ revokedAt: new Date("2026-09-01T00:00:00.000Z"), expiresAt: PAST }, maintenant)).toBe("revoked");
    expect(resolveSessionState({ revokedAt: null, expiresAt: PAST }, maintenant)).toBe("expired");
    expect(resolveSessionState({ revokedAt: null, expiresAt: FUTURE }, maintenant)).toBe("active");
  });

  it("résume l’en-tête d’agent sans jamais l’inventer", () => {
    expect(describeSessionClient(null)).toBe("Agent non communiqué");
    expect(describeSessionClient("   ")).toBe("Agent non communiqué");
    expect(describeSessionClient("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe("Chrome · Windows");
    expect(describeSessionClient("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605")).toBe("Safari · macOS");
    expect(describeSessionClient("curl/8.4.0")).toBe("curl");
    // Inconnu : on montre ce qui a été reçu, on n’invente pas un navigateur.
    const inconnu = describeSessionClient("Zorglub/1.0 (machine bizarre)");
    expect(inconnu).toContain("Zorglub");
  });
});

/* ------------------------------------------------------------------ */
/* 4. Révocation : garde-fou d’auto-révocation et idempotence          */
/* ------------------------------------------------------------------ */

describe("revokeSessionById — garde-fou et idempotence", () => {
  function runnerLecture(ligne: Record<string, unknown> | undefined) {
    return vi.fn(async (query: SQL) => {
      if (isSelect(query)) return ligne ? [ligne] : [];
      return [{ revokedAt: new Date("2026-09-16T08:00:00.000Z") }];
    });
  }

  it("REFUSE de révoquer la session qui porte la requête", async () => {
    const empreinteCourante = hashSessionToken("jeton-courant");
    const runQuery = runnerLecture({ id: 5, userId: 4, revokedAt: null, tokenHash: empreinteCourante });

    const result = await revokeSessionById({ id: 5, tenantId: 1, actingTokenHash: empreinteCourante, runQuery });

    expect(result).toEqual({ outcome: "self", id: 5 });
    // Aucune écriture n’a été tentée : le refus est total.
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  it("révoque la session d’un AUTRE compte", async () => {
    const runQuery = runnerLecture({ id: 9, userId: 12, revokedAt: null, tokenHash: "empreinte-d-un-autre" });
    const result = await revokeSessionById({
      id: 9,
      tenantId: 1,
      actingTokenHash: hashSessionToken("jeton-courant"),
      runQuery,
    });

    expect(result).toMatchObject({ outcome: "revoked", id: 9, userId: 12 });
    const update = sqlOf(runQuery.mock.calls[1][0] as SQL);
    expect(update.sql).toContain('set "revokedAt" = now()');
    expect(update.sql).toContain('"revokedAt" is null');
  });

  it("reste idempotente : révoquer une session déjà fermée n’est pas une erreur", async () => {
    const runQuery = runnerLecture({ id: 5, userId: 4, revokedAt: new Date(), tokenHash: "peu-importe" });
    await expect(revokeSessionById({ id: 5, tenantId: 1, actingTokenHash: null, runQuery })).resolves.toMatchObject({
      outcome: "already_revoked",
      id: 5,
      userId: 4,
    });
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  it("distingue une session inconnue d’une session révoquée", async () => {
    const runQuery = runnerLecture(undefined);
    await expect(revokeSessionById({ id: 4242, tenantId: 1, actingTokenHash: null, runQuery })).resolves.toEqual({
      outcome: "not_found",
    });
  });

  it("ne traverse jamais un autre tenant", async () => {
    const runQuery = runnerLecture({ id: 5, userId: 4, revokedAt: null, tokenHash: "x" });
    await revokeSessionById({ id: 5, tenantId: 7, actingTokenHash: null, runQuery });
    const lecture = sqlOf(runQuery.mock.calls[0][0] as SQL);
    expect(lecture.sql).toContain('"tenantId" = $');
    expect(lecture.params).toContain(7);
  });

  it("rend un échec technique explicite plutôt qu’un faux succès", async () => {
    const runQuery = vi.fn(async () => {
      throw new Error("base injoignable");
    });
    const result = await revokeSessionById({ id: 5, tenantId: 1, actingTokenHash: null, runQuery });
    expect(result.outcome).toBe("unavailable");
    await expect(
      revokeSessionById({ id: 5, tenantId: undefined, actingTokenHash: null, runQuery: vi.fn() }),
    ).resolves.toMatchObject({ outcome: "unavailable" });
  });
});

/* ------------------------------------------------------------------ */
/* 5. Procédures : contrôle d’accès serveur                            */
/* ------------------------------------------------------------------ */

describe("system.sessions — contrôle serveur", () => {
  it("répond au seul rôle système", async () => {
    // RETOURNÉ — la liste répondait au couple `systeme` + `admin`.
    const payload = await appRouter.createCaller(staffContext("systeme")).system.sessions.list();
    expect(Object.keys(payload).sort()).toEqual([
      "generatedAt",
      "limit",
      "omitted",
      "scope",
      "sessions",
      "totals",
      "unavailable",
    ]);
    expect(payload.scope).toBe("tenant");
    expect(payload.generatedAt).toBeTruthy();
    expect(payload.sessions).toEqual([]);
    expect(payload.totals).toEqual({ total: 0, active: 0, revoked: 0, expired: 0 });
    // Base simulée JOIGNABLE et table vide : le relevé est disponible, et il
    // annonce zéro session — ce n’est pas la même chose qu’un relevé impossible.
    expect(payload.unavailable).toBe(false);
  });

  it("refuse l’admin désormais, en lecture comme en révocation", async () => {
    const admin = appRouter.createCaller(staffContext("admin"));
    await expect(admin.system.sessions.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.system.sessions.revoke({ id: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("signale l’indisponibilité quand la base n’est pas joignable", async () => {
    mocks.getDb.mockResolvedValue(null);
    const payload = await appRouter.createCaller(staffContext("systeme")).system.sessions.list();
    expect(payload.unavailable).toBe(true);
    expect(payload.sessions).toEqual([]);
  });

  it("refuse les autres rôles en 403, y compris le portail client", async () => {
    for (const role of ["cadre", "directeur", "client"]) {
      await expect(appRouter.createCaller(staffContext(role)).system.sessions.list()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("refuse un visiteur non authentifié", async () => {
    await expect(appRouter.createCaller(anonymousContext()).system.sessions.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(appRouter.createCaller(anonymousContext()).system.sessions.revoke({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("n’expose aucun jeton ni empreinte dans la charge utile de la procédure", async () => {
    const payload = await appRouter.createCaller(staffContext("systeme")).system.sessions.list();
    const serialise = JSON.stringify(payload);
    expect(serialise).not.toMatch(/token/i);
    expect(serialise).not.toMatch(/hash/i);
    expect(serialise).not.toMatch(/jwt|bearer|cookie/i);
  });

  it("traduit le refus d’auto-révocation en erreur explicite, sans révoquer", async () => {
    const token = await signLocalSession({ openId: "local_dg", email: "dg@lucepres.gn", name: "DG", tenantId: 1 });
    const ctx = staffContext("systeme", `${COOKIE_NAME}=${token}`);
    mocks.execute.mockImplementation(async (query: SQL) => {
      if (isSelect(query)) {
        return [{ id: 5, userId: 7, revokedAt: null, tokenHash: hashSessionToken(token) }];
      }
      return [];
    });

    await expect(appRouter.createCaller(ctx).system.sessions.revoke({ id: 5 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Le message doit dire quoi faire, pas seulement refuser.
    const message = await appRouter
      .createCaller(ctx)
      .system.sessions.revoke({ id: 5 })
      .catch((error: Error) => error.message);
    expect(message).toContain("Déconnexion");
  });

  it("révoque une autre session et journalise l’action côté serveur", async () => {
    const token = await signLocalSession({ openId: "local_dg", email: "dg@lucepres.gn", name: "DG", tenantId: 1 });
    const ctx = staffContext("systeme", `${COOKIE_NAME}=${token}`);
    const journal = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.execute.mockImplementation(async (query: SQL) => {
      if (isSelect(query)) return [{ id: 8, userId: 12, revokedAt: null, tokenHash: "empreinte-autre" }];
      return [{ revokedAt: new Date("2026-09-16T08:00:00.000Z") }];
    });

    const result = await appRouter.createCaller(ctx).system.sessions.revoke({ id: 8 });
    expect(result).toMatchObject({ success: true, id: 8, userId: 12, alreadyRevoked: false });
    expect(result.revokedAt).toBe("2026-09-16T08:00:00.000Z");

    // Journalisation : la ligne nomme l’acteur, la cible et le tenant, jamais un jeton.
    const ligne = journal.mock.calls.map(call => String(call[0])).join("\n");
    expect(ligne).toContain("session révoquée");
    expect(ligne).toContain("session=8");
    expect(ligne).toContain("compte=12");
    expect(ligne).not.toContain(token);
    expect(ligne).not.toContain("empreinte-autre");
    journal.mockRestore();
  });

  it("annonce NOT_FOUND sur une session inconnue du tenant", async () => {
    mocks.execute.mockResolvedValue([]);
    await expect(
      appRouter.createCaller(staffContext("systeme")).system.sessions.revoke({ id: 4242 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuse une révocation quand la base ne répond pas, sans prétendre avoir agi", async () => {
    mocks.execute.mockRejectedValue(new Error("base injoignable"));
    await expect(
      appRouter.createCaller(staffContext("systeme")).system.sessions.revoke({ id: 3 }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

/* ------------------------------------------------------------------ */
/* 6. Écran : rendu statique                                           */
/* ------------------------------------------------------------------ */

function sessionsFixture(overrides: Partial<ConsoleSessions> = {}): ConsoleSessions {
  const base = {
    accountName: "Aïssatou Bah",
    accountEmail: "a.bah@lucepres.gn",
    accountRoleLabel: "Admin",
    createdAt: "2026-09-16T06:00:00.000Z",
    lastSeenAt: "2026-09-16T07:25:00.000Z",
    expiresAt: "2027-09-16T06:00:00.000Z",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120",
    clientLabel: "Chrome · Windows",
    ip: "41.66.1.9",
  };
  return {
    generatedAt: "2026-09-16T07:30:00.000Z",
    scope: "tenant",
    sessions: [
      { ...base, id: 1, userId: 4, state: "active", current: true },
      { ...base, id: 2, userId: 12, accountName: "Mamadou Diallo", accountEmail: "m.diallo@lucepres.gn", accountRoleLabel: "Cadre", state: "active", current: false },
      { ...base, id: 3, userId: 13, state: "revoked", current: false },
      { ...base, id: 4, userId: 14, state: "expired", current: false },
    ],
    totals: { total: 4, active: 2, revoked: 1, expired: 1 },
    omitted: 0,
    limit: SESSION_LIST_LIMIT,
    unavailable: false,
    ...overrides,
  };
}

describe("Écran « Sessions actives » — rendu", () => {
  it("affiche les sessions, leur état et leur agent", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSessionsPanel, {
        sessions: sessionsFixture(),
        failed: false,
        isLoading: false,
        revokingId: null,
        notice: null,
        onRevoke: () => undefined,
      }),
    );

    expect(html).toContain("Sessions actives");
    expect(html).toContain("Aïssatou Bah");
    expect(html).toContain("m.diallo@lucepres.gn");
    expect(html).toContain("Chrome · Windows");
    expect(html).toContain("41.66.1.9");
    expect(html).toContain("Active");
    expect(html).toContain("Révoquée");
    expect(html).toContain("Expirée");
    expect(html).toContain("Révocation immédiate");
    expect(html).toContain('data-testid="session-row-1"');
    expect(html).toContain('data-session-state="revoked"');
    // Les compteurs viennent du relevé, pas d’un calcul d’écran.
    expect(html).toContain("Total enregistré");
    expect(html).toContain("Révoquées");
    expect(html).toContain("Expirées");
  });

  it("protège la session courante : aucune action de révocation sur SA ligne", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSessionsPanel, {
        sessions: sessionsFixture(),
        failed: false,
        isLoading: false,
        revokingId: null,
        notice: null,
        onRevoke: () => undefined,
      }),
    );

    // La session courante est nommée, et son bouton n’existe pas.
    expect(html).toContain("Session courante");
    expect(html).not.toContain('data-testid="revoke-session-1"');
    // Les autres sessions actives restent révocables.
    expect(html).toContain('data-testid="revoke-session-2"');
    // Une session déjà fermée ou expirée n’offre pas de bouton inutile.
    expect(html).not.toContain('data-testid="revoke-session-3"');
    expect(html).not.toContain('data-testid="revoke-session-4"');
  });

  it("affiche un état vide explicite, jamais une ligne inventée", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSessionsPanel, {
        sessions: sessionsFixture({ sessions: [], totals: { total: 0, active: 0, revoked: 0, expired: 0 } }),
        failed: false,
        isLoading: false,
        revokingId: null,
        notice: null,
        onRevoke: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="sessions-empty"');
    expect(html).toContain("Aucune session enregistrée");
    expect(html).toContain("0 active(s)");
    expect(html).not.toContain("Registre des sessions illisible");
  });

  it("annonce un registre illisible au lieu d’un zéro trompeur", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSessionsPanel, {
        sessions: sessionsFixture({ sessions: [], unavailable: true }),
        failed: false,
        isLoading: false,
        revokingId: null,
        notice: null,
        onRevoke: () => undefined,
      }),
    );

    expect(html).toContain("Registre des sessions illisible");
    expect(html).toContain("Indisponible");
    expect(html).toContain("indisponible");
    // L’état vide ne doit PAS être affiché : rien n’a été lu, on ne conclut pas.
    expect(html).not.toContain('data-testid="sessions-empty"');
    expect(html).not.toContain("Aucune session enregistrée");
  });

  it("distingue l’échec de procédure du registre illisible", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSessionsPanel, {
        sessions: undefined,
        failed: true,
        isLoading: false,
        revokingId: null,
        notice: null,
        onRevoke: () => undefined,
      }),
    );
    expect(html).toContain("Relevé des sessions indisponible");
    expect(html).toContain('data-testid="system-sessions"');
  });

  it("rend le retour de révocation, refus compris", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSessionsPanel, {
        sessions: sessionsFixture(),
        failed: false,
        isLoading: false,
        revokingId: null,
        notice: { tone: "down", message: "Vous ne pouvez pas révoquer la session qui vous authentifie." },
        onRevoke: () => undefined,
      }),
    );
    expect(html).toContain('data-testid="session-notice"');
    expect(html).toContain("Vous ne pouvez pas révoquer la session qui vous authentifie.");
  });

  it("signale les lignes non affichées quand la liste est bornée", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSessionsPanel, {
        sessions: sessionsFixture({ omitted: 12 }),
        failed: false,
        isLoading: false,
        revokingId: null,
        notice: null,
        onRevoke: () => undefined,
      }),
    );
    expect(html).toContain("12 session(s)");
    expect(html).toContain("bornée");
  });

  it("formate les dates et les états sans jamais laisser une cellule vide", () => {
    expect(formatSessionDate(null)).toBe("—");
    expect(formatSessionDate(undefined)).toBe("—");
    expect(formatSessionDate("pas-une-date")).toBe("—");
    expect(formatSessionDate("2026-09-16T07:25:00.000Z")).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);

    expect(sessionStateBadge("active")).toEqual({ tone: "ok", label: "Active" });
    expect(sessionStateBadge("revoked")).toEqual({ tone: "down", label: "Révoquée" });
    expect(sessionStateBadge("expired")).toEqual({ tone: "warn", label: "Expirée" });

    expect(sessionsVerdict(undefined, true).label).toBe("Indisponible");
    expect(sessionsVerdict(undefined, false).label).toBe("En attente");
    expect(sessionsVerdict(sessionsFixture({ unavailable: true }), false).label).toBe("Indisponible");
    expect(sessionsVerdict(sessionsFixture(), false).label).toBe("2 active(s)");

    const sansNom = sessionsFixture().sessions[0];
    expect(sessionAccountName({ ...sansNom, accountName: null })).toBe("a.bah@lucepres.gn");
    expect(sessionAccountName({ ...sansNom, accountName: null, accountEmail: null })).toBe("Compte #4");
  });
});

/* ------------------------------------------------------------------ */
/* 7. Cartographie : rail, route, isolation du bundle                  */
/* ------------------------------------------------------------------ */

describe("Rail de la console — modules livrés et modules annotés", () => {
  it("distingue les modules livrés (route) des modules annoncés (phase)", () => {
    const livres = CONSOLE_MODULES.filter(module => module.path !== undefined);
    const annotes = CONSOLE_MODULES.filter(module => module.path === undefined);

    expect(DELIVERED_CONSOLE_MODULES).toHaveLength(livres.length);
    // Six modules restent à livrer : ils portent une phase, jamais un lien mort.
    expect(annotes.map(module => module.phase).every(phase => phase.startsWith("Phase"))).toBe(true);
    for (const module of annotes) {
      expect(module.summary).toBeUndefined();
    }
  });

  it("rend le nouvel écran navigable et annote les autres", () => {
    const html = renderToStaticMarkup(createElement(ConsoleModuleRail, { activePath: "/console/sessions" }));

    expect(html).toContain("Sessions actives");
    expect(html).toContain('href="/console/sessions"');
    expect(html).toContain('aria-current="page"');
    // Les écrans déjà livrés restent navigables.
    for (const chemin of ["/console", "/console/sante", "/console/acces", "/console/permissions"]) {
      expect(html).toContain(`href="${chemin}"`);
    }
    expect(html).toContain("Phase 5");
  });

  it("ne renomme ni ne duplique aucun module existant", () => {
    const libelles = CONSOLE_MODULES.map(module => module.label);
    expect(new Set(libelles).size).toBe(libelles.length);
    for (const libelle of ["Tableau de bord", "Santé & supervision", "Accès & comptes", "Rôles & permissions"]) {
      expect(libelles).toContain(libelle);
    }
  });
});

describe("Isolation de l’écran Sessions actives", () => {
  const app = readSource("client/src/App.tsx");
  const layout = readSource("client/src/components/DashboardLayout.tsx");
  const page = readSource("client/src/pages/SystemSessionsPage.tsx");
  const ecran = readSource("client/src/components/SystemSessions.tsx");

  it("charge l’écran en paresseux, jamais statiquement", () => {
    expect(app).toContain('lazy(() => import("./pages/SystemSessionsPage"))');
    expect(app).not.toContain('from "./pages/SystemSessionsPage"');
  });

  it("garde la route /console/sessions derrière SystemGate", () => {
    expect(app).toContain('withSystemGate(SystemSessionsPage, "Sessions actives")');
    expect(app).toContain('<Route path={"/console/sessions"} component={SystemSessionsRoute} />');
  });

  it("ajoute l’entrée de navigation, filtrée par canAccessPath", () => {
    expect(layout).toContain('path: "/console/sessions"');
    expect(layout).toContain("canAccessPath");
  });

  it("alimente l’écran par les procédures protégées", () => {
    expect(page).toContain("system.sessions.list");
    expect(page).toContain("system.sessions.revoke");
    expect(page).toContain("ConsoleModuleRail");
    expect(page).toContain("/console/sessions");
    expect(page).toContain("Actualiser");
  });

  it("ne rend ni jeton ni empreinte côté écran", () => {
    // La charge utile ne porte pas d’empreinte ; l’écran ne doit pas en réclamer.
    expect(ecran).toContain("Ni le jeton de session ni son empreinte");
    expect(page).not.toContain("tokenHash");
    expect(ecran).not.toContain("tokenHash");
  });

  it("n’écrit AUCUN DDL et ne touche pas au schéma", () => {
    for (const chemin of ["server/sessionRegistry.ts", "server/systemSessions.ts"]) {
      const source = readSource(chemin).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(source).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(source).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(source).not.toMatch(/\bDROP\s+/i);
      expect(source).not.toMatch(/\bTRUNCATE\b/i);
    }
  });

  it("ne modifie ni les données commerciales ni les autres écrans", () => {
    const router = readSource("server/_core/systemRouter.ts");
    // La console n’écrit qu’une chose : `revokedAt` sur une session.
    expect(router).toContain("revokeSessionById");
    for (const table of ["clients", "documents", "payments", "services", "projects"]) {
      expect(router).not.toContain(table);
    }
  });
});
