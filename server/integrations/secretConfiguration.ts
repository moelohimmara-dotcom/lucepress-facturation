export function getIntegrationSecretConfiguration(environment: Record<string, string | undefined> = process.env) {
  return {
    googleOAuthConfigured: Boolean(environment.GOOGLE_OAUTH_CLIENT_SECRET),
    whatsappWebhookConfigured: Boolean(environment.WHATSAPP_APP_SECRET && environment.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
  };
}

export function requireIntegrationSecret(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} n’est pas encore configuré. Le flux externe reste désactivé.`);
  return value;
}
