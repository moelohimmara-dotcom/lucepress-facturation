import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test d'intégration du routeur `users` (gestion des collaborateurs, admin).
 * Vérifie que les gardes-fous côté serveur sont réellement branchés :
 * - un non-admin ne peut pas gérer les comptes ;
 * - pas de suppression du dernier admin ni de soi-même ;
 * - pas de création en doublon.
 * `_core/password` est simulé (scrypt coûteux en CPU).
 */
const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    listUsers: vi.fn(async () => []),
    getUserByEmail: vi.fn(),
    createLocalUser: vi.fn(async (input: any) => ({ id: 99, openId: `local_${input.email}` })),
    setUserRole: vi.fn(async () => undefined),
    resetUserPassword: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => ({ deleted: true })),
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
    verifyPassword: vi.fn(async (plain: string, stored: string) => stored === `hash:${plain}`),
  };
});

vi.mock("./db", () => mocks);
vi.mock("./_core/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(openId: string, role: "admin" | "cadre", id = 1): TrpcContext {
  return {
    user: { openId, email: "x@lucepress.com", role, name: "X", id } as any,
    tenantId: 1,
    tenantId: 1,
    tenantId: 1,
    req: { headers: {}, ip: "41.66.1.9", socket: { remoteAddress: "41.66.1.9" }, protocol: "https" } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue([
    { id: 1, openId: "local_a", name: "A", email: "a@x.com", role: "admin", loginMethod: "email", lastSignedIn: new Date().toISOString(), createdAt: new Date().toISOString() },
    { id: 2, openId: "local_b", name: "B", email: "b@x.com", role: "cadre", loginMethod: "email", lastSignedIn: new Date().toISOString(), createdAt: new Date().toISOString() },
  ]);
  mocks.deleteUser.mockResolvedValue({ deleted: true });
});

describe("users — accès réservé aux admins", () => {
  it("refuse toute action à un simple membre", async () => {
    const caller = appRouter.createCaller(ctxFor("local_b", "cadre", 2));
    await expect(caller.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.users.create({ email: "n@x.com", password: "MotDePasse123" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("users.create", () => {
  it("crée un compte membre avec un hash scrypt", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.create({ email: "nouveau@x.com", name: "Nouveau", password: "MotDePasse123", role: "cadre" })
    ).resolves.toMatchObject({ success: true });

    expect(mocks.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nouveau@x.com", role: "cadre" })
    );
    // Le mot de passe ne doit jamais être stocké en clair.
    const hash = mocks.createLocalUser.mock.calls[0][0].passwordHash as string;
    expect(hash).not.toBe("MotDePasse123");
    expect(hash.startsWith("hash:")).toBe(true);
  });

  it("refuse un e-mail déjà utilisé", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: 5, email: "pris@x.com" });
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.create({ email: "pris@x.com", password: "MotDePasse123" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
  });
});

describe("users.setRole", () => {
  it("refuse qu'un admin se retire son propre rôle", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.setRole({ userId: 1, role: "cadre" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("autorise la promotion d'un membre en admin", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.setRole({ userId: 2, role: "admin" })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.setUserRole).toHaveBeenCalledWith(2, "admin");
  });
});

describe("users.remove", () => {
  it("refuse la suppression de soi-même", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(caller.users.remove({ userId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("délègue la suppression au garde-fou db (dernier admin)", async () => {
    mocks.deleteUser.mockResolvedValue({ deleted: false, reason: "dernier_admin" });
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(caller.users.remove({ userId: 2 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("supprime un autre compte quand autorisé", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(caller.users.remove({ userId: 2 })).resolves.toMatchObject({ success: true });
    expect(mocks.deleteUser).toHaveBeenCalledWith(2);
  });
});

describe("users.resetPassword", () => {
  it("réinitialise sans l'ancien mot de passe, en hashant le nouveau", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.resetPassword({ userId: 2, newPassword: "NouveauMot123" })
    ).resolves.toMatchObject({ success: true });
    const hash = mocks.resetUserPassword.mock.calls[0][1] as string;
    expect(hash).not.toBe("NouveauMot123");
    expect(hash.startsWith("hash:")).toBe(true);
  });
});
