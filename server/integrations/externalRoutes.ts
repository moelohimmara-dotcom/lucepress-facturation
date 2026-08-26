import type { Express, Request, Response } from "express";
import { getIntegrationSecretConfiguration } from "./secretConfiguration";

function unavailable(res: Response, provider: string) {
  return res.status(503).json({ error: "integration_not_configured", message: `L’intégration ${provider} est en mode préparatoire et reste désactivée tant que ses secrets serveur ne sont pas configurés.` });
}

/**
 * Les routes sont visibles afin que les URI puissent être déclarées chez les fournisseurs,
 * mais elles refusent explicitement tout flux tant que les secrets ne sont pas présents.
 * L’activation future complétera ces handlers par l’échange OAuth et la vérification HMAC.
 */
export function registerIntegrationExternalRoutes(app: Express) {
  app.get("/api/integrations/google/callback", async (req: Request, res: Response) => {
    const readiness = getIntegrationSecretConfiguration();
    if (!readiness.googleOAuthConfigured) return unavailable(res, "Google Workspace");
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const error = typeof req.query.error === "string" ? req.query.error : undefined;
    if (error) return res.status(400).json({ error: "google_authorization_denied", message: "L’autorisation Google a été refusée ou annulée." });
    if (!code || !state) return res.status(400).json({ error: "missing_oauth_parameters", message: "Le code et le state OAuth sont requis." });
    return res.status(501).json({ error: "activation_pending", message: "Le callback Google est enregistré ; son échange sécurisé sera activé après la configuration du coffre de jetons." });
  });

  app.get("/api/integrations/whatsapp/webhook", (req: Request, res: Response) => {
    const readiness = getIntegrationSecretConfiguration();
    if (!readiness.whatsappWebhookConfigured) return unavailable(res, "WhatsApp Business");
    const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : undefined;
    const verifyToken = typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : undefined;
    const challenge = typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : undefined;
    if (!mode || !verifyToken || !challenge) return res.status(400).json({ error: "missing_webhook_verification_parameters" });
    return res.status(501).json({ error: "activation_pending", message: "Le webhook WhatsApp est enregistré ; sa vérification HMAC sera activée après la configuration des secrets Meta." });
  });

  app.post("/api/integrations/whatsapp/webhook", (req: Request, res: Response) => {
    const readiness = getIntegrationSecretConfiguration();
    if (!readiness.whatsappWebhookConfigured) return unavailable(res, "WhatsApp Business");
    return res.status(501).json({ error: "activation_pending", message: "Le webhook WhatsApp est enregistré mais l’ingestion est désactivée tant que le coffre de secrets n’est pas configuré." });
  });
}
