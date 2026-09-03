import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  let seq = 1;
  const invitations: any[] = [];
  return {
    listUsers: vi.fn(async () => []),
    getUserByEmail: vi.fn(),
    createLocalUser: vi.fn(async (input: any) => ({ id: seq++, openId: `local_${input.email}` })),
    markInvitationAccepted: vi.fn(async (tokenHash: string) => {
      const i = mocks._invitations.find(x => x.tokenHash === tokenHash);
      if (i) i.status = "accepted";
    }),
    revokeInvitation: vi.fn(async (id: number) => {
      const i = mocks._invitations.find(x => x.id === id);
      if (i) i.status = "revoked";
    }),
    createInvitation: vi.fn(async (input: any) => {
      invitations.push({
        ...input,
        id: seq++,
        status: "pending",
        expiresAt: new Date(Date.now() + 1000 * 3600 * 72),
      });
      return { id: invitations.length };
    }),
    listInvitations: vi.fn(async () => invitations.slice()),
    renderEmailTemplate: vi.fn(async () => ({
      subject: "Invitation",
      html: "<p>invite</p>",
      text: "invite",
    })),
    INVITATION_TTL_MS: 72 * 60 * 60 * 1000,
    hashPassword: vi.fn(async (plain: string) => `hash:${plain}`),
    verifyPassword: vi.fn(async (plain: string, stored: string) => stored === `hash:${plain}`),
    _invitations: invitations,
  };
});

vi.mock("./db", () => ({
  listUsers: mocks.listUsers,
  getUserByEmail: mocks.getUserByEmail,
  createLocalUser: mocks.createLocalUser,
  markInvitationAccepted: mocks.markInvitationAccepted,
  revokeInvitation: mocks.revokeInvitation,
  createInvitation: mocks.createInvitation,
  listInvitations: mocks.listInvitations,
  renderEmailTemplate: mocks.renderEmailTemplate,
  INVITATION_TTL_MS: mocks.INVITATION_TTL_MS,
  findInvitationByToken: vi.fn(async () => {
    const i = mocks._invitations.find(x => x.status === "pending");
    if (i) return { invitation: i, reason: "pending" };
    return { reason: "not_found" };
  }),
}));

vi.mock("./_core/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

const sendMailMock = vi.fn(async () => ({ messageId: "test-message-id" }));
vi.mock("./_core/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isMailConfigured: () => true,
  getDefaultFrom: () => '"Lucepress" <test@example.com>',
  verifySmtp: async () => true,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(openId: string, role: "admin" | "cadre", id = 1): TrpcContext {
  return {
    user: { openId, email: "x@lucepress.com", role, name: "X", id } as any,
    tenantId: 1,
    req: {
      headers: {},
      ip: "41.66.1.9",
      socket: { remoteAddress: "41.66.1.9" },
      protocol: "https",
      get: () => "lucepress.213.156.135.139.sslip.io",
    } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks._invitations.length = 0;
  mocks.getUserByEmail.mockResolvedValue(undefined);
  sendMailMock.mockResolvedValue({ messageId: "test-message-id" });
});

describe("users.invite (admin)", () => {
  it("génère un lien d'invitation sans stocker le token en clair", async () => {
    const caller = appRouter.createCaller(ctxFor("admin", "admin", 1));
    const res = await caller.users.invite({ email: "invite@x.com", role: "cadre" });
    expect(res.success).toBe(true);
    expect(res.emailed).toBe(true);
    expect(res.invitationLink).toContain("/invitation?token=");
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({ to: "invite@x.com" });
    const stored = mocks._invitations[0];
    expect(stored.tokenHash.startsWith("hash:")).toBe(true);
    expect(stored.tokenHash).not.toBe(res.invitationLink.split("token=")[1]);
  });

  it("refuse l'invitation d'un e-mail déjà utilisé", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: 9, email: "invite@x.com" });
    const caller = appRouter.createCaller(ctxFor("admin", "admin", 1));
    await expect(caller.users.invite({ email: "invite@x.com", role: "cadre" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("conserve l'invitation si l'envoi SMTP échoue", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP down"));
    const caller = appRouter.createCaller(ctxFor("admin", "admin", 1));
    const res = await caller.users.invite({ email: "invite@x.com", role: "cadre" });
    expect(res.success).toBe(true);
    expect(res.emailed).toBe(false);
    expect(res.emailError).toContain("SMTP down");
    expect(res.invitationLink).toContain("/invitation?token=");
    expect(mocks._invitations).toHaveLength(1);
  });
});

describe("users.acceptInvitation (public)", () => {
  it("crée le compte de l'invité avec son propre mot de passe", async () => {
    const admin = appRouter.createCaller(ctxFor("admin", "admin", 1));
    const inv = await admin.users.invite({ email: "nouveau@x.com", role: "cadre" });
    const token = inv.invitationLink.split("token=")[1];

    const caller = appRouter.createCaller(ctxFor("personne", "cadre", 99));
    const res = await caller.acceptInvitation({ token, name: "Nouveau", password: "MonMotDePasse123" });
    expect(res.success).toBe(true);
    expect(mocks.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nouveau@x.com", role: "cadre", name: "Nouveau" })
    );
    expect(mocks.markInvitationAccepted).toHaveBeenCalled();
    const hash = mocks.createLocalUser.mock.calls[0][0].passwordHash as string;
    expect(hash.startsWith("hash:")).toBe(true);
  });

  it("un token déjà utilisé est refusé (usage unique)", async () => {
    const admin = appRouter.createCaller(ctxFor("admin", "admin", 1));
    const inv = await admin.users.invite({ email: "once@x.com", role: "cadre" });
    const token = inv.invitationLink.split("token=")[1];
    const caller = appRouter.createCaller(ctxFor("p", "cadre", 5));
    await caller.acceptInvitation({ token, name: "Once", password: "MotDePasse123" });
    mocks.getUserByEmail.mockResolvedValue(undefined);
    await expect(
      caller.acceptInvitation({ token, name: "Once2", password: "MotDePasse123" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
