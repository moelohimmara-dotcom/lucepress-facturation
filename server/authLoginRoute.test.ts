import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test d'intégration de la procédure `auth.login` : vérifie que le limiteur est
 * réellement BRANCHÉ dans la route (le test unitaire de `loginRateLimit.ts` ne
 * prouve que la mécanique interne, pas son câblage).
 *
 * POURQUOI `_core/password` EST SIMULÉ ICI
 * ---------------------------------------
 * scrypt est volontairement coûteux en CPU. Une première version de ce fichier
 * exécutait de vrais hachages : lancée en parallèle, elle affamait le test jsdom
 * `documentEditorPaymentSchedule.ui.test.ts` jusqu'à le faire expirer (5 s) —
 * un échec sans aucun rapport avec son sujet.
 *
 * Le sujet de CE fichier est le garde-fou anti-brute-force, pas la robustesse de
 * scrypt (déjà couverte par `_core/password.ts` et ses tests dédiés). On simule
 * donc la vérification du mot de passe par une comparaison triviale : le
 * comportement testé (compteur d'échecs, blocage, remise à zéro) est identique,
 * sans le coût CPU.
 */
const mocks = vi.hoisted(() => {
  // `vi.hoisted` s'exécute AVANT les imports de modules : c'est le seul endroit
  // où l'on peut fournir un JWT_SECRET avant que `_core/env.ts` ne le lise.
  // Sans lui, `signLocalSession` échoue ("Zero-length key is not supported").
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getUserByEmail: vi.fn(),
    upsertUser: vi.fn(async () => undefined),
    countUsersWithPassword: vi.fn(async () => 1),
    createLocalUser: vi.fn(async () => ({ id: 9, openId: "local_test" })),
    verifyPassword: vi.fn(async (plain: string, stored: string) => stored === `hash:${plain}`),
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
  };
});

vi.mock("./db", () => mocks);
vi.mock("./_core/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

import { appRouter } from "./routers";
import { loginRateLimiter, registerRateLimiter } from "./_core/loginRateLimit";
import type { TrpcContext } from "./_core/context";

/** Représentation d'un mot de passe déjà haché, cohérente avec le mock ci-dessus. */
const storedHashFor = (plain: string) => `hash:${plain}`;

function ctxFor(ip: string): TrpcContext {
  return {
    user: null,
    req: { headers: {}, ip, socket: { remoteAddress: ip }, protocol: "https" } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  loginRateLimiter.reset();
  registerRateLimiter.reset();
  vi.clearAllMocks();
  mocks.countUsersWithPassword.mockResolvedValue(1);
  mocks.verifyPassword.mockImplementation(async (plain: string, stored: string) => stored === `hash:${plain}`);
  mocks.hashPassword.mockImplementation(async (plain: string) => `hash:${plain}`);
});

describe("auth.login — intégration du garde-fou brute-force", () => {
  it("finit par répondre TOO_MANY_REQUESTS lors d'un martèlement de mots de passe", async () => {
    mocks.getUserByEmail.mockResolvedValue({
      id: 1,
      openId: "local_dg",
      email: "dg@lucepress.com",
      passwordHash: storedHashFor("le-vrai-mot-de-passe"),
      role: "admin",
    });

    const caller = appRouter.createCaller(ctxFor("41.66.1.9"));
    const codes: string[] = [];

    for (let i = 0; i < 8; i++) {
      try {
        await caller.auth.login({ email: "dg@lucepress.com", password: `essai-${i}` });
        codes.push("SUCCESS");
      } catch (error: any) {
        codes.push(error?.code ?? "UNKNOWN");
      }
    }

    expect(codes.slice(0, 5)).toEqual(Array(5).fill("UNAUTHORIZED"));
    expect(codes.slice(5)).toEqual(Array(3).fill("TOO_MANY_REQUESTS"));
    // Preuve que le blocage intervient AVANT tout travail coûteux : une fois
    // bloqué, ni la base ni la vérification du mot de passe ne sont sollicitées.
    expect(mocks.getUserByEmail).toHaveBeenCalledTimes(5);
    expect(mocks.verifyPassword).toHaveBeenCalledTimes(5);
  });

  it("compte aussi les échecs sur un e-mail inexistant (pas d'oracle d'énumération)", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("41.66.1.10"));

    const codes: string[] = [];
    for (let i = 0; i < 7; i++) {
      try {
        await caller.auth.login({ email: "inconnu@lucepress.com", password: "x".repeat(12) });
        codes.push("SUCCESS");
      } catch (error: any) {
        codes.push(error?.code ?? "UNKNOWN");
      }
    }
    expect(codes).toContain("TOO_MANY_REQUESTS");
  });

  it("laisse passer le bon mot de passe malgré des échecs antérieurs sous le seuil", async () => {
    mocks.getUserByEmail.mockResolvedValue({
      id: 1,
      openId: "local_dg",
      email: "dg@lucepress.com",
      passwordHash: storedHashFor("bon-mot-de-passe"),
      role: "admin",
    });

    const caller = appRouter.createCaller(ctxFor("41.66.1.11"));
    for (let i = 0; i < 3; i++) {
      await expect(
        caller.auth.login({ email: "dg@lucepress.com", password: "faux" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    await expect(
      caller.auth.login({ email: "dg@lucepress.com", password: "bon-mot-de-passe" })
    ).resolves.toMatchObject({ success: true });
  });
});

describe("auth.register — garde-fou d'amorçage", () => {
  it("refuse l'inscription libre quand un compte local existe déjà", async () => {
    mocks.countUsersWithPassword.mockResolvedValue(1);
    const caller = appRouter.createCaller(ctxFor("41.66.1.12"));

    await expect(
      caller.auth.register({ email: "intrus@internet.com", password: "MotDePasse123" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
  });

  it("autorise la création du premier compte, en administrateur explicite", async () => {
    mocks.countUsersWithPassword.mockResolvedValue(0);
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("41.66.1.13"));

    await expect(
      caller.auth.register({ email: "dg@lucepress.com", password: "MotDePasse123", name: "Directeur" })
    ).resolves.toMatchObject({ success: true });

    expect(mocks.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "dg@lucepress.com", role: "admin" })
    );
  });
});
