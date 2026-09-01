import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), getProjectCostById: vi.fn(), createProjectCostAttachment: vi.fn(), storagePut: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getProjectCostById: mocks.getProjectCostById, createProjectCostAttachment: mocks.createProjectCostAttachment }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
import { registerProjectCostAttachmentRoutes } from "./projectCostAttachments";

type CapturedHandler = (req: any, res: any) => Promise<unknown>;
let handler: CapturedHandler;
function registerRoute() { const app = { post: (_path: string, ...handlers: unknown[]) => { handler = handlers.at(-1) as CapturedHandler; } }; registerProjectCostAttachmentRoutes(app as any); }
function response() { return { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } }; }
function request() { return { header: (name: string) => ({ "x-project-cost-id": "8", "x-file-name": "facture-achat.pdf", "content-type": "application/pdf" }[name.toLowerCase()] || undefined), body: Buffer.from("pdf") }; }

describe("route de justificatifs de coûts", () => {
  it("refuse un dépôt non administrateur", async () => { registerRoute(); mocks.authenticateRequest.mockResolvedValueOnce({ id: 4, role: "cadre", tenantId: 1 }); const res = response(); await handler(request(), res); expect(res.statusCode).toBe(401); });
  it("refuse un coût introuvable", async () => { registerRoute(); mocks.authenticateRequest.mockResolvedValueOnce({ id: 4, role: "admin", tenantId: 1 }); mocks.getProjectCostById.mockResolvedValueOnce(null); const res = response(); await handler(request(), res); expect(res.statusCode).toBe(400); });
  it("stocke uniquement les métadonnées après un dépôt valide", async () => { registerRoute(); mocks.authenticateRequest.mockResolvedValueOnce({ id: 4, role: "admin", tenantId: 1 }); mocks.getProjectCostById.mockResolvedValueOnce({ id: 8, projectId: 2 }); mocks.storagePut.mockResolvedValueOnce({ key: "project-cost-attachments/2/8/facture.pdf", url: "/manus-storage/project-cost-attachments/2/8/facture.pdf" }); mocks.createProjectCostAttachment.mockResolvedValueOnce({ id: 9 }); const res = response(); await handler(request(), res); expect(res.statusCode).toBe(201); expect(mocks.createProjectCostAttachment).toHaveBeenCalledWith(expect.objectContaining({ projectCostId: 8, createdById: 4, contentType: "application/pdf" })); });
});
