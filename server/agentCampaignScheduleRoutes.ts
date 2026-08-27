import type { Express, Request, Response } from "express";
import { deliverScheduledAgentCampaignToTestInbox } from "./db";
import { sdk } from "./_core/sdk";

export function registerAgentCampaignScheduleRoutes(app: Express) {
  app.post("/api/scheduled/agent-test-email", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const result = await deliverScheduledAgentCampaignToTestInbox(user.taskUid);
      return res.json({ ok: true, ...result, externalDispatch: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue du traitement e-mail de test.";
      return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
    }
  });
}
