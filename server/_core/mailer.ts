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

import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";

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

export function getDefaultFrom(): string {
  if (fromEnv) return fromEnv;
  if (user) return `"Lucepress" <${user}>`;
  return "Lucepress <noreply@lucepress.local>";
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

export async function sendMail(options: SendMailOptions) {
  if (!transporter) {
    throw new Error(
      "Le serveur SMTP n’est pas configuré. Vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.",
    );
  }
  const { from, ...rest } = options;
  const info = await transporter.sendMail({
    ...rest,
    from: from ?? getDefaultFrom(),
  });
  console.log(`[mailer] Envoyé: ${info.messageId}`);
  return info;
}
