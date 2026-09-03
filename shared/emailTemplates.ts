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

export const EMAIL_TEMPLATES: readonly EmailTemplate[] = [
  {
    id: "invitation",
    name: "Invitation collaborateur",
    description: "E-mail envoyé pour inviter un nouveau collaborateur à rejoindre l'organisation.",
    subject: "Invitation à rejoindre {{organization}}",
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6faf8; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Invitation à rejoindre {{organization}}</h1>
    <p>Bonjour,</p>
    <p>{{inviterName}} vous a invité(e) à rejoindre <strong>{{organization}}</strong> sur Lucepres.</p>
    <p style="text-align: center;">
      <a href="{{inviteLink}}" class="button">Accepter l'invitation</a>
    </p>
    <p>Ce lien expire le <strong>{{expiresAt}}</strong>.</p>
    <div class="footer">
      <p>Si vous n'attendez pas cette invitation, vous pouvez ignorer cet e-mail.</p>
    </div>
  </div>
</body>
</html>`,
    text: `Bonjour,

{{inviterName}} vous a invité(e) à rejoindre {{organization}} sur Lucepres.

Cliquez ici pour accepter : {{inviteLink}}

Ce lien expire le {{expiresAt}}.

Si vous n'attendez pas cette invitation, ignorez cet e-mail.`,
    variables: ["inviterName", "inviteLink", "organization", "expiresAt"],
  },
  {
    id: "password-reset",
    name: "Réinitialisation du mot de passe",
    description: "E-mail envoyé lorsqu'un utilisateur demande à réinitialiser son mot de passe.",
    subject: "Réinitialisez votre mot de passe Lucepres",
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6faf8; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Réinitialisation du mot de passe</h1>
    <p>Bonjour,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe Lucepres.</p>
    <p style="text-align: center;">
      <a href="{{resetLink}}" class="button">Réinitialiser mon mot de passe</a>
    </p>
    <p>Ce lien expire dans 1 heure.</p>
    <div class="footer">
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
    </div>
  </div>
</body>
</html>`,
    text: `Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe Lucepres.

Cliquez ici : {{resetLink}}

Ce lien expire dans 1 heure.

Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    variables: ["resetLink"],
  },
  {
    id: "quote-sent",
    name: "Devis envoyé",
    description: "E-mail envoyé au client lorsqu'un devis est prêt à être consulté.",
    subject: "Votre devis {{documentNumber}} est prêt",
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6faf8; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .details { background: #f6faf8; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .details strong { color: #113b35; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Votre devis est prêt</h1>
    <p>Bonjour {{clientName}},</p>
    <p>Nous avons le plaisir de vous transmettre votre devis <strong>{{documentNumber}}</strong>.</p>
    <div class="details">
      <p><strong>Montant :</strong> {{amount}} GNF</p>
      <p><strong>Date d'échéance :</strong> {{dueDate}}</p>
      <p><strong>Valable jusqu'au :</strong> {{validUntil}}</p>
    </div>
    <p style="text-align: center;">
      <a href="{{documentLink}}" class="button">Consulter le devis</a>
    </p>
    <p style="text-align: center; font-size: 13px;"><a href="{{pdfDownloadLink}}" style="color: #113b35;">Télécharger le PDF</a></p>
    <div class="footer">
      <p>Ce lien personnel expire le <strong>{{linkExpiresAt}}</strong>. Pour toute question, contactez-nous à {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
    text: `Bonjour {{clientName}},

Nous avons le plaisir de vous transmettre votre devis {{documentNumber}}.

Montant : {{amount}} GNF
Date d'échéance : {{dueDate}}
Valable jusqu'au : {{validUntil}}

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
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6faf8; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .details { background: #f6faf8; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .details strong { color: #113b35; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Votre facture</h1>
    <p>Bonjour {{clientName}},</p>
    <p>Veuillez trouver ci-joint votre facture <strong>{{documentNumber}}</strong>.</p>
    <div class="details">
      <p><strong>Montant total :</strong> {{amount}} GNF</p>
      <p><strong>Date d'échéance :</strong> {{dueDate}}</p>
      <p><strong>Mode de paiement :</strong> {{paymentMethod}}</p>
    </div>
    <p style="text-align: center;">
      <a href="{{documentLink}}" class="button">Consulter la facture</a>
    </p>
    <p style="text-align: center; font-size: 13px;"><a href="{{pdfDownloadLink}}" style="color: #113b35;">Télécharger le PDF</a></p>
    <div class="footer">
      <p>Merci de régler avant le {{dueDate}}. Lien valable jusqu’au <strong>{{linkExpiresAt}}</strong>. Pour toute question, contactez-nous à {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
    text: `Bonjour {{clientName}},

Veuillez trouver ci-joint votre facture {{documentNumber}}.

Montant total : {{amount}} GNF
Date d'échéance : {{dueDate}}
Mode de paiement : {{paymentMethod}}

Consulter la facture : {{documentLink}}
Télécharger le PDF : {{pdfDownloadLink}}

Merci de régler avant le {{dueDate}}. Lien valable jusqu’au {{linkExpiresAt}}.
Pour toute question, contactez-nous à {{companyEmail}}.`,
    variables: ["clientName", "documentNumber", "amount", "dueDate", "paymentMethod", "documentLink", "pdfDownloadLink", "companyEmail", "organization", "linkExpiresAt"],
  },
  {
    id: "payment-reminder",
    name: "Rappel de paiement",
    description: "E-mail de relance envoyé lorsqu'un paiement est en retard.",
    subject: "Rappel - Facture {{documentNumber}} en attente",
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6faf8; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .details { background: #f6faf8; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .details strong { color: #113b35; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Rappel de paiement</h1>
    <p>Bonjour {{clientName}},</p>
    <p>Nous vous informons que la facture <strong>{{documentNumber}}</strong> est en attente de règlement.</p>
    <div class="details">
      <p><strong>Montant dû :</strong> {{amount}} GNF</p>
      <p><strong>Date d'échéance :</strong> {{dueDate}}</p>
      <p><strong>Jours de retard :</strong> {{daysOverdue}}</p>
    </div>
    <p style="text-align: center;">
      <a href="{{documentLink}}" class="button">Consulter la facture</a>
    </p>
    <div class="footer">
      <p>Merci de régler dans les meilleurs délais. Pour toute question, contactez-nous à {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
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
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f6faf8; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }
    p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Bienvenue sur {{organization}}</h1>
    <p>Bonjour {{userName}},</p>
    <p>Votre compte a été créé avec succès sur Lucepres.</p>
    <p style="text-align: center;">
      <a href="{{loginLink}}" class="button">Se connecter</a>
    </p>
    <div class="footer">
      <p>Pour toute question, contactez-nous à {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
    text: `Bonjour {{userName}},

Votre compte a été créé avec succès sur Lucepres.

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
