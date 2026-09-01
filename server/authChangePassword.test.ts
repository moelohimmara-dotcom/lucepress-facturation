import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test d'intégration de la procédure `auth.changePassword` : vérifie que la
 * logique de sécurité (ancien mot de passe requis, nouveau mot de passe robuste,
 * refus si identique) est réellement BRANCHÉE dans la route.
 *
 * `_core/password` est SIMULÉ ici pour la même raison que `authLoginRoute.test.ts`
 * : scrypt est coûteux en CPU et affamerait les tests voisins. Le sujet est la
 * logique de changement de mot de passe, pas la robustesse de scrypt.
 */
const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getUserByOpenId: vi.fn(),
    setUserPasswordHash: vi.fn(async () => undefined),
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
import type { TrpcContext } from "./_core/context";

const storedHashFor = (plain: string) => `hash:${plain}`;

function ctxFor(openId: string, role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: { openId, email: "dg@lucepress.com", role, name: "Direction" },
    tenantId: 1,
    tenantId: 1,
    tenantId: 1,
    req: { headers: {}, ip: "41.66.1.9", socket: { remoteAddress: "41.66.1.9" }, protocol: "https" } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

const COMPTE = {
  id: 1,
  openId: "local_dg",
  email: "dg@lucepress.com",
  passwordHash: storedHashFor("ancien-mot-de-passe"),
  role: "admin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserByOpenId.mockResolvedValue(COMPTE);
  mocks.verifyPassword.mockImplementation(async (plain: string, stored: string) => stored === `hash:${plain}`);
  mocks.hashPassword.mockImplementation(async (plain: string) => `hash:${plain}`);
});

describe("auth.changePassword — intégration", () => {
  it("change le mot de passe avec l'ancien mot de passe correct", async () => {
    const caller = appRouter.createCaller(ctxFor("local_dg"));
    await expect(
      caller.auth.changePassword({ currentPassword: "ancien-mot-de-passe", newPassword: "NouveauMotDePasse123" })
    ).resolves.toMatchObject({ success: true });

    expect(mocks.setUserPasswordHash).toHaveBeenCalledWith(
      1,
      storedHashFor("NouveauMotDePasse123")
    );
  });

  it("refuse si l'ancien mot de passe est faux", async () => {
    const caller = appRouter.createCaller(ctxFor("local_dg"));
    await expect(
      caller.auth.changePassword({ currentPassword: "mauvais", newPassword: "NouveauMotDePasse123" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // Aucune écriture ne doit avoir lieu.
    expect(mocks.setUserPasswordHash).not.toHaveBeenCalled();
  });

  it("refuse un nouveau mot de passe trop court", async () => {
    const caller = appRouter.createCaller(ctxFor("local_dg"));
    await expect(
      caller.auth.changePassword({ currentPassword: "ancien-mot-de-passe", newPassword: "court" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.setUserPasswordHash).not.toHaveBeenCalled();
  });

  it("refuse si le nouveau mot de passe est identique à l'ancien", async () => {
    const caller = appRouter.createCaller(ctxFor("local_dg"));
    await expect(
      caller.auth.changePassword({ currentPassword: "ancien-mot-de-passe", newPassword: "ancien-mot-de-passe" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.setUserPasswordHash).not.toHaveBeenCalled();
  });

  it("exige une session authentifiée (procédure protégée)", async () => {
    const ctxSansUser = {
      user: null,
      tenantId: 1,
      tenantId: 1,
      tenantId: 1,
      req: { headers: {}, ip: "41.66.1.9", socket: { remoteAddress: "41.66.1.9" }, protocol: "https" } as TrpcContext["req"],
      res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
    } as TrpcContext;

    const caller = appRouter.createCaller(ctxSansUser);
    await expect(
      caller.auth.changePassword({ currentPassword: "x", newPassword: "NouveauMotDePasse123" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getUserByOpenId).not.toHaveBeenCalled();
  });

  it("refuse un compte sans mot de passe (ex. OAuth hérité)", async () => {
    mocks.getUserByOpenId.mockResolvedValue({ ...COMPTE, passwordHash: null });
    const caller = appRouter.createCaller(ctxFor("local_dg"));
    await expect(
      caller.auth.changePassword({ currentPassword: "ancien-mot-de-passe", newPassword: "NouveauMotDePasse123" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.setUserPasswordHash).not.toHaveBeenCalled();
  });
});
