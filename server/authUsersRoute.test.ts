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
    listInvitations: vi.fn(async () => []),
    createInvitation: vi.fn(async () => ({ id: 7 })),
    revokeInvitation: vi.fn(async () => undefined),
    INVITATION_TTL_MS: 72 * 60 * 60 * 1000,
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
    verifyPassword: vi.fn(async (plain: string, stored: string) => stored === `hash:${plain}`),
  };
});

vi.mock("./db", () => mocks);
vi.mock("./_core/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));
// SMTP neutralisé : les tests d’invitation ne doivent produire aucun appel réseau,
// quel que soit l’environnement d’exécution.
vi.mock("./_core/mailer", () => ({
  sendMail: vi.fn(async () => undefined),
  isMailConfigured: () => false,
  getSmtpUser: () => undefined,
  getDefaultFrom: () => "Lucepres <noreply@lucepress.local>",
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(openId: string, role: "admin" | "cadre" | "systeme", id = 1): TrpcContext {
  return {
    user: { openId, email: "x@lucepress.com", role, name: "X", id } as any,
    tenantId: 1,
    req: { headers: {}, ip: "41.66.1.9", socket: { remoteAddress: "41.66.1.9" }, protocol: "https" } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

/** Admin (id 1) + cadre (id 2). Les tests qui visent un compte système
 *  remplacent ce jeu par `mockResolvedValue` avant leur appel. */
function staffFixture(extra: Array<Record<string, unknown>> = []) {
  return [
    { id: 1, openId: "local_a", name: "A", email: "a@x.com", role: "admin", loginMethod: "email", lastSignedIn: new Date().toISOString(), createdAt: new Date().toISOString() },
    { id: 2, openId: "local_b", name: "B", email: "b@x.com", role: "cadre", loginMethod: "email", lastSignedIn: new Date().toISOString(), createdAt: new Date().toISOString() },
    ...extra,
  ];
}

/** Compte d’administration système (id 3), seul détenteur de la console. */
const systemAccount = {
  id: 3,
  openId: "local_sys",
  name: "S",
  email: "sys@x.com",
  role: "systeme",
  loginMethod: "email",
  lastSignedIn: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue(staffFixture());
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

  it("RETOURNÉ — un admin ne peut plus créer un compte d’administration système", async () => {
    // La console n’appartient qu’au rôle `systeme` : un admin qui créerait ce
    // compte pourrait s’octroyer l’espace privilégié. Escalade fermée.
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.create({ email: "sys@x.com", name: "Système", password: "MotDePasse123", role: "systeme" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
  });

  it("laisse un compte système créer un autre compte système", async () => {
    // L’habilitation existe toujours, mais côté système : l’instance ne peut pas
    // se retrouver sans administrateur système faute de pouvoir en nommer un.
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(
      caller.users.create({ email: "sys2@x.com", name: "Système 2", password: "MotDePasse123", role: "systeme" })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "sys2@x.com", role: "systeme" })
    );
  });

  it("n’autorise pas un compte système à créer un compte métier", async () => {
    // Séparation des devoirs : le commerce reste l’affaire de l’admin.
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(
      caller.users.create({ email: "cadre@x.com", password: "MotDePasse123", role: "cadre" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
  });

  it("refuse toujours la création d’un accès portail client", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.create({ email: "cli@x.com", password: "MotDePasse123", role: "client" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("refuse aussi qu'un admin se retire son rôle au profit du rôle système", async () => {
    // Même garde-fou : l’instance ne doit pas se retrouver sans administrateur.
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.setRole({ userId: 1, role: "systeme" })
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

  it("RETOURNÉ — un admin ne peut plus promouvoir un membre vers « système »", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.setRole({ userId: 2, role: "systeme" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("RETOURNÉ — un admin ne peut plus rétrograder un compte système", async () => {
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount, { ...systemAccount, id: 4, openId: "local_sys2" }]));
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.setRole({ userId: 3, role: "cadre" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("laisse un compte système promouvoir un membre vers « système »", async () => {
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(
      caller.users.setRole({ userId: 2, role: "systeme" })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.setUserRole).toHaveBeenCalledWith(2, "systeme");
  });

  it("laisse un compte système rétrograder un AUTRE compte système", async () => {
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount, { ...systemAccount, id: 4, openId: "local_sys2" }]));
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(
      caller.users.setRole({ userId: 4, role: "cadre" })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.setUserRole).toHaveBeenCalledWith(4, "cadre");
  });

  it("refuse de rétrograder le DERNIER compte système de l’instance", async () => {
    // Garde-fou d’exploitation : sans administrateur système, plus personne ne
    // peut entrer dans la console ni en nommer un.
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount]));
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(
      caller.users.setRole({ userId: 3, role: "cadre" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("n’autorise pas un compte système à promouvoir un membre du métier", async () => {
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(
      caller.users.setRole({ userId: 2, role: "admin" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("refuse le rôle portail client (il s’attribue depuis la fiche client)", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.setRole({ userId: 2, role: "client" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });
});

describe("users.invite", () => {
  it("RETOURNÉ — un admin n’invite plus avec le rôle système", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.invite({ email: "sys@x.com", role: "systeme" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("laisse un compte système inviter avec le rôle système", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    const result = await caller.users.invite({ email: "sys@x.com", role: "systeme" });
    expect(result).toMatchObject({ success: true, role: "systeme", email: "sys@x.com" });
    expect(mocks.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ email: "sys@x.com", role: "systeme" })
    );
  });

  it("refuse toujours l’invitation d’un accès portail client", async () => {
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.invite({ email: "cli@x.com", role: "client" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createInvitation).not.toHaveBeenCalled();
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

  it("RETOURNÉ — un admin ne supprime plus un compte système", async () => {
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount, { ...systemAccount, id: 4, openId: "local_sys2" }]));
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(caller.users.remove({ userId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("laisse un compte système supprimer un autre compte système", async () => {
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount, { ...systemAccount, id: 4, openId: "local_sys2" }]));
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(caller.users.remove({ userId: 4 })).resolves.toMatchObject({ success: true });
    expect(mocks.deleteUser).toHaveBeenCalledWith(4);
  });

  it("refuse de supprimer le DERNIER compte système de l’instance", async () => {
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount]));
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(caller.users.remove({ userId: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
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

  it("RETOURNÉ — un admin ne réinitialise plus le mot de passe d’un compte système", async () => {
    // Sinon l’admin prendrait la main sur le compte système, donc sur la console.
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount]));
    const caller = appRouter.createCaller(ctxFor("local_a", "admin", 1));
    await expect(
      caller.users.resetPassword({ userId: 3, newPassword: "NouveauMot123" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resetUserPassword).not.toHaveBeenCalled();
  });

  it("laisse un compte système réinitialiser le mot de passe d’un compte système", async () => {
    mocks.listUsers.mockResolvedValue(staffFixture([systemAccount, { ...systemAccount, id: 4, openId: "local_sys2" }]));
    const caller = appRouter.createCaller(ctxFor("local_sys", "systeme", 3));
    await expect(
      caller.users.resetPassword({ userId: 4, newPassword: "NouveauMot123" })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.resetUserPassword).toHaveBeenCalled();
  });
});
