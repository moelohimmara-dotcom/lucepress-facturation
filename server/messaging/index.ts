/**
 * Messaging OP — SMTP actif ; WhatsApp stub (sourdine démo client non payeur).
 * Ne pas brancher l’UI WhatsApp tant que Phase 2 n’est pas validée.
 */

export type MessageChannel = "smtp" | "whatsapp";

export type DispatchPayload = {
  channel: MessageChannel;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type DispatchResult =
  | { ok: true; channel: "smtp"; providerMessageId?: string }
  | { ok: false; channel: MessageChannel; reason: string };

/** Canaux autorisés en production OP. */
export const ACTIVE_CHANNELS: ReadonlySet<MessageChannel> = new Set<MessageChannel>(["smtp"]);

export function isChannelActive(channel: MessageChannel): boolean {
  return ACTIVE_CHANNELS.has(channel);
}

/**
 * Stub WhatsApp — toujours refusé jusqu’à activation Phase 2.
 */
export async function dispatchWhatsAppStub(_payload: DispatchPayload): Promise<DispatchResult> {
  return {
    ok: false,
    channel: "whatsapp",
    reason: "WhatsApp Business est en sourdine (Phase 2 — après engagement client).",
  };
}

export async function assertSmtpOnly(channel: MessageChannel): Promise<void> {
  if (channel !== "smtp") {
    throw new Error(`Canal « ${channel} » désactivé. Utilisez SMTP pour l’envoi opérationnel.`);
  }
}
