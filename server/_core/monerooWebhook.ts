import type { Express, Request, Response } from "express";
import { verifyMonerooWebhookSignature, verifyMonerooPayment } from "./moneroo";
import { activateTenantSubscription, findSubscriptionByMonerooId } from "../subscriptionDb";

export function registerMonerooWebhookRoute(app: Express) {
  app.post("/api/webhooks/moneroo", async (req: Request, res: Response) => {
    try {
      const rawBody = JSON.stringify(req.body);
      const signature = req.headers["x-moneroo-signature"] as string | undefined;

      if (!verifyMonerooWebhookSignature(rawBody, signature)) {
        res.status(403).json({ error: "Signature invalide." });
        return;
      }

      const payload = req.body as { event?: string; data?: { id?: string } };
      if (!payload.event || !payload.data?.id) {
        res.status(400).json({ error: "Payload invalide." });
        return;
      }

      // Always re-verify with the API (best practice from Moneroo docs)
      const verified = await verifyMonerooPayment(payload.data.id);

      if (payload.event === "payment.success" && verified.status === "success") {
        const metadata = verified.metadata ?? {};
        const tenantId = Number(metadata.tenant_id);
        const plan = metadata.plan as "pro" | "enterprise" | undefined;

        if (!tenantId || !plan) {
          console.error("[Moneroo Webhook] Métadonnées manquantes:", metadata);
          res.status(200).json({ received: true, error: "metadata_missing" });
          return;
        }

        // Check if already processed (idempotency)
        const existing = await findSubscriptionByMonerooId(verified.id);
        if (existing && existing.status === "success") {
          res.status(200).json({ received: true, duplicate: true });
          return;
        }

        await activateTenantSubscription({
          tenantId,
          plan,
          monerooPaymentId: verified.id,
          amount: verified.amount,
          currency: verified.currency?.code ?? "GNF",
        });

        console.log(`[Moneroo Webhook] Abonnement activé: tenant=${tenantId} plan=${plan}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Moneroo Webhook] Erreur:", error);
      // Still return 200 to avoid retries on our internal errors
      res.status(200).json({ received: true, error: "internal" });
    }
  });
}
