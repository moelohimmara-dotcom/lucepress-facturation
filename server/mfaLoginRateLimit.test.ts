import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_TTL_MS } from "./_core/localAuth";
import { loginRateLimiter } from "./_core/loginRateLimit";
import { signMfaChallenge } from "./_core/mfaChallenge";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * ÉTAPE B2 — LE VERROU ANTI-FORCE BRUTE FACE AU SECOND FACTEUR.
 *
 * C’EST LE TEST LE PLUS IMPORTANT DE CETTE LIVRAISON APRÈS CELUI DE LA
 * CONNEXION SANS MFA, parce qu’il couvre la faille qu’un premier jet avait
 * laissée passer — et qu’aucun test ne voyait.
 *
 * LE DÉFAUT CORRIGÉ
 * -----------------
 * `loginRateLimiter.check()` RÉSERVE une tentative ; `recordSuccess()` libère le
 * compteur du compte. Le premier jet appelait `recordSuccess` dès que le mot de
 * passe était juste, AVANT le second facteur. Conséquence : un attaquant qui
 * connaît le mot de passe — le scénario même de la MFA — bouclait
 *   1. `auth.login` : mot de passe juste → compteur du compte purgé ;
 *   2. `auth.mfaLogin` : code deviné → une seule tentative comptée.
 * Le verrou par COMPTE, seule défense qui ne dépende pas de l’adresse source,
 * ne montait donc jamais. Restait le quota par IP, qu’une attaque répartie
 * contourne.
 *
 * POURQUOI CE TEST UTILISE LE VRAI LIMITEUR
 * -----------------------------------------
 * Un limiteur remplacé par un double ne prouve rien ici : il faut que la
 * réservation, la confirmation et la purge soient les vraies. Le limiteur vit
 * en mémoire du processus, ce qui le rend utilisable tel quel en test ; il est
 * remis à zéro avant chaque cas.
 *
 * LE TEST ÉCHOUE SI L’ON RÉINTRODUIT LE DÉFAUT : le compteur du compte serait
 * purgé à chaque cycle et le blocage n’arriverait jamais.
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
    isMfaActiveForUser: vi.fn(async () => true),
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
    isMfaActiveForUser: mocks.isMfaActiveForUser,
  };
});

const COMPTE = {
  id: 4,
  openId: "local_sys",
  email: "systeme@lucepres.gn",
  name: "Administrateur système",
  passwordHash: "hash:bon-mot-de-passe",
  role: "systeme",
  tenantId: 1,
};

const ETAT_AVEC_MFA = { readable: true, enabled: true, pending: false, enrolledAt: null, recoveryCodesRemaining: 10 };
const ETAT_SANS_MFA = { readable: true, enabled: false, pending: false, enrolledAt: null, recoveryCodesRemaining: 0 };

/** Adresse source FIXE : seule la défense par compte peut donc nous arrêter. */
const IP = "41.66.1.9";

function context(): TrpcContext {
  return {
    user: null,
    tenantId: null,
    req: {
      headers: { cookie: "", "user-agent": "vitest" },
      ip: IP,
      socket: { remoteAddress: IP },
      protocol: "https",
      get: () => undefined,
    },
    res: { cookie: () => undefined, clearCookie: () => undefined },
  } as unknown as TrpcContext;
}

/** Jouer un cycle COMPLET d’attaque : mot de passe juste, puis code deviné. */
async function cycleMotDePassePuisCodeFaux(): Promise<"bloque" | "mfa-demande"> {
  const caller = appRouter.createCaller(context());
  const reponse = await caller.auth.login({ email: COMPTE.email, password: "bon-mot-de-passe" });
  if (!("mfaRequired" in reponse) || !reponse.mfaRequired) return "mfa-demande";

  try {
    await caller.auth.mfaLogin({ challengeToken: reponse.challengeToken, code: "000000" });
    return "mfa-demande";
  } catch (error) {
    if ((error as { code?: string }).code === "TOO_MANY_REQUESTS") return "bloque";
    return "mfa-demande";
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  loginRateLimiter.reset();
  mocks.execute.mockResolvedValue([]);
  mocks.getDb.mockResolvedValue({ execute: mocks.execute });
  mocks.getUserByEmail.mockResolvedValue(COMPTE);
  mocks.getUserByOpenId.mockResolvedValue(COMPTE);
  mocks.readMfaState.mockResolvedValue(ETAT_AVEC_MFA);
  // Le code est toujours refusé : on ne teste que le COMPTAGE des tentatives.
  mocks.verifySecondFactor.mockResolvedValue({ ok: false, reason: "code_incorrect" });
});

describe("MFA — un mot de passe connu ne remet PAS le compteur du compte à zéro", () => {
  it("bloque le compte après quelques cycles « mot de passe juste + code faux »", async () => {
    const resultats: Array<"bloque" | "mfa-demande"> = [];
    for (let cycle = 0; cycle < 10; cycle += 1) {
      resultats.push(await cycleMotDePassePuisCodeFaux());
      if (resultats[resultats.length - 1] === "bloque") break;
    }

    // Le blocage ARRIVE bien. Avec l’ancien comportement — `recordSuccess` appelé
    // dès le mot de passe validé — le compteur du compte était purgé à chaque
    // cycle et les dix cycles passaient sans blocage : ce test échouait.
    expect(resultats).toContain("bloque");
    // Il arrive VITE : cinq réservations par compte, deux par cycle interrompu.
    expect(resultats.length).toBeLessThanOrEqual(4);
  });

  it("le blocage visé est celui du COMPTE, pas celui de l’adresse", async () => {
    for (let cycle = 0; cycle < 10; cycle += 1) {
      if ((await cycleMotDePassePuisCodeFaux()) === "bloque") break;
    }

    // Le même poste, un AUTRE compte : la porte est ouverte. C’est la preuve que
    // le refus ne vient pas du quota par IP (qui, lui, aurait fermé tout le
    // monde) — donc que la défense par compte fonctionne réellement.
    const autre = loginRateLimiter.check({ email: "un-autre-compte@lucepres.gn", ip: IP });
    expect(autre).toMatchObject({ allowed: true });
  });

  it("ne consomme PAS la réservation du mot de passe avant le second facteur", async () => {
    const caller = appRouter.createCaller(context());
    const reponse = await caller.auth.login({ email: COMPTE.email, password: "bon-mot-de-passe" });
    expect(reponse).toMatchObject({ mfaRequired: true });

    // La tentative reste comptée pour le compte : une réservation a été prise et
    // n’a pas été libérée. Si `recordSuccess` était appelée ici, le compteur
    // repartirait de zéro à chaque essai, ce que démontre le test de blocage.
    const verdict = loginRateLimiter.check({ email: COMPTE.email, ip: IP });
    expect(verdict).toMatchObject({ allowed: true });
    // Compteur déjà entamé par la réservation du mot de passe.
    expect(loginRateLimiter.check({ email: COMPTE.email, ip: IP })).toMatchObject({ allowed: true });
    expect(loginRateLimiter.check({ email: COMPTE.email, ip: IP })).toMatchObject({ allowed: true });
    // ...cinquième réservation : la suivante est refusée.
    expect(loginRateLimiter.check({ email: COMPTE.email, ip: IP })).toMatchObject({ allowed: true });
    const refuse = loginRateLimiter.check({ email: COMPTE.email, ip: IP });
    expect(refuse.allowed).toBe(false);
    if (!refuse.allowed) expect(refuse.scope).toBe("email");
  });
});

describe("Sans MFA — le compteur est TOUJOURS libéré par une connexion réussie", () => {
  it("purge le compteur du compte après une authentification complète", async () => {
    mocks.readMfaState.mockResolvedValue(ETAT_SANS_MFA);
    const caller = appRouter.createCaller(context());

    // Quatre échecs de mot de passe, puis une connexion réussie.
    for (let essai = 0; essai < 4; essai += 1) {
      await expect(caller.auth.login({ email: COMPTE.email, password: "mauvais" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    const succes = await caller.auth.login({ email: COMPTE.email, password: "bon-mot-de-passe" });
    expect(succes).toEqual({ success: true });

    // Le compteur du compte est reparti de zéro : le chemin sans MFA garde
    // exactement le comportement d’avant l’étape B2.
    const verdict = loginRateLimiter.check({ email: COMPTE.email, ip: IP });
    expect(verdict).toMatchObject({ allowed: true });
  });

  it("délivre le cookie et la durée de vie habituelle, sans défi", async () => {
    mocks.readMfaState.mockResolvedValue(ETAT_SANS_MFA);
    const ctx = context();
    const cookies: Array<{ maxAge?: number }> = [];
    (ctx.res as unknown as { cookie: unknown }).cookie = (_name: string, _token: string, options?: { maxAge?: number }) =>
      cookies.push(options ?? {});

    await expect(
      appRouter.createCaller(ctx).auth.login({ email: COMPTE.email, password: "bon-mot-de-passe" }),
    ).resolves.toEqual({ success: true });
    expect(cookies[0]?.maxAge).toBe(SESSION_TTL_MS);
    expect(await signMfaChallenge({ openId: COMPTE.openId, tenantId: 1 })).toMatchObject({ expiresInSeconds: 300 });
  });
});
