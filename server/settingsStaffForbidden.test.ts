import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getCompanySettings: vi.fn(async () => ({ legalName: "Lucepres Sarl" })),
    saveCompanySettings: vi.fn(async () => ({ id: 1 })),
    listEmailTemplates: vi.fn(async () => []),
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

const settingsPayload = {
  legalName: "Lucepres Sarl",
  legalAddress: "Conakry",
  phone: "",
  email: "Lucepres@gmail.com",
  website: "",
  taxId: "",
  registrationNumber: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  swift: "",
  paymentInstructions: "",
  documentFooter: "",
};

beforeEach(() => vi.clearAllMocks());

describe("P0.1 — Paramètres / templates admin-only", () => {
  it("cadre peut lire les paramètres mais pas les enregistrer", async () => {
    const caller = appRouter.createCaller(ctxFor("cadre"));
    await expect(caller.billing.settings.get()).resolves.toMatchObject({ legalName: "Lucepres Sarl" });
    await expect(caller.billing.settings.save(settingsPayload)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.saveCompanySettings).not.toHaveBeenCalled();
  });

  it("directeur ne peut pas lister les templates e-mail", async () => {
    const caller = appRouter.createCaller(ctxFor("directeur"));
    await expect(caller.emailTemplates.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin peut enregistrer les paramètres", async () => {
    const caller = appRouter.createCaller(ctxFor("admin", 1));
    await expect(caller.billing.settings.save(settingsPayload)).resolves.toMatchObject({ id: 1 });
    expect(mocks.saveCompanySettings).toHaveBeenCalled();
  });
});
