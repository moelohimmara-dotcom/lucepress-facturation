import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    listStaffAuditJournal: vi.fn(async () => ([
      {
        id: 1,
        type: "email_envoye",
        title: "Devis envoyé par e-mail",
        description: "DEV-1 → client@example.com",
        createdAt: new Date("2026-09-03T10:00:00Z"),
        clientId: 3,
        clientName: "Bati Guinée",
        documentId: 12,
        documentNumber: "DEV-1",
        actorId: 1,
        actorName: "Admin",
      },
    ])),
  };
});

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(role: "admin" | "directeur" | "cadre", id = 2): TrpcContext {
  return {
    user: { openId: role, email: `${role}@lucepress.com`, role, name: role, id } as any,
    tenantId: 1,
    req: { headers: {}, protocol: "https", get: () => undefined } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => vi.clearAllMocks());

describe("billing.audit.list — journal staff", () => {
  it("autorise admin et directeur", async () => {
    await expect(appRouter.createCaller(ctxFor("admin", 1)).billing.audit.list()).resolves.toHaveLength(1);
    await expect(appRouter.createCaller(ctxFor("directeur")).billing.audit.list({ type: "email_envoye" })).resolves.toHaveLength(1);
    expect(mocks.listStaffAuditJournal).toHaveBeenCalledWith({ type: "email_envoye" });
  });

  it("refuse le cadre", async () => {
    await expect(appRouter.createCaller(ctxFor("cadre")).billing.audit.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listStaffAuditJournal).not.toHaveBeenCalled();
  });
});
