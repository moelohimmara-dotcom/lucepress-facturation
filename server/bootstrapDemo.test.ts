import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listClients: vi.fn(),
  getCompanySettings: vi.fn(async () => ({ id: 0 })),
  saveCompanySettings: vi.fn(async () => ({})),
  createClient: vi.fn(async () => ({ id: 10 })),
  createProject: vi.fn(async () => ({ id: 20 })),
  updateProjectPlannedBudget: vi.fn(async () => ({})),
  createDocument: vi.fn(),
  updateDocumentStatus: vi.fn(async () => ({ success: true, changed: true })),
  createDepositInvoiceFromQuote: vi.fn(async () => ({ id: 31, number: "FAC-2026-0001", existing: false })),
  getDocumentById: vi.fn(async () => ({ id: 31, total: 7_650_000 })),
  recordPayment: vi.fn(async () => ({ id: 40, paidAmount: 7_650_000, balanceDue: 0, status: "paye" })),
}));

vi.mock("./db", () => mocks);

import { bootstrapDemoDataset } from "./bootstrapDemo";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const staffContext = {
  user: {
    id: 7,
    openId: "cadre-demo",
    name: "Cadre",
    email: "cadre@example.com",
    loginMethod: "manus",
    role: "cadre",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  tenantId: 1,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} as TrpcContext;

describe("bootstrapDemoDataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse de re-seed si des clients existent déjà", async () => {
    mocks.listClients.mockResolvedValueOnce([{ id: 1 }]);
    await expect(bootstrapDemoDataset(7)).resolves.toEqual({ alreadySeeded: true });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("crée le parcours SMOKE sur base vide", async () => {
    mocks.listClients.mockResolvedValueOnce([]);
    mocks.getCompanySettings.mockResolvedValueOnce({ id: 0 });
    mocks.createDocument
      .mockResolvedValueOnce({ id: 30, number: "DEV-2026-0001" })
      .mockResolvedValueOnce({ id: 32, number: "FAC-2026-0002" });

    const result = await bootstrapDemoDataset(7);

    expect(mocks.saveCompanySettings).toHaveBeenCalled();
    expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({ companyName: expect.stringMatching(/demo/i) }));
    expect(mocks.createDepositInvoiceFromQuote).toHaveBeenCalledWith(30, 7);
    expect(mocks.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ documentId: 31, amount: 7_650_000, method: "mobile_money" }));
    expect(result).toMatchObject({
      alreadySeeded: false,
      clientId: 10,
      quoteId: 30,
      quoteNumber: "DEV-2026-0001",
      depositInvoiceId: 31,
      overdueInvoiceId: 32,
    });
  });

  it("n’écrase pas les paramètres société déjà enregistrés", async () => {
    mocks.listClients.mockResolvedValueOnce([]);
    mocks.getCompanySettings.mockResolvedValueOnce({ id: 5, legalName: "Société réelle", taxId: "NIF-REEL" });
    mocks.createDocument
      .mockResolvedValueOnce({ id: 30, number: "DEV-2026-0001" })
      .mockResolvedValueOnce({ id: 32, number: "FAC-2026-0002" });

    await bootstrapDemoDataset(7);

    expect(mocks.saveCompanySettings).not.toHaveBeenCalled();
    expect(mocks.createClient).toHaveBeenCalled();
  });
});

describe("billing.bootstrapDemo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose la mutation au staff", async () => {
    mocks.listClients.mockResolvedValueOnce([{ id: 99 }]);
    const result = await appRouter.createCaller(staffContext).billing.bootstrapDemo();
    expect(result).toEqual({ alreadySeeded: true });
  });
});
