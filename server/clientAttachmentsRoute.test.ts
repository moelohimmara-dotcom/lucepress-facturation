import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getClientById: vi.fn(),
  createClientAttachment: vi.fn(),
  storagePut: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getClientById: mocks.getClientById, createClientAttachment: mocks.createClientAttachment }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { registerClientAttachmentRoutes } from "./clientAttachments";

type CapturedHandler = (req: any, res: any) => Promise<unknown>;
let handler: CapturedHandler;

function registerRoute() {
  const app = { post: (_path: string, ...handlers: unknown[]) => { handler = handlers.at(-1) as CapturedHandler; } };
  registerClientAttachmentRoutes(app as any);
}

function response() {
  const result = { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  return result;
}

function request(overrides: Record<string, unknown> = {}) {
  return { header: (name: string) => ({ "x-client-id": "1", "x-file-name": "contrat.pdf", "content-type": "application/pdf" }[name.toLowerCase()] || undefined), body: Buffer.from("pdf"), ...overrides };
}

describe("route de pièces jointes client", () => {
  it("refuse un dépôt non authentifié", async () => {
    registerRoute(); mocks.authenticateRequest.mockResolvedValueOnce(null);
    const res = response(); await handler(request(), res);
    expect(res.statusCode).toBe(401);
  });

  it("refuse un client inexistant", async () => {
    registerRoute(); mocks.authenticateRequest.mockResolvedValueOnce({ id: 1, role: "admin" }); mocks.getClientById.mockResolvedValueOnce(undefined);
    const res = response(); await handler(request(), res);
    expect(res.statusCode).toBe(400); expect(res.body).toEqual({ error: "Le client sélectionné est introuvable." });
  });

  it("stocke les métadonnées après un dépôt valide", async () => {
    registerRoute(); mocks.authenticateRequest.mockResolvedValueOnce({ id: 1, role: "admin" }); mocks.getClientById.mockResolvedValueOnce({ id: 1 }); mocks.storagePut.mockResolvedValueOnce({ key: "client-attachments/1/contrat_a1.pdf", url: "/manus-storage/client-attachments/1/contrat_a1.pdf" }); mocks.createClientAttachment.mockResolvedValueOnce({ id: 5 });
    const res = response(); await handler(request(), res);
    expect(res.statusCode).toBe(201); expect(mocks.createClientAttachment).toHaveBeenCalledWith(expect.objectContaining({ clientId: 1, fileName: "contrat.pdf", createdById: 1 }));
  });
});
