import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getClientPortalOverview: vi.fn(async () => ({ client: null, invoices: [], quotes: [] })),
    getClientPortalQuote: vi.fn(async () => null),
    getClientPortalInvoice: vi.fn(async () => null),
    getCompanySettings: vi.fn(async () => ({
      legalName: "Lucepress Sarl",
      legalAddress: "Conakry, Guinée",
      phone: "+224 624 19 06 20",
      email: "Lucepres@gmail.com",
    })),
    respondToClientPortalQuote: vi.fn(),
    createClientPaymentPromise: vi.fn(),
  };
});

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function clientCtx(): TrpcContext {
  return {
    user: { openId: "client-1", email: "client@example.com", role: "client", name: "Client", id: 9 } as any,
    tenantId: 1,
    req: { headers: {}, protocol: "https", get: () => undefined } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

const sampleInvoice = {
  id: 42,
  kind: "facture" as const,
  number: "FAC-2026-0042",
  status: "envoye",
  issueDate: "2026-09-13T00:00:00.000Z",
  dueDate: "2026-10-13T00:00:00.000Z",
  validUntil: null,
  clientName: "Client Exemple",
  contactName: null,
  clientAddress: "Conakry",
  clientEmail: "client@example.com",
  clientIdentityKind: null,
  clientTaxId: null,
  clientRegistrationNumber: null,
  projectName: null,
  notes: "Paiement sous 30 jours.",
  discountPercent: null,
  discountAmount: null,
  depositPercent: null,
  depositDueDate: null,
  balanceDueDate: null,
  paidAmount: 0,
  balanceDue: 5000000,
  subtotal: 5000000,
  taxTotal: 0,
  total: 5000000,
  lines: [
    { description: "Forage tubulaire", quantity: 1, unit: "pu", unitPrice: 5000000, lineTotal: 5000000, taxRate: 0, position: 0 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCompanySettings.mockResolvedValue({ legalName: "Lucepress Sarl" });
});

describe("portail client — exportFile (PDF serveur)", () => {
  it("génère un PDF valide pour une facture appartenant au client", async () => {
    mocks.getClientPortalInvoice.mockResolvedValueOnce(sampleInvoice);
    const caller = appRouter.createCaller(clientCtx());
    const res = await caller.billing.clientPortal.exportFile({ id: 42, kind: "facture", format: "pdf" });
    expect(res.mime).toBe("application/pdf");
    expect(res.filename).toBe("FAC-2026-0042.pdf");
    const buf = Buffer.from(res.base64, "base64");
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(mocks.getClientPortalInvoice).toHaveBeenCalledWith("client@example.com", 42);
  });

  it("génère un DOCX valide pour une facture appartenant au client", async () => {
    mocks.getClientPortalInvoice.mockResolvedValueOnce(sampleInvoice);
    const caller = appRouter.createCaller(clientCtx());
    const res = await caller.billing.clientPortal.exportFile({ id: 42, kind: "facture", format: "docx" });
    expect(res.mime).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(res.filename).toBe("FAC-2026-0042.docx");
    const buf = Buffer.from(res.base64, "base64");
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("refuse l'accès à un document n'appartenant pas au client (sécurité)", async () => {
    mocks.getClientPortalInvoice.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(clientCtx());
    await expect(caller.billing.clientPortal.exportFile({ id: 999, kind: "facture", format: "pdf" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("génère un PDF de devis appartenant au client", async () => {
    mocks.getClientPortalQuote.mockResolvedValueOnce({ ...sampleInvoice, kind: "devis", number: "DEV-2026-0007" });
    const caller = appRouter.createCaller(clientCtx());
    const res = await caller.billing.clientPortal.exportFile({ id: 7, kind: "devis", format: "pdf" });
    expect(res.filename).toBe("DEV-2026-0007.pdf");
    expect(Buffer.from(res.base64, "base64").subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(mocks.getClientPortalQuote).toHaveBeenCalledWith("client@example.com", 7);
  });
});
