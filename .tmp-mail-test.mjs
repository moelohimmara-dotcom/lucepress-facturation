import nodemailer from "nodemailer";
import "dotenv/config";

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

await t.verify();
console.log("SMTP OK");

const result = await t.sendMail({
  from: `"Lucepress" <${process.env.SMTP_USER}>`,
  to: process.env.SMTP_USER,
  subject: "[TEST] Template Invitation Lucepress",
  html: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invitation Lucepress</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f6f9fc}
  .container{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
  h1{color:#1a1a2e;font-size:24px;margin:0 0 24px}
  p{color:#444;line-height:1.6;margin:0 0 16px}
  .button{display:inline-block;padding:14px 32px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:24px 0}
  .footer{margin-top:32px;padding-top:24px;border-top:1px solid #eee;font-size:13px;color:#888}
</style>
</head>
<body>
<div class="container">
  <h1>Invitation à rejoindre Lucepress Sarl</h1>
  <p>Bonjour,</p>
  <p><strong>Admin Lucepress</strong> vous invite à créer un compte sur <strong>Lucepress Sarl</strong>.</p>
  <p style="text-align:center"><a class="button" href="https://lucepress.213.156.135.139.sslip.io/invitation?token=test123">Accepter l'invitation</a></p>
  <p>Ce lien expirera le <strong>8 septembre 2026</strong>.</p>
  <p>Si le bouton ne fonctionne pas, copiez ce lien :</p>
  <p style="word-break:break-all;font-size:13px;color:#4f46e5">https://lucepress.213.156.135.139.sslip.io/invitation?token=test123</p>
  <div class="footer">Cet e-mail a été envoyé automatiquement.</div>
</div>
</body>
</html>`,
});

console.log("ENVOYÉ:", result.messageId);
process.exit(0);
