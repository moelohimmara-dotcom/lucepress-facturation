/**
 * Module d'envoi d'e‑mails via SMTP.
 *
 * Variables d’environnement :
 *   SMTP_HOST   – ex. smtp.gmail.com
 *   SMTP_PORT   – 465 (SSL) ou 587 (STARTTLS)
 *   SMTP_USER   – compte SMTP
 *   SMTP_PASS   – mot de passe / App Password
 *   SMTP_FROM   – expéditeur optionnel (sinon SMTP_USER)
 */

import nodemailer, { type Transporter } from "nodemailer";

const host = process.env.SMTP_HOST?.trim();
const port = Number(process.env.SMTP_PORT);
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const fromEnv = process.env.SMTP_FROM?.trim();

let transporter: Transporter | null = null;

if (host && Number.isFinite(port) && port > 0 && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
} else {
  console.warn(
    "[mailer] Variables SMTP_* manquantes : les e‑mails ne seront pas envoyés.",
  );
}

export function isMailConfigured(): boolean {
  return transporter !== null;
}

export function getSmtpUser(): string | undefined {
  return process.env.SMTP_USER?.trim() || undefined;
}

export function getDefaultFrom(): string {
  if (fromEnv) return fromEnv;
  if (user) return `"Lucepres" <${user}>`;
  return "Lucepres <noreply@lucepress.local>";
}

/** Vérifie la connexion SMTP au démarrage (log seulement, non bloquant). */
export async function verifySmtp(): Promise<boolean> {
  if (!transporter) return false;
  try {
    await transporter.verify();
    console.log("[mailer] Connexion SMTP OK.");
    return true;
  } catch (err) {
    console.warn("[mailer] Vérification SMTP échouée:", err instanceof Error ? err.message : err);
    return false;
  }
}

export type AppSendMailOptions = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
};

export async function sendMail(options: AppSendMailOptions) {
  if (!transporter) {
    throw new Error(
      "Le serveur SMTP n’est pas configuré. Vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.",
    );
  }
  const info = await transporter.sendMail({
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    from: options.from ?? getDefaultFrom(),
    bcc: options.bcc,
    replyTo: options.replyTo,
    attachments: options.attachments?.map(attachment => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  } as Parameters<Transporter["sendMail"]>[0]) as {
    messageId?: string;
    accepted?: unknown;
    rejected?: unknown;
    response?: string;
  };
  const rejected = Array.isArray(info.rejected) ? info.rejected.map(String) : [];
  console.log(
    `[mailer] Envoyé: ${info.messageId} → ${options.to}` +
      `${options.bcc ? ` (bcc ${Array.isArray(options.bcc) ? options.bcc.join(",") : options.bcc})` : ""}` +
      ` accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(rejected)} response=${info.response || ""}`,
  );
  if (rejected.length > 0) {
    throw new Error(`SMTP a rejeté le destinataire : ${rejected.join(", ")}`);
  }
  return info;
}
