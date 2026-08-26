import { describe, expect, it } from "vitest";
import { getIntegrationSecretConfiguration, requireIntegrationSecret } from "./integrations/secretConfiguration";

describe("configuration des secrets d’intégration", () => {
  it("désactive les flux OAuth et webhook tant que les secrets ne sont pas renseignés", () => {
    expect(getIntegrationSecretConfiguration({})).toEqual({ googleOAuthConfigured: false, whatsappWebhookConfigured: false });
    expect(() => requireIntegrationSecret(undefined, "Le secret client OAuth Google")).toThrow("reste désactivé");
  });

  it("ne révèle aucun secret dans l’état de disponibilité", () => {
    expect(getIntegrationSecretConfiguration({ GOOGLE_OAUTH_CLIENT_SECRET: "google-private", WHATSAPP_APP_SECRET: "meta-private", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-private" })).toEqual({ googleOAuthConfigured: true, whatsappWebhookConfigured: true });
  });
});
