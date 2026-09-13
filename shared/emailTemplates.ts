export type EmailTemplateCategory = "invitation" | "password-reset" | "quote-sent" | "invoice-sent" | "payment-reminder" | "welcome";

export type EmailTemplate = {
  id: EmailTemplateCategory;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
};

const BRAND = "#113b35";
const BRAND_DARK = "#0c2a25";
const ACCENT = "#c79a3a";
const INK = "#1f2a27";
const INK_SOFT = "#5b6964";
const IVORY = "#f8f4ea";
const LINE = "#e7e2d4";

function emailShell({ heroKicker, heroTitle, bodyHtml, accentBar = true }: { heroKicker: string; heroTitle: string; bodyHtml: string; accentBar?: boolean }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>${heroTitle}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin: 0; padding: 0; width: 100% !important; background: ${IVORY}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${INK}; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: ${BRAND}; text-decoration: none; }
    .button { display: inline-block; padding: 15px 34px; background: ${BRAND}; color: #fff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 0.01em; }
    .button:hover { background: ${BRAND_DARK}; }
    .kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: ${ACCENT}; margin: 0 0 10px; }
    .h1 { font-size: 26px; line-height: 1.25; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.01em; }
    .h2 { font-size: 20px; line-height: 1.3; font-weight: 700; color: ${BRAND}; margin: 0 0 14px; letter-spacing: -0.01em; }
    p { margin: 0 0 14px; line-height: 1.65; font-size: 15px; }
    .lede { font-size: 16px; line-height: 1.6; }
    .muted { color: ${INK_SOFT}; font-size: 14px; }
    .detail-row { padding: 11px 0; border-bottom: 1px solid ${LINE}; }
    .detail-row:last-child { border-bottom: 0; }
    .detail-label { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_SOFT}; }
    .detail-value { font-size: 15px; font-weight: 700; color: ${INK}; }
    .detail-value.mono { font-family: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace; }
    @media only screen and (max-width: 560px) {
      .container { width: 100% !important; padding: 0 !important; }
      .hero-pad { padding: 30px 22px !important; }
      .body-pad { padding: 28px 22px !important; }
      .h1 { font-size: 22px !important; }
      .h2 { font-size: 18px !important; }
      .button { width: 100% !important; display: block !important; text-align: center !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};">
    <tr><td align="center" style="padding: 28px 12px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow: 0 14px 40px -22px rgba(17,59,53,0.28); border:1px solid ${LINE};">
        <tr><td class="hero-pad" style="background: linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%); padding: 36px 44px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:46px; height:46px; background:#ffffff; border-radius:12px; text-align:center; vertical-align:middle; color:${BRAND}; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight:700; font-size:26px; line-height:46px;">L</td>
                  <td style="padding-left:14px; vertical-align:middle; font-size:13px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#dfe7e3;">Lucepress Sarl</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding-top:26px;">
              <p class="kicker" style="color:${ACCENT};">${heroKicker}</p>
              <h1 class="h1">${heroTitle}</h1>
            </td></tr>
          </table>
        </td></tr>
        ${accentBar ? `<tr><td style="height:4px; background:${ACCENT}; line-height:4px; font-size:4px;">&nbsp;</td></tr>` : ""}
        <tr><td class="body-pad" style="padding:34px 44px 30px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:22px 44px 30px; background:#f5f1e6; border-top:1px solid ${LINE};">
          <p style="margin:0; font-size:12px; line-height:1.6; color:${INK_SOFT};">
            <strong style="color:${BRAND};">Lucepress Sarl</strong> &middot; Conakry, Guinée<br>
            Cet e-mail vous a été envoyé par Lucepress. Si vous n'attendiez pas ce message, vous pouvez l'ignorer en toute sécurité.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string, mono = false): string {
  return `<tr><td class="detail-row"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle;"><span class="detail-label">${label}</span></td>
    <td align="right" style="vertical-align:middle;"><span class="detail-value${mono ? " mono" : ""}">${value}</span></td>
  </tr></table></td></tr>`;
}

export const EMAIL_TEMPLATES: readonly EmailTemplate[] = [
  {
    id: "invitation",
    name: "Invitation collaborateur",
    description: "E-mail envoyé pour inviter un nouveau collaborateur à rejoindre l'organisation.",
    subject: "Invitation à rejoindre {{organization}}",
    html: emailShell({
      heroKicker: "Invitation",
      heroTitle: "Rejoignez {{organization}}",
      bodyHtml: `
        <p class="lede">Bonjour,</p>
        <p>{{inviterName}} vous invite à rejoindre l'espace de gestion commerciale de <strong style="color:${BRAND};">{{organization}}</strong> sur Lucepress.</p>
        <p class="muted">Vous pourrez accéder aux devis, factures et au suivi des chantiers partagés avec vous.</p>
        <div style="text-align:center; margin:28px 0 10px;">
          <a href="{{inviteLink}}" class="button">Accepter l'invitation</a>
        </div>
        <p style="word-break:break-all; text-align:center; font-size:12px; color:${INK_SOFT};">ou copiez ce lien :<br><span style="font-family:'SF Mono',Menlo,Consolas,monospace;">{{inviteLink}}</span></p>
        <p class="muted" style="margin-top:22px;">Ce lien expire le <strong>{{expiresAt}}</strong>.</p>
      `,
    }),
    text: `Bonjour,

{{inviterName}} vous invite à rejoindre {{organization}} sur Lucepress.

Accepter l'invitation (lien valable jusqu'au {{expiresAt}}) :
{{inviteLink}}

Si vous ne voyez pas cet e-mail dans votre boîte de réception, vérifiez le dossier spam / indésirables.
Si vous n'attendez pas cette invitation, ignorez cet e-mail.`,
    variables: ["inviterName", "organization", "inviteLink", "expiresAt"],
  },
  {
    id: "password-reset",
    name: "Réinitialisation du mot de passe",
    description: "E-mail envoyé lorsqu'un utilisateur demande à réinitialiser son mot de passe.",
    subject: "Réinitialisez votre mot de passe Lucepress",
    html: emailShell({
      heroKicker: "Sécurité",
      heroTitle: "Réinitialisation du mot de passe",
      bodyHtml: `
        <p class="lede">Bonjour,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe Lucepress.</p>
        <p class="muted">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.</p>
        <div style="text-align:center; margin:28px 0 18px;">
          <a href="{{resetLink}}" class="button">Réinitialiser mon mot de passe</a>
        </div>
        <p class="muted">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe restera inchangé.</p>
      `,
    }),
    text: `Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe Lucepress.

Réinitialiser (lien valable 1 heure) :
{{resetLink}}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    variables: ["resetLink"],
  },
  {
    id: "quote-sent",
    name: "Devis envoyé",
    description: "E-mail envoyé au client lorsqu'un devis est prêt à être consulté.",
    subject: "Votre devis {{documentNumber}} est prêt",
    html: emailShell({
      heroKicker: "Devis",
      heroTitle: "Votre devis est prêt",
      bodyHtml: `
        <p class="lede">Bonjour {{clientName}},</p>
        <p>Nous avons le plaisir de vous transmettre votre devis <strong style="color:${BRAND};">{{documentNumber}}</strong>.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0; background:${IVORY}; border:1px solid ${LINE}; border-radius:12px;">
          <tr><td style="padding:8px 20px;">
            ${detailRow("Montant TTC", "{{amount}} GNF", true)}
            ${detailRow("Date d'échéance", "{{dueDate}}")}
            ${detailRow("Valide jusqu'au", "{{validUntil}}")}
          </td></tr>
        </table>
        <div style="text-align:center; margin:26px 0 12px;">
          <a href="{{documentLink}}" class="button">Consulter le devis</a>
        </div>
        <p style="text-align:center; margin:0 0 8px;"><a href="{{pdfDownloadLink}}" style="color:${BRAND}; font-weight:600; font-size:14px;">Télécharger le PDF</a></p>
        <p class="muted" style="margin-top:18px;">Ce lien personnel expire le <strong>{{linkExpiresAt}}</strong>. Pour toute question, contactez-nous à {{companyEmail}}.</p>
      `,
    }),
    text: `Bonjour {{clientName}},

Nous avons le plaisir de vous transmettre votre devis {{documentNumber}}.

Montant TTC : {{amount}} GNF
Date d'échéance : {{dueDate}}
Valide jusqu'au : {{validUntil}}

Consulter le devis : {{documentLink}}
Télécharger le PDF : {{pdfDownloadLink}}

Ce lien personnel expire le {{linkExpiresAt}}.
Pour toute question, contactez-nous à {{companyEmail}}.`,
    variables: ["clientName", "documentNumber", "amount", "dueDate", "validUntil", "documentLink", "pdfDownloadLink", "companyEmail", "linkExpiresAt"],
  },
  {
    id: "invoice-sent",
    name: "Facture envoyée",
    description: "E-mail envoyé au client lorsqu'une facture est émise.",
    subject: "Facture {{documentNumber}} - {{organization}}",
    html: emailShell({
      heroKicker: "Facture",
      heroTitle: "Votre facture est disponible",
      bodyHtml: `
        <p class="lede">Bonjour {{clientName}},</p>
        <p>Veuillez trouver ci-joint votre facture <strong style="color:${BRAND};">{{documentNumber}}</strong>.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0; background:${IVORY}; border:1px solid ${LINE}; border-radius:12px;">
          <tr><td style="padding:8px 20px;">
            ${detailRow("Montant total TTC", "{{amount}} GNF", true)}
            ${detailRow("Date d'échéance", "{{dueDate}}")}
            ${detailRow("Mode de paiement", "{{paymentMethod}}")}
          </td></tr>
        </table>
        <div style="text-align:center; margin:26px 0 12px;">
          <a href="{{documentLink}}" class="button">Consulter la facture</a>
        </div>
        <p style="text-align:center; margin:0 0 8px;"><a href="{{pdfDownloadLink}}" style="color:${BRAND}; font-weight:600; font-size:14px;">Télécharger le PDF</a></p>
        <p class="muted" style="margin-top:18px;">Merci de régler avant le <strong>{{dueDate}}</strong>. Lien valable jusqu'au <strong>{{linkExpiresAt}}</strong>. Pour toute question, contactez-nous à {{companyEmail}}.</p>
      `,
    }),
    text: `Bonjour {{clientName}},

Veuillez trouver ci-joint votre facture {{documentNumber}}.

Montant total TTC : {{amount}} GNF
Date d'échéance : {{dueDate}}
Mode de paiement : {{paymentMethod}}

Consulter la facture : {{documentLink}}
Télécharger le PDF : {{pdfDownloadLink}}

Merci de régler avant le {{dueDate}}. Lien valable jusqu'au {{linkExpiresAt}}.
Pour toute question, contactez-nous à {{companyEmail}}.`,
    variables: ["clientName", "documentNumber", "amount", "dueDate", "paymentMethod", "documentLink", "pdfDownloadLink", "companyEmail", "organization", "linkExpiresAt"],
  },
  {
    id: "payment-reminder",
    name: "Rappel de paiement",
    description: "E-mail de relance envoyé lorsqu'un paiement est en retard.",
    subject: "Rappel - Facture {{documentNumber}} en attente",
    html: emailShell({
      heroKicker: "Relance de paiement",
      heroTitle: "Échéance de la facture {{documentNumber}}",
      bodyHtml: `
        <p class="lede">Bonjour {{clientName}},</p>
        <p>Nous vous informons que la facture <strong style="color:${BRAND};">{{documentNumber}}</strong> est en attente de règlement.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0; background:#fdf3e0; border:1px solid #e8d49a; border-radius:12px;">
          <tr><td style="padding:8px 20px;">
            ${detailRow("Montant dû", "{{amount}} GNF", true)}
            ${detailRow("Date d'échéance", "{{dueDate}}")}
            ${detailRow("Jours de retard", "{{daysOverdue}}")}
          </td></tr>
        </table>
        <div style="text-align:center; margin:26px 0 18px;">
          <a href="{{documentLink}}" class="button">Consulter la facture</a>
        </div>
        <p class="muted">Merci de régler dans les meilleurs délais. Pour toute question, contactez-nous à {{companyEmail}}.</p>
      `,
    }),
    text: `Bonjour {{clientName}},

Nous vous informons que la facture {{documentNumber}} est en attente de règlement.

Montant dû : {{amount}} GNF
Date d'échéance : {{dueDate}}
Jours de retard : {{daysOverdue}}

Consulter la facture : {{documentLink}}

Merci de régler dans les meilleurs délais. Pour toute question, contactez-nous à {{companyEmail}}.`,
    variables: ["clientName", "documentNumber", "amount", "dueDate", "daysOverdue", "documentLink", "companyEmail"],
  },
  {
    id: "welcome",
    name: "Bienvenue",
    description: "E-mail de bienvenue envoyé lors de la création d'un nouveau compte.",
    subject: "Bienvenue sur {{organization}}",
    html: emailShell({
      heroKicker: "Bienvenue",
      heroTitle: "Votre compte Lucepress est prêt",
      bodyHtml: `
        <p class="lede">Bonjour {{userName}},</p>
        <p>Votre compte a été créé avec succès sur <strong style="color:${BRAND};">{{organization}}</strong>.</p>
        <p class="muted">Vous pouvez désormais accéder à votre espace de gestion commerciale.</p>
        <div style="text-align:center; margin:28px 0 18px;">
          <a href="{{loginLink}}" class="button">Se connecter</a>
        </div>
        <p class="muted">Pour toute question, contactez-nous à {{companyEmail}}.</p>
      `,
    }),
    text: `Bonjour {{userName}},

Votre compte a été créé avec succès sur {{organization}}.

Se connecter : {{loginLink}}

Pour toute question, contactez-nous à {{companyEmail}}.`,
    variables: ["userName", "loginLink", "companyEmail"],
  },
];

export function renderEmailTemplate(templateId: EmailTemplateCategory, variables: Record<string, string>): { subject: string; html: string; text: string } | null {
  const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  let { subject, html, text } = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
    text = text.replace(regex, value);
  }
  return { subject, html, text };
}
