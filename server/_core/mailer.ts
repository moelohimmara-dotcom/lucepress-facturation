/**
 * Module d'envoi d'e‑mails via SMTP.
 *
 * Variables d’environnement requises :
 *   SMTP_HOST   – ex. smtp.gmail.com
 *   SMTP_PORT   – 465 (SSL) ou 587 (STARTTLS)
 *   SMTP_USER   – adresse Gmail
 *   SMTP_PASS   – mot de passe d’application (App‑Password)
 *
 * Les templates sont récupérés depuis la base (table email_templates).
 * En cas d'absence, un template par défaut est utilisé (voir renderEmailTemplate).
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


