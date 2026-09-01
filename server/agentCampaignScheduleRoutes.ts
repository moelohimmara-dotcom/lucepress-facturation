import type { Express, Request, Response } from "express";
import { deliverScheduledAgentCampaignToTestInbox, getAgentCampaignByScheduleTaskUid } from "./db";

export function registerAgentCampaignScheduleRoutes(app: Express) {
  app.post("/api/scheduled/agent-test-email", async (req: Request, res: Response) => {
    try {
      // Route déclenchée par le planificateur interne (heartbeat cron). Pas d'auth
      // externe : le serveur s'appelle lui-même. On récupère le tenant de la campagne
      // pour étiqueter les écritures sans fuite inter-tenant.
      const taskUid = (req.body?.taskUid ?? req.query?.taskUid) as string | undefined;
      if (!taskUid) return res.status(400).json({ error: "taskUid requis" });
      const record = await getAgentCampaignByScheduleTaskUid(taskUid);
      if (!record) return res.status(404).json({ error: "Campagne introuvable" });
      const tenantId = record.campaign?.tenantId ?? null;
      const result = await deliverScheduledAgentCampaignToTestInbox(taskUid, tenantId);
      return res.json({ ok: true, ...result, externalDispatch: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue du traitement e-mail de test.";
      return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
    }
  });
}
