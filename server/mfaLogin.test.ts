import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { SESSION_TTL_MS, verifyLocalSession } from "./_core/localAuth";
import { signMfaChallenge } from "./_core/mfaChallenge";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * ÉTAPE B2 — LA CONNEXION À DEUX TEMPS.
 *
 * LA CONTRAINTE LA PLUS IMPORTANTE DE CETTE LIVRAISON TIENT DANS UN TEST :
 * un compte SANS MFA se connecte exactement comme avant. La quasi-totalité des
 * comptes de l’instance est dans ce cas ; si ce chemin changeait, l’application
 * s’arrêterait pour tout le monde.
 *
 * Ce fichier prouve donc, dans l’ordre :
 *   1. connexion INCHANGÉE sans MFA — session délivrée, cookie posé, ligne
 *      `sessions` écrite — Y COMPRIS quand l’état MFA est illisible ;
 *   2. `mfaRequired` + défi quand la MFA est active, et RIEN d’autre : ni
 *      cookie, ni session, ni trace en base ;
 *   3. validation du défi : code TOTP juste (session délivrée comme au chemin
 *      direct), code faux, défi expiré, défi fabriqué, jeton de SESSION présenté
 *      comme défi ;
 *   4. code de secours accepté, puis refusé une seconde fois (consommé) ;
 *   5. verrouillage anti-force brute.
 *
 * `server/mfa.ts` est doublé : la mécanique TOTP, l’anti-rejeu et la
 * consommation sont prouvés sur le VRAI module dans `server/mfa.test.ts`. Ici on
 * vérifie la PROCÉDURE — qui délivre quoi, et à quelle condition.
 */

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    execute: vi.fn(),
    getDb: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByOpenId: vi.fn(),
    upsertUser: vi.fn(async () => undefined),
    verifyPassword: vi.fn(async (plain: string, stored: string) => stored === `hash:${plain}`),
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
    readMfaState: vi.fn(),
    verifySecondFactor: vi.fn(),
    disableMfa: vi.fn(),
    isMfaActiveForUser: vi.fn(async () => true),
    rateLimitCheck: vi.fn(() => ({ allowed: true as const })),
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
  };
});

vi.mock("./db", () => mocks);
vi.mock("./_core/password", () => ({ verifyPassword: mocks.verifyPassword, hashPassword: mocks.hashPassword }));
vi.mock("./mfa", async importOriginal => {
  const actual = await importOriginal<typeof import("./mfa")>();
  return {
    ...actual,
    readMfaState: mocks.readMfaState,
    verifySecondFactor: mocks.verifySecondFactor,
    disableMfa: mocks.disableMfa,
    isMfaActiveForUser: mocks.isMfaActiveForUser,
  };
});
vi.mock("./_core/loginRateLimit", () => ({
  // Le double CONSERVE ses arguments : sans cela, on ne prouverait que « le
  // limiteur est consulté », jamais QUEL compte est compté — or c’est tout
  // l’enjeu (voir `mfaLoginRateLimit.test.ts`, qui utilise le vrai limiteur).
  loginRateLimiter: {
    check: (...args: unknown[]) => mocks.rateLimitCheck(...(args as [])),
    recordFailure: (...args: unknown[]) => mocks.recordFailure(...(args as [])),
    recordSuccess: (...args: unknown[]) => mocks.recordSuccess(...(args as [])),
  },
  registerRateLimiter: {
    check: () => ({ allowed: true }),
    recordFailure: () => undefined,
    recordSuccess: () => undefined,
  },
}));

type CookieCall = { name: string; token: string; maxAge?: number };

/**
 * Contexte d’appel : l’utilisateur y est déjà résolu (le contexte tRPC est un
 * autre sujet, couvert par `systemSessions.test.ts`). Ici, seule compte la
 * réponse de `auth.login` / `auth.mfaLogin`.
 */
function context(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  const ctx = {
    user: null,
    tenantId: null,
    req: {
      headers: { cookie: "", "user-agent": "vitest" },
      ip: "41.66.1.9",
      socket: { remoteAddress: "41.66.1.9" },
      protocol: "https",
      get: () => undefined,
    },
    res: {
      cookie: (name: string, token: string, options?: { maxAge?: number }) => cookies.push({ name, token, maxAge: options?.maxAge }),
      clearCookie: () => undefined,
    },
  } as unknown as TrpcContext;
  return { ctx, cookies };
}

/**
 * Contexte AUTHENTIFIÉ — pour les procédures `protectedProcedure` (`mfa.*`).
 *
 * `auth.login` et `auth.mfaLogin` sont publiques : elles n’ont pas d’utilisateur
 * au moment de l’appel, c’est tout l’objet du premier facteur. Les procédures de
 * gestion de sa propre MFA, elles, supposent une session : sans utilisateur
 * résolu, elles répondent 401 AVANT d’atteindre le code testé.
 */
function authenticatedContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const { ctx, cookies } = context();
  (ctx as { user: unknown }).user = { ...COMPTE, loginMethod: "email", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
  (ctx as { tenantId: unknown }).tenantId = 1;
  return { ctx, cookies };
}

const COMPTE = {
  id: 4,
  openId: "local_dg",
  email: "dg@lucepres.gn",
  name: "Directrice Générale",
  passwordHash: "hash:bon-mot-de-passe",
  role: "admin",
  tenantId: 1,
};

const ETAT_SANS_MFA = { readable: true, enabled: false, pending: false, enrolledAt: null, recoveryCodesRemaining: 0 };
const ETAT_AVEC_MFA = { readable: true, enabled: true, pending: false, enrolledAt: new Date("2026-09-01T08:00:00Z"), recoveryCodesRemaining: 10 };

function sqlOf(query: SQL) {
  return new PgDialect().sqlToQuery(query);
}

/** Les écritures de session observées, pour distinguer « session délivrée » de « rien ». */
function sessionInserts(): number {
  return mocks.execute.mock.calls.filter(call => sqlOf(call[0] as SQL).sql.includes("insert into sessions")).length;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockResolvedValue([]);
  mocks.getDb.mockResolvedValue({ execute: mocks.execute });
  mocks.getUserByEmail.mockResolvedValue(COMPTE);
  mocks.getUserByOpenId.mockResolvedValue(COMPTE);
  mocks.readMfaState.mockResolvedValue(ETAT_SANS_MFA);
  mocks.verifySecondFactor.mockResolvedValue({ ok: true, value: { method: "totp", step: 123, recoveryCodesRemaining: 10 } });
  mocks.rateLimitCheck.mockReturnValue({ allowed: true });
});

/* ------------------------------------------------------------------ */
/* 1. Compte SANS MFA — la connexion ne doit Pas changer               */
/* ------------------------------------------------------------------ */

describe("Compte sans MFA — connexion inchangée", () => {
  it("délivre la session, pose le cookie et enregistre la session", async () => {
    const { ctx, cookies } = context();

    const result = await appRouter.createCaller(ctx).auth.login({ email: "dg@lucepres.gn", password: "bon-mot-de-passe" });

    // Réponse STRICTEMENT identique à avant l’étape B2.
    expect(result).toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe(COOKIE_NAME);
    expect(cookies[0].maxAge).toBe(SESSION_TTL_MS);
    // Le jeton est une VRAIE session, relisible par le vérificateur de session.
    const payload = await verifyLocalSession(cookies[0].token);
    expect(payload).toMatchObject({ openId: "local_dg", email: "dg@lucepres.gn", tenantId: 1 });
    expect(sessionInserts()).toBe(1);
    expect(mocks.upsertUser).toHaveBeenCalledWith({ openId: "local_dg", lastSignedIn: expect.any(Date) });
    // Aucun défi n’a été ouvert, et aucune vérification de second facteur n’a eu
    // lieu : le chemin par défaut ne dépend pas de la MFA.
    expect(mocks.verifySecondFactor).not.toHaveBeenCalled();
  });

  it("conserve la connexion MÊME SI l’état MFA est illisible (colonnes absentes, base muette)", async () => {
    // C’est le compromis assumé et documenté : une lecture impossible vaut
    // « pas de MFA » pour la CONNEXION, parce qu’exiger le contraire fermerait
    // l’application à tout le monde. Ce fail-open ne décide que d’une chose —
    // demander ou non un second temps — et rien ne le compense ailleurs depuis
    // que la console n’exige plus la MFA : c’est un résidu connu, borné à la
    // fenêtre où l’état est illisible, et arbitré en faveur de la disponibilité.
    mocks.readMfaState.mockResolvedValue({ readable: false, enabled: false, pending: false, enrolledAt: null, recoveryCodesRemaining: 0 });
    const { ctx, cookies } = context();

    await expect(
      appRouter.createCaller(ctx).auth.login({ email: "dg@lucepres.gn", password: "bon-mot-de-passe" }),
    ).resolves.toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(sessionInserts()).toBe(1);
  });

  it("refuse un mot de passe faux SANS délivrer de session", async () => {
    const { ctx, cookies } = context();

    await expect(
      appRouter.createCaller(ctx).auth.login({ email: "dg@lucepres.gn", password: "mauvais-mot-de-passe" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toEqual([]);
    expect(sessionInserts()).toBe(0);
    expect(mocks.recordFailure).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* 2. Compte AVEC MFA — pas de session sans second facteur             */
/* ------------------------------------------------------------------ */

describe("Compte avec MFA — le mot de passe ne suffit plus", () => {
  it("répond mfaRequired et NE DÉLIVRE RIEN : ni cookie, ni session", async () => {
    mocks.readMfaState.mockResolvedValue(ETAT_AVEC_MFA);
    const { ctx, cookies } = context();

    const result = await appRouter.createCaller(ctx).auth.login({ email: "dg@lucepres.gn", password: "bon-mot-de-passe" });

    expect(result).toMatchObject({ mfaRequired: true, expiresInSeconds: 300 });
    expect(cookies).toEqual([]);
    expect(sessionInserts()).toBe(0);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
    // Le jeton rendu n’est PAS une session : c’est le point du dispositif.
    expect(await verifyLocalSession((result as { challengeToken: string }).challengeToken)).toBeNull();
  });

  it("déclenche le défi pour un compte SYSTÈME enrôlé, comme pour tout autre compte", async () => {
    // AJOUTÉ — la console n’exige plus la MFA (décision du propriétaire de
    // l’instance), mais la CONNEXION continue de l’exiger de qui l’a activée.
    // Sans cette moitié, l’enrôlement n’aurait plus aucun effet : le rôle ne
    // doit rien changer ici, et c’est ce que ce test empêche de dériver.
    mocks.getUserByEmail.mockResolvedValue({
      ...COMPTE,
      id: 9,
      openId: "local_systeme",
      email: "systeme@lucepres.gn",
      role: "systeme",
    });
    mocks.readMfaState.mockResolvedValue(ETAT_AVEC_MFA);
    const { ctx, cookies } = context();

    const result = await appRouter.createCaller(ctx).auth.login({ email: "systeme@lucepres.gn", password: "bon-mot-de-passe" });

    expect(result).toMatchObject({ mfaRequired: true, expiresInSeconds: 300 });
    expect(cookies).toEqual([]);
    expect(sessionInserts()).toBe(0);
  });

  it("NE LIBÈRE PAS le compteur anti-force brute avant le second facteur", async () => {
    mocks.readMfaState.mockResolvedValue(ETAT_AVEC_MFA);
    const { ctx } = context();

    await appRouter.createCaller(ctx).auth.login({ email: "dg@lucepres.gn", password: "bon-mot-de-passe" });

    // `check()` a RÉSERVÉ la tentative ; `recordSuccess` la libérerait, et un
    // attaquant connaissant le mot de passe purgerait ainsi son compteur à
    // chaque essai. Le comptage doit survivre jusqu’à `auth.mfaLogin`, qui seul
    // atteste d’une authentification complète. Le comportement est prouvé de
    // bout en bout, avec le VRAI limiteur, dans `mfaLoginRateLimit.test.ts`.
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith({ email: "dg@lucepres.gn", ip: "41.66.1.9" });
    expect(mocks.recordSuccess).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* 3. Validation du défi                                               */
/* ------------------------------------------------------------------ */

describe("auth.mfaLogin — le défi, et rien d’autre", () => {
  async function defiValide(): Promise<string> {
    return (await signMfaChallenge({ openId: "local_dg", tenantId: 1 })).token;
  }

  it("délivre la session normalement sur un code juste", async () => {
    const { ctx, cookies } = context();
    const challengeToken = await defiValide();

    const result = await appRouter.createCaller(ctx).auth.mfaLogin({ challengeToken, code: "123456" });

    expect(result).toEqual({ success: true, method: "totp" });
    expect(mocks.verifySecondFactor).toHaveBeenCalledWith(4, "123456");
    expect(cookies).toHaveLength(1);
    // MÊME session qu’au chemin direct : cookie, durée de vie, ligne `sessions`.
    expect(cookies[0].maxAge).toBe(SESSION_TTL_MS);
    expect(await verifyLocalSession(cookies[0].token)).toMatchObject({ openId: "local_dg", tenantId: 1 });
    expect(sessionInserts()).toBe(1);
  });

  it("accepte un code de secours et le dit", async () => {
    mocks.verifySecondFactor.mockResolvedValue({ ok: true, value: { method: "recovery", step: null, recoveryCodesRemaining: 9 } });
    const { ctx, cookies } = context();

    const result = await appRouter.createCaller(ctx).auth.mfaLogin({ challengeToken: await defiValide(), code: "A2C4E-7GH9K" });

    expect(result).toEqual({ success: true, method: "recovery" });
    expect(cookies).toHaveLength(1);
  });

  it("refuse un code faux sans ouvrir de session", async () => {
    mocks.verifySecondFactor.mockResolvedValue({ ok: false, reason: "code_incorrect" });
    const { ctx, cookies } = context();

    await expect(
      appRouter.createCaller(ctx).auth.mfaLogin({ challengeToken: await defiValide(), code: "000000" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toEqual([]);
    expect(sessionInserts()).toBe(0);
    expect(mocks.recordFailure).toHaveBeenCalled();
  });

  it("explique qu’un code a déjà servi, sans délivrer de session", async () => {
    mocks.verifySecondFactor.mockResolvedValue({ ok: false, reason: "code_deja_utilise" });
    const { ctx } = context();

    await expect(
      appRouter.createCaller(ctx).auth.mfaLogin({ challengeToken: await defiValide(), code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: expect.stringContaining("déjà servi") });
  });

  it("refuse un défi expiré, fabriqué, ou pris pour ce qu’il n’est pas", async () => {
    const { ctx, cookies } = context();
    const caller = appRouter.createCaller(ctx);

    // Expiré.
    const expire = (await signMfaChallenge({ openId: "local_dg", tenantId: 1 }, -1)).token;
    await expect(caller.auth.mfaLogin({ challengeToken: expire, code: "123456" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("expiré"),
    });

    // Fabriqué.
    await expect(caller.auth.mfaLogin({ challengeToken: "a".repeat(64), code: "123456" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    // Un JETON DE SESSION présenté comme défi : signé d’une autre clé, donc refusé.
    const { signLocalSession } = await import("./_core/localAuth");
    const session = await signLocalSession({ openId: "local_dg", email: "dg@lucepres.gn", name: "DG", tenantId: 1 });
    await expect(caller.auth.mfaLogin({ challengeToken: session, code: "123456" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    // Aucun de ces refus n’a ouvert quoi que ce soit.
    expect(cookies).toEqual([]);
    expect(sessionInserts()).toBe(0);
    expect(mocks.verifySecondFactor).not.toHaveBeenCalled();
  });

  it("refuse un défi dont le compte a disparu", async () => {
    mocks.getUserByOpenId.mockResolvedValue(undefined);
    const { ctx, cookies } = context();

    await expect(
      appRouter.createCaller(ctx).auth.mfaLogin({ challengeToken: await defiValide(), code: "123456" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toEqual([]);
  });

  it("oppose le même verrou anti-force brute qu’à la connexion", async () => {
    mocks.rateLimitCheck.mockReturnValue({ allowed: false, retryAfterSeconds: 45, scope: "email" });
    const { ctx, cookies } = context();

    await expect(
      appRouter.createCaller(ctx).auth.mfaLogin({ challengeToken: await defiValide(), code: "123456" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: expect.stringContaining("45") });
    // Le compteur est consulté sur le COMPTE (et l’adresse), AVANT toute
    // vérification de code : six chiffres ne se devinent pas sans frein.
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith({ email: "dg@lucepres.gn", ip: "41.66.1.9" });
    expect(mocks.verifySecondFactor).not.toHaveBeenCalled();
    expect(cookies).toEqual([]);
  });

  it("désactive la MFA — et le refus d’un code est verrouillé ET journalisé", async () => {
    // Le verrou de `mfa.disable` a failli manquer : une session volée, sans
    // téléphone ni mot de passe, pouvait faire défiler des codes à six chiffres.
    mocks.disableMfa.mockResolvedValue({ ok: false, reason: "code_incorrect" });
    const lignes: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      lignes.push(args.map(String).join(" "));
    });
    const { ctx } = authenticatedContext();

    await expect(appRouter.createCaller(ctx).mfa.disable({ code: "000000" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith({ email: "dg@lucepres.gn", ip: "41.66.1.9" });
    expect(mocks.recordFailure).toHaveBeenCalledWith({ email: "dg@lucepres.gn", ip: "41.66.1.9" });
    // L’échec est journalisé : tenter de RETIRER un second facteur est un signal
    // que l’administrateur système doit voir.
    expect(lignes.some(ligne => ligne.includes("motif=defi_refuse") && ligne.includes("cible=mfa.disable"))).toBe(true);
    expect(mocks.disableMfa).toHaveBeenCalledWith(4, "000000");
  });

  it("refuse de désactiver quand le compte est verrouillé, avant même de vérifier", async () => {
    mocks.rateLimitCheck.mockReturnValue({ allowed: false, retryAfterSeconds: 30, scope: "email" });
    const { ctx } = authenticatedContext();

    await expect(appRouter.createCaller(ctx).mfa.disable({ code: "000000" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    // Aucune vérification de code n’a été tentée : c’est le principe du verrou.
    expect(mocks.disableMfa).not.toHaveBeenCalled();
  });

  it("n’accepte pas une requête sans défi", async () => {
    const { ctx } = context();
    await expect(appRouter.createCaller(ctx).auth.mfaLogin({ challengeToken: "court", code: "123456" })).rejects.toBeTruthy();
  });
});
