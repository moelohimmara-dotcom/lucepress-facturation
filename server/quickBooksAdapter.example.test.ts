import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickBooksOnlineAdapter, type IntegrationResult, type QuickBooksConnection } from "../../lucepress-quickbooks-adapter.example.js";

const baseConnection: QuickBooksConnection = {
  id: 72,
  providerSlug: "quickbooks-online",
  status: "active",
  grantedCapabilities: ["read_company", "sync_customer", "create_invoice", "record_payment"],
  config: {
    realmId: "realm-4",
    oauthTokenUrl: "https://oauth.platform.intuit.test/oauth2/v1/tokens/bearer",
    clientIdRef: "quickbooks/client-id",
    clientSecretRef: "quickbooks/client-secret",
    accessTokenRef: "quickbooks/access-token",
    refreshTokenRef: "quickbooks/refresh-token",
    accessTokenExpiresAt: 2_000_000,
  },
};

const customer = { clientId: 9, displayName: "Entreprise Kamsar", email: "contact@kamsar.test" };
const invoice = { documentId: 18, number: "FAC-2026-0018", dueDate: "2026-09-01", currency: "GNF" as const, totalAmount: 2_500_000, lines: [{ description: "Forage", quantity: 1, unitAmount: 2_500_000, taxPercent: 18 }] };

function makeSut(overrides: Partial<{ connection: QuickBooksConnection; completed: IntegrationResult | null; mappings: Record<string, string | null>; paymentError: Error }> = {}) {
  const connection = overrides.connection ?? baseConnection;
  const client = {
    getCompanyInfo: vi.fn(async () => ({ id: "realm-4", companyName: "Lucepres Books" })),
    upsertCustomer: vi.fn(async () => ({ id: "customer-9", syncToken: "2" })),
    createInvoice: vi.fn(async () => ({ id: "invoice-18", syncToken: "3" })),
    recordPayment: vi.fn(async () => ({ id: "payment-4", syncToken: "1" })),
  };
  if (overrides.paymentError) client.recordPayment.mockRejectedValue(overrides.paymentError);

  const secrets = { get: vi.fn(async (ref: string) => ({ "quickbooks/access-token": "access-live", "quickbooks/client-id": "client", "quickbooks/client-secret": "secret", "quickbooks/refresh-token": "refresh" }[ref] ?? "")), put: vi.fn() };
  const connections = { getActive: vi.fn(async () => connection), updateTokenExpiry: vi.fn(), markDegraded: vi.fn() };
  const idempotency = { getCompleted: vi.fn(async () => overrides.completed ?? null), saveCompleted: vi.fn() };
  const mappings = { getExternalId: vi.fn(async (input: { entityType: string }) => overrides.mappings?.[input.entityType] ?? null), save: vi.fn() };
  const clientFactory = { create: vi.fn(() => client) };
  const httpFetch = vi.fn(async () => new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }), { status: 200 }));
  const adapter = new QuickBooksOnlineAdapter(secrets, connections, idempotency, mappings, clientFactory, httpFetch, () => 1_000_000);
  return { adapter, client, secrets, connections, idempotency, mappings, clientFactory, httpFetch };
}

describe("QuickBooksOnlineAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valide la santé de la connexion avec la société QuickBooks", async () => {
    const { adapter, client } = makeSut();
    await expect(adapter.healthCheck(72)).resolves.toEqual({ ok: true, externalCompanyId: "realm-4" });
    expect(client.getCompanyInfo).toHaveBeenCalledWith({ realmId: "realm-4" });
  });

  it("renouvelle le jeton OAuth expiré avant la lecture de la société", async () => {
    const expired = { ...baseConnection, config: { ...baseConnection.config, accessTokenExpiresAt: 0 } };
    const { adapter, secrets, connections, clientFactory, httpFetch } = makeSut({ connection: expired });
    await adapter.execute({ id: 1, connectionId: 72, operation: "read_company", idempotencyKey: "qbo:company:read:1", approvalId: null, payload: {} });
    expect(httpFetch).toHaveBeenCalledOnce();
    expect(secrets.put).toHaveBeenCalledWith("quickbooks/access-token", "new-access");
    expect(connections.updateTokenExpiry).toHaveBeenCalledWith(72, 4_600_000);
    expect(clientFactory.create).toHaveBeenCalledWith({ accessToken: "new-access" });
  });

  it("retourne un résultat idempotent sans appeler QuickBooks", async () => {
    const completed: IntegrationResult = { externalId: "invoice-18", status: "completed", rawResponse: { cached: true } };
    const { adapter, clientFactory, idempotency } = makeSut({ completed });
    await expect(adapter.execute({ id: 2, connectionId: 72, operation: "sync_customer", idempotencyKey: "qbo:customer:9:1", approvalId: 3, payload: { customer } })).resolves.toEqual(completed);
    expect(clientFactory.create).not.toHaveBeenCalled();
    expect(idempotency.saveCompleted).not.toHaveBeenCalled();
  });

  it("exige une approbation avant de créer une facture", async () => {
    const { adapter } = makeSut({ mappings: { customer: "customer-9" } });
    await expect(adapter.execute({ id: 3, connectionId: 72, operation: "create_invoice", idempotencyKey: "qbo:invoice:18:1", approvalId: null, payload: { customer, invoice } })).rejects.toThrow("approbation Lucepres");
  });

  it("réutilise le mapping d’une facture déjà synchronisée sans nouvel appel", async () => {
    const { adapter, client, mappings } = makeSut({ mappings: { invoice: "invoice-existing", customer: "customer-9" } });
    await expect(adapter.execute({ id: 4, connectionId: 72, operation: "create_invoice", idempotencyKey: "qbo:invoice:18:2", approvalId: 5, payload: { customer, invoice } })).resolves.toMatchObject({ externalId: "invoice-existing" });
    expect(client.createInvoice).not.toHaveBeenCalled();
    expect(mappings.save).not.toHaveBeenCalled();
  });

  it("dégrade la connexion quand le fournisseur rejette un paiement", async () => {
    const { adapter, connections } = makeSut({ mappings: { customer: "customer-9", invoice: "invoice-18" }, paymentError: new Error("429 QuickBooks") });
    const payment = { paymentId: 31, invoiceDocumentId: 18, receivedAt: "2026-08-26", amount: 500_000, method: "virement" };
    await expect(adapter.execute({ id: 5, connectionId: 72, operation: "record_payment", idempotencyKey: "qbo:payment:31:1", approvalId: 8, payload: { customer, payment } })).rejects.toThrow("429 QuickBooks");
    expect(connections.markDegraded).toHaveBeenCalledWith(72, "429 QuickBooks");
  });
});
