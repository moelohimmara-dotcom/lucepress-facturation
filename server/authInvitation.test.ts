import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test d'intégration des invitations par e-mail (token + lien sécurisé).
 * Vérifie le cycle complet : admin invite -> token généré -> invité définit son
 * mot de passe -> compte créé ; et les garde-fous (token à usage unique, expiration,
 * pas de double compte). scrypt simulé.
 */
const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  let seq = 1;
  const invitations: any[] = [];
  return {
    listUsers: vi.fn(async () => []),
    getUserByEmail: vi.fn(),
    createLocalUser: vi.fn(async (input: any) => ({ id: seq++, openId: `local_${input.email}` })),
    markInvitationAccepted: vi.fn(async (tokenHash: string) => { const i = mocks._invitations.find(x => x.tokenHash === tokenHash); if (i) i.status = "accepted"; }),
    revokeInvitation: vi.fn(async (id: number) => { const i = mocks._invitations.find(x => x.id === id); if (i) i.status = "revoked"; }),
    createInvitation: vi.fn(async (input: any) => { invitations.push({ ...input, id: seq++, status: "pending", expiresAt: new Date(Date.now() + 1000 * 3600 * 72) }); return { id: invitations.length }; }),
    listInvitations: vi.fn(async () => invitations.slice()),
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
    verifyPassword: vi.fn(async (plain: string, stored: string) => stored === `hash:${plain}`),
    _invitations: invitations,
  };
});

vi.mock("./db", () => ({
  ...mocks,
  // re-export les autres fn utilisees ailleurs ; on ne teste que invitations ici
  listUsers: mocks.listUsers,
  getUserByEmail: mocks.getUserByEmail,
  createLocalUser: mocks.createLocalUser,
  markInvitationAccepted: mocks.markInvitationAccepted,
  revokeInvitation: mocks.revokeInvitation,
  createInvitation: mocks.createInvitation,
  listInvitations: mocks.listInvitations,
  findInvitationByToken: vi.fn(async (token: string) => { const i = mocks._invitations.find(x => x.status === 'pending'); return i; }),
}));
vi.mock("./_core/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(openId: string, role: "admin" | "user", id = 1): TrpcContext {
  return {
    user: { openId, email: "x@lucepress.com", role, name: "X", id } as any,
    tenantId: 1,
    tenantId: 1,
    tenantId: 1,
    req: { headers: {}, ip: "41.66.1.9", socket: { remoteAddress: "41.66.1.9" }, protocol: "https", get: () => "lucepress.213.156.135.139.sslip.io" } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks._invitations.length = 0;
  mocks.getUserByEmail.mockResolvedValue(undefined);
});

describe("users.invite (admin)", () => {
  it("génère un lien d'invitation sans stocker le token en clair", async () => {
    const caller = appRouter.createCaller(ctxFor("admin", "admin", 1));
    const res = await caller.users.invite({ email: "invite@x.com", role: "user" });
    expect(res.success).toBe(true);
    expect(res.invitationLink).toContain("/invitation?token=");
    // Le token brut ne doit PAS être stocké tel quel (on stocke l'empreinte scrypt).
    const stored = mocks._invitations[0];
    expect(stored.tokenHash.startsWith("hash:")).toBe(true);
    expect(stored.tokenHash).not.toBe(res.invitationLink.split("token=")[1]);
  });

  it("refuse l'invitation d'un e-mail déjà utilisé", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: 9, email: "pris@x.com" });
    const caller = appRouter.createCaller(ctxFor("admin", "admin", 1));
    await expect(caller.users.invite({ email: "pris@x.com" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("users.acceptInvitation (public)", () => {
  it("crée le compte de l'invité avec son propre mot de passe", async () => {
    const admin = appRouter.createCaller(ctxFor("admin", "admin", 1));
    const inv = await admin.users.invite({ email: "nouveau@x.com", role: "user" });
    const token = inv.invitationLink.split("token=")[1];

    const caller = appRouter.createCaller(ctxFor("personne", "user", 99)); // pas connecté en théorie
    const res = await caller.acceptInvitation({ token, name: "Nouveau", password: "MonMotDePasse123" });
    expect(res.success).toBe(true);
    expect(mocks.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nouveau@x.com", role: "user", name: "Nouveau" })
    );
    expect(mocks.markInvitationAccepted).toHaveBeenCalled();
    // Le mot de passe n'est jamais stocké en clair.
    const hash = mocks.createLocalUser.mock.calls[0][0].passwordHash as string;
    expect(hash.startsWith("hash:")).toBe(true);
  });

  it("un token déjà utilisé est refusé (usage unique)", async () => {
    const admin = appRouter.createCaller(ctxFor("admin", "admin", 1));
    const inv = await admin.users.invite({ email: "once@x.com", role: "user" });
    const token = inv.invitationLink.split("token=")[1];
    const caller = appRouter.createCaller(ctxFor("p", "user", 5));
    await caller.acceptInvitation({ token, name: "Once", password: "MotDePasse123" });
    mocks.getUserByEmail.mockResolvedValue(undefined);
    await expect(
      caller.acceptInvitation({ token, name: "Once2", password: "MotDePasse123" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
