import { describe, expect, it, vi } from "vitest";
import { registerIntegrationExternalRoutes } from "./integrations/externalRoutes";

const routes = vi.hoisted(() => new Map<string, (req: any, res: any) => Promise<unknown> | unknown>());

vi.mock("./integrations/secretConfiguration", () => ({ getIntegrationSecretConfiguration: () => ({ googleOAuthConfigured: false, whatsappWebhookConfigured: false }) }));

function response() {
  const state = { statusCode: 200, payload: undefined as unknown };
  return { state, status: vi.fn((code: number) => { state.statusCode = code; return { json: vi.fn((payload: unknown) => { state.payload = payload; }) }; }) };
}

describe("routes externes en mode préparatoire", () => {
  it("enregistre les callbacks attendus mais refuse OAuth et WhatsApp sans secrets", async () => {
    const app = { get: vi.fn((path: string, handler: any) => routes.set(`GET ${path}`, handler)), post: vi.fn((path: string, handler: any) => routes.set(`POST ${path}`, handler)) } as any;
    registerIntegrationExternalRoutes(app);
    expect(routes.has("GET /api/integrations/google/callback")).toBe(true);
    expect(routes.has("GET /api/integrations/whatsapp/webhook")).toBe(true);
    expect(routes.has("POST /api/integrations/whatsapp/webhook")).toBe(true);

    for (const key of ["GET /api/integrations/google/callback", "GET /api/integrations/whatsapp/webhook", "POST /api/integrations/whatsapp/webhook"]) {
      const res = response();
      await routes.get(key)?.({ query: {}, headers: {} }, res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.state.payload).toMatchObject({ error: "integration_not_configured" });
    }
  });
});
