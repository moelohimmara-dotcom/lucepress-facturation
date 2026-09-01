/**
 * Module d'envoi d'e‑mails via le SMTP de Google (Gmail).
 *
 * Variables d’environnement requises :
 *   SMTP_HOST   – ex. smtp.gmail.com
 *   SMTP_PORT   – 465 (SSL) ou 587 (STARTTLS)
 *   SMTP_USER   – adresse Gmail
 *   SMTP_PASS   – mot de passe d’application (App‑Password)
 */

import nodemailer, { type SendMailOptions } from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

if (host && port && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
} else {
  // Aucune configuration SMTP : l’envoi échouera proprement.
  console.warn(
    "[mailer] Variables SMTP_* manquantes : les e‑mails ne seront pas envoyés.",
  );
}

export async function sendMail(options: SendMailOptions) {
  if (!transporter) {
    throw new Error(
      "Le serveur SMTP n’est pas configuré. Vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.",
    );
  }
  const info = await transporter.sendMail(options);
  console.log(`[mailer] Envoyé: ${info.messageId}`);
  return info;
}

/**
 * Template HTML pour l’invitation.
 */
export function invitationTemplate(data: {
  inviterName: string;
  inviteLink: string;
  organization: string;
  expiresAt: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6f9fc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #1a1a2e; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Invitation à rejoindre ${escapeHtml(data.organization)}</h1>
    <p>Bonjour,</p>
    <p><strong>${escapeHtml(data.inviterName)}</strong> vous invite à créer un compte sur <strong>${escapeHtml(data.organization)}</strong>.</p>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(data.inviteLink)}">Accepter l’invitation</a>
    </p>
    <p>Ce lien expirera le <strong>${escapeHtml(data.expiresAt)}</strong>.</p>
    <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="word-break:break-all; font-size:13px; color:#4f46e5;">${escapeHtml(data.inviteLink)}</p>
    <div class="footer">
      Cet e‑mail a été envoyé automatiquement. Si vous n’attendiez aucune invitation, ignorez ce message.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
