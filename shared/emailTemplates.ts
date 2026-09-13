export type EmailTemplateCategory = "invitation" | "password-reset" | "quote-sent" | "invoice-sent" | "payment-reminder" | "welcome" | "payment-confirmation";

export type EmailTemplate = {
  id: EmailTemplateCategory;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
};

const BRAND = "#153f38";
const BRAND_DARK = "#0f2d28";
const BRAND_LIGHT = "#e8f2ee";
const ACCENT = "#d4a24e";
const ACCENT_SOFT = "#fbf3e2";
const INK = "#243530";
const INK_SOFT = "#63706b";
const IVORY = "#fbf8f1";
const CANVAS = "#f4ede0";
const LINE = "#e4ddcb";
const WHITE = "#ffffff";

function emailShell({ eyebrow, heroTitle, bodyHtml }: { eyebrow: string; heroTitle: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="x-apple-disable-message-reformatting">
  <title>${heroTitle}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin: 0; padding: 0; width: 100% !important; background: ${CANVAS}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${INK}; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: ${BRAND}; text-decoration: none; }
    .button { display: inline-block; padding: 16px 38px; background: ${BRAND}; color: #fff !important; text-decoration: none; border-radius: 11px; font-weight: 700; font-size: 15px; letter-spacing: 0.01em; box-shadow: 0 6px 16px -8px rgba(26,77,68,0.5); }
    .button:hover { background: ${BRAND_DARK}; }
    .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase; color: ${ACCENT}; margin: 0 0 12px; }
    .h1 { font-size: 28px; line-height: 1.2; font-weight: 800; color: ${WHITE}; margin: 0; letter-spacing: -0.015em; }
    p { margin: 0 0 16px; line-height: 1.7; font-size: 15.5px; }
    .lede { font-size: 16.5px; line-height: 1.65; color: ${INK}; }
    .muted { color: ${INK_SOFT}; font-size: 14px; line-height: 1.6; }
    .detail-card { background: ${IVORY}; border: 1px solid ${LINE}; border-radius: 14px; margin: 24px 0; }
    .detail-row { padding: 14px 22px; border-bottom: 1px solid ${LINE}; }
    .detail-row:last-child { border-bottom: 0; }
    .detail-label { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${INK_SOFT}; }
    .detail-value { font-size: 15.5px; font-weight: 700; color: ${INK}; }
    .detail-value.mono { font-family: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace; }
    .detail-value.big { font-size: 18px; color: ${BRAND}; }
    .divider { height: 1px; background: ${LINE}; margin: 26px 0; border: 0; }
    .link-soft { color: ${BRAND}; font-weight: 600; font-size: 14px; text-decoration: underline; text-underline-offset: 3px; }
    @media only screen and (max-width: 580px) {
      .container { width: 100% !important; }
      .hero-pad { padding: 30px 24px !important; }
      .body-pad { padding: 30px 24px !important; }
      .footer-pad { padding: 24px !important; }
      .h1 { font-size: 23px !important; }
      .button { width: 100% !important; display: block !important; text-align: center !important; box-sizing: border-box !important; }
      .detail-row { padding: 12px 18px !important; }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
    <tr><td align="center" style="padding: 32px 14px 40px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">
        <tr><td style="padding: 0 0 14px; text-align:center;">
          <span style="font-size:12px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:${INK_SOFT};">Lucepress Sarl</span>
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${WHITE}; border-radius:20px; overflow:hidden; box-shadow: 0 18px 50px -28px rgba(17,59,53,0.32); border:1px solid ${LINE};">
            <tr><td class="hero-pad" style="background: linear-gradient(140deg, ${BRAND} 0%, ${BRAND_DARK} 100%); padding: 40px 46px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="vertical-align:middle; padding-bottom:8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:44px; height:44px; background:${WHITE}; border-radius:11px; text-align:center; vertical-align:middle; color:${BRAND}; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight:700; font-size:24px; line-height:44px;">L</td>
                    <td style="padding-left:13px; vertical-align:middle; font-size:12px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:rgba(255,255,255,0.78);">Lucepress Sarl</td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding-top:18px;">
                  <p class="eyebrow" style="color:${ACCENT};">${eyebrow}</p>
                  <h1 class="h1">${heroTitle}</h1>
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="height:5px; background:${ACCENT}; line-height:5px; font-size:5px;">&nbsp;</td></tr>
            <tr><td class="body-pad" style="padding:36px 46px 32px;">
              ${bodyHtml}
            </td></tr>
            <tr><td class="footer-pad" style="padding:26px 46px 32px; background:${BRAND_LIGHT}; border-top:1px solid ${LINE};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="vertical-align:top;">
                  <p style="margin:0 0 6px; font-size:14px; font-weight:700; color:${BRAND};">Lucepress Sarl</p>
                  <p style="margin:0; font-size:12.5px; line-height:1.65; color:${INK_SOFT};">
                    Conakry, Guinée &middot; Hydraulique &middot; Travaux &middot; Services<br>
                    Pour toute question, répondez à cet e-mail ou contactez-nous directement.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding: 18px 0 0; text-align:center;">
          <p style="margin:0; font-size:11px; line-height:1.6; color:${INK_SOFT};">
            Cet e-mail a été envoyé par Lucepress Sarl. Si vous ne l'attendiez pas, vous pouvez l'ignorer sans risque.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string, opts: { mono?: boolean; big?: boolean } = {}): string {
  const cls = opts.mono ? " mono" : opts.big ? " big" : "";
  return `<tr><td class="detail-row"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle;"><span class="detail-label">${label}</span></td>
    <td align="right" style="vertical-align:middle;"><span class="detail-value${cls}">${value}</span></td>
  </tr></table></td></tr>`;
}

export const EMAIL_TEMPLATES: readonly EmailTemplate[] = [
  {
    id: "invitation",
    name: "Invitation collaborateur",
    description: "E-mail envoyé pour inviter un nouveau collaborateur à rejoindre l'organisation.",
    subject: "Vous êtes invité à rejoindre {{organization}}",
    html: emailShell({
      eyebrow: "Invitation",
      heroTitle: "Bienvenue dans l'équipe",
      bodyHtml: `
        <p class="lede">Bonjour,</p>
        <p>{{inviterName}} vous invite à rejoindre l'espace de gestion commerciale de <strong style="color:${BRAND};">{{organization}}</strong>.</p>
        <p class="muted">Vous y retrouverez les devis, factures et le suivi des chantiers qui vous sont partagés. Tout se passe en un seul endroit, accessible à tout moment.</p>
        <div style="text-align:center; margin:30px 0 14px;">
          <a href="{{inviteLink}}" class="button">Accepter l'invitation</a>
        </div>
        <p style="text-align:center; word-break:break-all; font-size:12px; color:${INK_SOFT};">ou ouvrez ce lien :<br><span style="font-family:'SF Mono',Menlo,Consolas,monospace; color:${BRAND};">{{inviteLink}}</span></p>
        <hr class="divider">
        <p class="muted">Ce lien est valable jusqu'au <strong>{{expiresAt}}</strong>. Passé ce délai, demandez un nouvel envoi à votre équipe.</p>
      `,
    }),
    text: `Bonjour,

{{inviterName}} vous invite à rejoindre l'espace de gestion commerciale de {{organization}} sur Lucepress.

Vous y retrouverez les devis, factures et le suivi des chantiers partagés avec vous.

Accepter l'invitation (lien valable jusqu'au {{expiresAt}}) :
{{inviteLink}}

Si vous ne voyez pas cet e-mail dans votre boîte de réception, vérifiez le dossier spam / indésirables.
Si vous n'attendiez pas cette invitation, ignorez cet e-mail.`,
    variables: ["inviterName", "organization", "inviteLink", "expiresAt"],
  },
  {
    id: "password-reset",
    name: "Réinitialisation du mot de passe",
    description: "E-mail envoyé lorsqu'un utilisateur demande à réinitialiser son mot de passe.",
    subject: "Réinitialisez votre mot de passe Lucepress",
    html: emailShell({
      eyebrow: "Sécurité",
      heroTitle: "Un nouveau mot de passe ?",
      bodyHtml: `
        <p class="lede">Bonjour,</p>
        <p>Vous souhaitez réinitialiser votre mot de passe Lucepress. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
        <p class="muted">Pour votre sécurité, ce lien n'est valable qu'<strong>1 heure</strong>. Au-delà, il faudra refaire la demande.</p>
        <div style="text-align:center; margin:30px 0 18px;">
          <a href="{{resetLink}}" class="button">Réinitialiser mon mot de passe</a>
        </div>
        <hr class="divider">
        <p class="muted">Vous n'avez pas demandé cette réinitialisation ? Aucune action n'est nécessaire — votre mot de passe reste inchangé. Pensez tout de même à vérifier la sécurité de votre compte.</p>
      `,
    }),
    text: `Bonjour,

Vous souhaitez réinitialiser votre mot de passe Lucepress.

Réinitialiser (lien valable 1 heure) :
{{resetLink}}

Vous n'avez pas demandé cette réinitialisation ? Ignorez cet e-mail : votre mot de passe reste inchangé.`,
    variables: ["resetLink"],
  },
  {
    id: "quote-sent",
    name: "Devis envoyé",
    description: "E-mail envoyé au client lorsqu'un devis est prêt à être consulté.",
    subject: "Votre devis {{documentNumber}} est prêt",
    html: emailShell({
      eyebrow: "Devis",
      heroTitle: "Voici votre devis",
      bodyHtml: `
        <p class="lede">Bonjour {{clientName}},</p>
        <p>Nous avons le plaisir de vous transmettre votre devis <strong style="color:${BRAND};">{{documentNumber}}</strong>. Vous pouvez le consulter en ligne dès maintenant et y répondre directement.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="detail-card">
          <tr><td style="padding:0;">
            ${detailRow("Montant TTC", "{{amount}} GNF", { mono: true, big: true })}
            ${detailRow("Date d'échéance", "{{dueDate}}")}
            ${detailRow("Valide jusqu'au", "{{validUntil}}")}
          </td></tr>
        </table>
        <div style="text-align:center; margin:28px 0 14px;">
          <a href="{{documentLink}}" class="button">Consulter le devis</a>
        </div>
        <p style="text-align:center; margin:0 0 4px;"><a href="{{pdfDownloadLink}}" class="link-soft">Télécharger le PDF</a></p>
        <hr class="divider">
        <p class="muted">Ce lien personnel est valable jusqu'au <strong>{{linkExpiresAt}}</strong>. Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}}.</p>
      `,
    }),
    text: `Bonjour {{clientName}},

Nous avons le plaisir de vous transmettre votre devis {{documentNumber}}.

Montant TTC : {{amount}} GNF
Date d'échéance : {{dueDate}}
Valide jusqu'au : {{validUntil}}

Consulter le devis : {{documentLink}}
Télécharger le PDF : {{pdfDownloadLink}}

Ce lien est valable jusqu'au {{linkExpiresAt}}.
Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}}.`,
    variables: ["clientName", "documentNumber", "amount", "dueDate", "validUntil", "documentLink", "pdfDownloadLink", "companyEmail", "linkExpiresAt"],
  },
  {
    id: "invoice-sent",
    name: "Facture envoyée",
    description: "E-mail envoyé au client lorsqu'une facture est émise.",
    subject: "Votre facture {{documentNumber}} - Lucepress",
    html: emailShell({
      eyebrow: "Facture",
      heroTitle: "Votre facture est disponible",
      bodyHtml: `
        <p class="lede">Bonjour {{clientName}},</p>
        <p>Veuillez trouver ci-dessous votre facture <strong style="color:${BRAND};">{{documentNumber}}</strong>. Vous pouvez la consulter en ligne et en télécharger le PDF.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="detail-card">
          <tr><td style="padding:0;">
            ${detailRow("Montant total TTC", "{{amount}} GNF", { mono: true, big: true })}
            ${detailRow("Date d'échéance", "{{dueDate}}")}
            ${detailRow("Mode de paiement", "{{paymentMethod}}")}
          </td></tr>
        </table>
        <div style="text-align:center; margin:28px 0 14px;">
          <a href="{{documentLink}}" class="button">Consulter la facture</a>
        </div>
        <p style="text-align:center; margin:0 0 4px;"><a href="{{pdfDownloadLink}}" class="link-soft">Télécharger le PDF</a></p>
        <hr class="divider">
        <p class="muted">Merci de régler avant le <strong>{{dueDate}}</strong>. Ce lien est valable jusqu'au <strong>{{linkExpiresAt}}</strong>. Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}}.</p>
      `,
    }),
    text: `Bonjour {{clientName}},

Veuillez trouver ci-dessous votre facture {{documentNumber}}.

Montant total TTC : {{amount}} GNF
Date d'échéance : {{dueDate}}
Mode de paiement : {{paymentMethod}}

Consulter la facture : {{documentLink}}
Télécharger le PDF : {{pdfDownloadLink}}

Merci de régler avant le {{dueDate}}. Lien valable jusqu'au {{linkExpiresAt}}.
Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}}.`,
    variables: ["clientName", "documentNumber", "amount", "dueDate", "paymentMethod", "documentLink", "pdfDownloadLink", "companyEmail", "organization", "linkExpiresAt"],
  },
  {
    id: "payment-reminder",
    name: "Rappel de paiement",
    description: "E-mail de relance envoyé lorsqu'un paiement est en retard.",
    subject: "Rappel : facture {{documentNumber}} en attente",
    html: emailShell({
      eyebrow: "Relance de paiement",
      heroTitle: "Un petit rappel pour votre facture",
      bodyHtml: `
        <p class="lede">Bonjour {{clientName}},</p>
        <p>Nous vous contactons au sujet de la facture <strong style="color:${BRAND};">{{documentNumber}}</strong>, dont le règlement est en attente. Voici un récapitulatif :</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="detail-card" style="background:${ACCENT_SOFT}; border-color:#ecd9a8;">
          <tr><td style="padding:0;">
            ${detailRow("Montant dû", "{{amount}} GNF", { mono: true, big: true })}
            ${detailRow("Date d'échéance", "{{dueDate}}")}
            ${detailRow("Jours de retard", "{{daysOverdue}}")}
          </td></tr>
        </table>
        <div style="text-align:center; margin:28px 0 18px;">
          <a href="{{documentLink}}" class="button">Consulter la facture</a>
        </div>
        <hr class="divider">
        <p class="muted">Merci de régler dans les meilleurs délais. Un souci ou un délai à signaler ? Répondez à cet e-mail ou écrivez-nous à {{companyEmail}} — nous trouverons une solution ensemble.</p>
      `,
    }),
    text: `Bonjour {{clientName}},

Nous vous contactons au sujet de la facture {{documentNumber}}, dont le règlement est en attente.

Montant dû : {{amount}} GNF
Date d'échéance : {{dueDate}}
Jours de retard : {{daysOverdue}}

Consulter la facture : {{documentLink}}

Merci de régler dans les meilleurs délais. Un souci ou un délai à signaler ?
Répondez à cet e-mail ou écrivez-nous à {{companyEmail}} — nous trouverons une solution ensemble.`,
    variables: ["clientName", "documentNumber", "amount", "dueDate", "daysOverdue", "documentLink", "companyEmail"],
  },
  {
    id: "welcome",
    name: "Bienvenue",
    description: "E-mail de bienvenue envoyé lors de la création d'un nouveau compte.",
    subject: "Bienvenue sur {{organization}}",
    html: emailShell({
      eyebrow: "Bienvenue",
      heroTitle: "Votre compte est prêt",
      bodyHtml: `
        <p class="lede">Bonjour {{userName}},</p>
        <p>Votre compte a été créé avec succès sur <strong style="color:${BRAND};">{{organization}}</strong>. Vous pouvez dès maintenant accéder à votre espace de gestion commerciale.</p>
        <p class="muted">Devis, factures, suivi des paiements, relances : tout est centralisé pour vous faire gagner du temps.</p>
        <div style="text-align:center; margin:30px 0 18px;">
          <a href="{{loginLink}}" class="button">Se connecter</a>
        </div>
        <hr class="divider">
        <p class="muted">Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}}.</p>
      `,
    }),
    text: `Bonjour {{userName}},

Votre compte a été créé avec succès sur {{organization}}.

Devis, factures, suivi des paiements, relances : tout est centralisé pour vous faire gagner du temps.

Se connecter : {{loginLink}}

Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}}.`,
    variables: ["userName", "loginLink", "companyEmail"],
  },
  {
    id: "payment-confirmation",
    name: "Confirmation de paiement",
    description: "Accusé de réception envoyé au client à la confirmation d'un paiement reçu.",
    subject: "Paiement bien reçu — merci pour votre confiance",
    html: emailShell({
      eyebrow: "Accusé de réception",
      heroTitle: "Votre paiement a bien été reçu",
      bodyHtml: `
        <p class="lede">Bonjour {{clientName}},</p>
        <p>Nous confirmons avoir reçu votre règlement de <strong style="color:${BRAND};">{{amount}}</strong> pour la <strong>facture {{documentNumber}}</strong>.</p>
        <p class="muted">Merci pour votre confiance et la rapidité de votre règlement. C'est un plaisir de collaborer avec vous.</p>
        ${detailRow("Facture", "{{documentNumber}}", { mono: true })}
        ${detailRow("Montant réglé", "{{amount}}", { big: true, mono: true })}
        ${detailRow("Date", "{{paymentDate}}")}
        <hr class="divider">
        <p>Vous retrouverez l'historique de vos documents et paiements dans votre espace client. Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}} — nous trouverons une solution ensemble.</p>
      `,
    }),
    text: `Bonjour {{clientName}},

Nous confirmons avoir reçu votre règlement de {{amount}} pour la facture {{documentNumber}}.

Merci pour votre confiance et la rapidité de votre règlement.

Facture : {{documentNumber}}
Montant réglé : {{amount}}
Date : {{paymentDate}}

Pour toute question, répondez à cet e-mail ou écrivez-nous à {{companyEmail}}.`,
    variables: ["clientName", "documentNumber", "amount", "paymentDate", "companyEmail"],
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
