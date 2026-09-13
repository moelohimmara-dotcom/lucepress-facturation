var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/env.ts
function requireEnv(name, value, minLen = 1) {
  if (!value || value.trim().length < minLen) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[ENV] ${name} manquant ou trop court (min ${minLen}). V\xE9rifie .env`);
    }
    console.warn(`[ENV] ${name} manquant \u2014 mode dev, valeur vide autoris\xE9e`);
    return value ?? "";
  }
  return value;
}
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: requireEnv("JWT_SECRET", process.env.JWT_SECRET, 32),
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
    };
  }
});

// server/_core/tenantContext.ts
var tenantContext_exports = {};
__export(tenantContext_exports, {
  currentTenant: () => currentTenant,
  peekTenant: () => peekTenant,
  runWithTenant: () => runWithTenant,
  tenantStorage: () => tenantStorage
});
import { AsyncLocalStorage } from "node:async_hooks";
function runWithTenant(tenantId, fn) {
  return tenantStorage.run(tenantId, fn);
}
function peekTenant() {
  const value = tenantStorage.getStore();
  return value == null ? void 0 : value;
}
function currentTenant() {
  const value = tenantStorage.getStore();
  if (value == null) {
    throw new Error("Aucun tenant dans le contexte de requ\xEAte.");
  }
  return value;
}
var tenantStorage;
var init_tenantContext = __esm({
  "server/_core/tenantContext.ts"() {
    "use strict";
    tenantStorage = new AsyncLocalStorage();
  }
});

// shared/invitationToken.ts
var invitationToken_exports = {};
__export(invitationToken_exports, {
  INVITATION_TOKEN_BYTES: () => INVITATION_TOKEN_BYTES,
  createInvitationToken: () => createInvitationToken,
  hashInvitationToken: () => hashInvitationToken,
  isPlausibleInvitationToken: () => isPlausibleInvitationToken
});
import { createHash as createHash2, randomBytes as randomBytes2 } from "node:crypto";
function createInvitationToken() {
  return randomBytes2(INVITATION_TOKEN_BYTES).toString("hex");
}
function hashInvitationToken(token) {
  return createHash2("sha256").update(token.trim().toLowerCase(), "utf8").digest("hex");
}
function isPlausibleInvitationToken(token) {
  return /^[a-f0-9]{64}$/i.test(token.trim());
}
var INVITATION_TOKEN_BYTES;
var init_invitationToken = __esm({
  "shared/invitationToken.ts"() {
    "use strict";
    INVITATION_TOKEN_BYTES = 32;
  }
});

// server/_core/password.ts
var password_exports = {};
__export(password_exports, {
  hashPassword: () => hashPassword,
  verifyPassword: () => verifyPassword
});
import { randomBytes as randomBytes3, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
async function hashPassword(plain) {
  const salt = randomBytes3(SALT_BYTES).toString("hex");
  const derived = await scryptAsync(plain, salt, KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(plain, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scryptAsync(plain, salt, KEYLEN);
  const hashBuffer = Buffer.from(hash, "hex");
  if (hashBuffer.length !== derived.length) return false;
  return timingSafeEqual(hashBuffer, derived);
}
var scryptAsync, KEYLEN, SALT_BYTES;
var init_password = __esm({
  "server/_core/password.ts"() {
    "use strict";
    scryptAsync = promisify(scrypt);
    KEYLEN = 64;
    SALT_BYTES = 16;
  }
});

// shared/emailTemplates.ts
var emailTemplates_exports = {};
__export(emailTemplates_exports, {
  EMAIL_TEMPLATES: () => EMAIL_TEMPLATES,
  renderEmailTemplate: () => renderEmailTemplate
});
function renderEmailTemplate(templateId, variables) {
  const template = EMAIL_TEMPLATES.find((t2) => t2.id === templateId);
  if (!template) return null;
  let { subject, html, text: text2 } = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
    text2 = text2.replace(regex, value);
  }
  return { subject, html, text: text2 };
}
var EMAIL_TEMPLATES;
var init_emailTemplates = __esm({
  "shared/emailTemplates.ts"() {
    "use strict";
    EMAIL_TEMPLATES = [
      {
        id: "invitation",
        name: "Invitation collaborateur",
        description: "E-mail envoy\xE9 pour inviter un nouveau collaborateur \xE0 rejoindre l'organisation.",
        subject: "Invitation \xE0 rejoindre {{organization}}",
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
    <h1>Invitation \xE0 rejoindre {{organization}}</h1>
    <p>Bonjour,</p>
    <p>{{inviterName}} vous a invit\xE9(e) \xE0 rejoindre <strong>{{organization}}</strong> sur Lucepres.</p>
    <p style="text-align: center;">
      <a href="{{inviteLink}}" class="button">Accepter l'invitation</a>
    </p>
    <p style="word-break:break-all;font-size:13px;color:#4b5563;">{{inviteLink}}</p>
    <p>Ce lien expire le <strong>{{expiresAt}}</strong>.</p>
    <div class="footer">
      <p>Si vous ne voyez pas cet e-mail, v\xE9rifiez vos spams. Si vous n'attendez pas cette invitation, ignorez ce message.</p>
    </div>
  </div>
</body>
</html>`,
        text: `Bonjour,

{{inviterName}} vous a invit\xE9(e) \xE0 rejoindre {{organization}} sur Lucepres.

Accepter l'invitation (lien valable jusqu'au {{expiresAt}}) :
{{inviteLink}}

Si vous ne voyez pas cet e-mail dans votre bo\xEEte de r\xE9ception, v\xE9rifiez le dossier spam / ind\xE9sirables.
Si vous n'attendez pas cette invitation, ignorez cet e-mail.`,
        variables: ["inviterName", "organization", "inviteLink", "expiresAt"]
      },
      {
        id: "password-reset",
        name: "R\xE9initialisation du mot de passe",
        description: "E-mail envoy\xE9 lorsqu'un utilisateur demande \xE0 r\xE9initialiser son mot de passe.",
        subject: "R\xE9initialisez votre mot de passe Lucepres",
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
    <h1>R\xE9initialisation du mot de passe</h1>
    <p>Bonjour,</p>
    <p>Vous avez demand\xE9 la r\xE9initialisation de votre mot de passe Lucepres.</p>
    <p style="text-align: center;">
      <a href="{{resetLink}}" class="button">R\xE9initialiser mon mot de passe</a>
    </p>
    <p>Ce lien expire dans 1 heure.</p>
    <div class="footer">
      <p>Si vous n'\xEAtes pas \xE0 l'origine de cette demande, ignorez cet e-mail.</p>
    </div>
  </div>
</body>
</html>`,
        text: `Bonjour,

Vous avez demand\xE9 la r\xE9initialisation de votre mot de passe Lucepres.

Cliquez ici : {{resetLink}}

Ce lien expire dans 1 heure.

Si vous n'\xEAtes pas \xE0 l'origine de cette demande, ignorez cet e-mail.`,
        variables: ["resetLink"]
      },
      {
        id: "quote-sent",
        name: "Devis envoy\xE9",
        description: "E-mail envoy\xE9 au client lorsqu'un devis est pr\xEAt \xE0 \xEAtre consult\xE9.",
        subject: "Votre devis {{documentNumber}} est pr\xEAt",
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
    <h1>Votre devis est pr\xEAt</h1>
    <p>Bonjour {{clientName}},</p>
    <p>Nous avons le plaisir de vous transmettre votre devis <strong>{{documentNumber}}</strong>.</p>
    <div class="details">
      <p><strong>Montant :</strong> {{amount}} GNF</p>
      <p><strong>Date d'\xE9ch\xE9ance :</strong> {{dueDate}}</p>
      <p><strong>Valable jusqu'au :</strong> {{validUntil}}</p>
    </div>
    <p style="text-align: center;">
      <a href="{{documentLink}}" class="button">Consulter le devis</a>
    </p>
    <p style="text-align: center; font-size: 13px;"><a href="{{pdfDownloadLink}}" style="color: #113b35;">T\xE9l\xE9charger le PDF</a></p>
    <div class="footer">
      <p>Ce lien personnel expire le <strong>{{linkExpiresAt}}</strong>. Pour toute question, contactez-nous \xE0 {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
        text: `Bonjour {{clientName}},

Nous avons le plaisir de vous transmettre votre devis {{documentNumber}}.

Montant : {{amount}} GNF
Date d'\xE9ch\xE9ance : {{dueDate}}
Valable jusqu'au : {{validUntil}}

Consulter le devis : {{documentLink}}
T\xE9l\xE9charger le PDF : {{pdfDownloadLink}}

Ce lien personnel expire le {{linkExpiresAt}}.
Pour toute question, contactez-nous \xE0 {{companyEmail}}.`,
        variables: ["clientName", "documentNumber", "amount", "dueDate", "validUntil", "documentLink", "pdfDownloadLink", "companyEmail", "linkExpiresAt"]
      },
      {
        id: "invoice-sent",
        name: "Facture envoy\xE9e",
        description: "E-mail envoy\xE9 au client lorsqu'une facture est \xE9mise.",
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
      <p><strong>Date d'\xE9ch\xE9ance :</strong> {{dueDate}}</p>
      <p><strong>Mode de paiement :</strong> {{paymentMethod}}</p>
    </div>
    <p style="text-align: center;">
      <a href="{{documentLink}}" class="button">Consulter la facture</a>
    </p>
    <p style="text-align: center; font-size: 13px;"><a href="{{pdfDownloadLink}}" style="color: #113b35;">T\xE9l\xE9charger le PDF</a></p>
    <div class="footer">
      <p>Merci de r\xE9gler avant le {{dueDate}}. Lien valable jusqu\u2019au <strong>{{linkExpiresAt}}</strong>. Pour toute question, contactez-nous \xE0 {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
        text: `Bonjour {{clientName}},

Veuillez trouver ci-joint votre facture {{documentNumber}}.

Montant total : {{amount}} GNF
Date d'\xE9ch\xE9ance : {{dueDate}}
Mode de paiement : {{paymentMethod}}

Consulter la facture : {{documentLink}}
T\xE9l\xE9charger le PDF : {{pdfDownloadLink}}

Merci de r\xE9gler avant le {{dueDate}}. Lien valable jusqu\u2019au {{linkExpiresAt}}.
Pour toute question, contactez-nous \xE0 {{companyEmail}}.`,
        variables: ["clientName", "documentNumber", "amount", "dueDate", "paymentMethod", "documentLink", "pdfDownloadLink", "companyEmail", "organization", "linkExpiresAt"]
      },
      {
        id: "payment-reminder",
        name: "Rappel de paiement",
        description: "E-mail de relance envoy\xE9 lorsqu'un paiement est en retard.",
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
    <p>Nous vous informons que la facture <strong>{{documentNumber}}</strong> est en attente de r\xE8glement.</p>
    <div class="details">
      <p><strong>Montant d\xFB :</strong> {{amount}} GNF</p>
      <p><strong>Date d'\xE9ch\xE9ance :</strong> {{dueDate}}</p>
      <p><strong>Jours de retard :</strong> {{daysOverdue}}</p>
    </div>
    <p style="text-align: center;">
      <a href="{{documentLink}}" class="button">Consulter la facture</a>
    </p>
    <div class="footer">
      <p>Merci de r\xE9gler dans les meilleurs d\xE9lais. Pour toute question, contactez-nous \xE0 {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
        text: `Bonjour {{clientName}},

Nous vous informons que la facture {{documentNumber}} est en attente de r\xE8glement.

Montant d\xFB : {{amount}} GNF
Date d'\xE9ch\xE9ance : {{dueDate}}
Jours de retard : {{daysOverdue}}

Consulter la facture : {{documentLink}}

Merci de r\xE9gler dans les meilleurs d\xE9lais. Pour toute question, contactez-nous \xE0 {{companyEmail}}.`,
        variables: ["clientName", "documentNumber", "amount", "dueDate", "daysOverdue", "documentLink", "companyEmail"]
      },
      {
        id: "welcome",
        name: "Bienvenue",
        description: "E-mail de bienvenue envoy\xE9 lors de la cr\xE9ation d'un nouveau compte.",
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
    <p>Votre compte a \xE9t\xE9 cr\xE9\xE9 avec succ\xE8s sur Lucepres.</p>
    <p style="text-align: center;">
      <a href="{{loginLink}}" class="button">Se connecter</a>
    </p>
    <div class="footer">
      <p>Pour toute question, contactez-nous \xE0 {{companyEmail}}.</p>
    </div>
  </div>
</body>
</html>`,
        text: `Bonjour {{userName}},

Votre compte a \xE9t\xE9 cr\xE9\xE9 avec succ\xE8s sur Lucepres.

Se connecter : {{loginLink}}

Pour toute question, contactez-nous \xE0 {{companyEmail}}.`,
        variables: ["userName", "loginLink", "companyEmail"]
      }
    ];
  }
});

// server/_core/clientIp.ts
var clientIp_exports = {};
__export(clientIp_exports, {
  resolveClientIp: () => resolveClientIp
});
function trustedProxyHops() {
  const raw = (process.env.TRUST_PROXY ?? "").trim();
  if (!raw || raw === "0" || raw.toLowerCase() === "false") return 0;
  if (raw === "1" || raw.toLowerCase() === "true") return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function resolveClientIp(req) {
  const hops = trustedProxyHops();
  if (hops > 0) {
    const header = req.headers?.["x-forwarded-for"];
    const raw = Array.isArray(header) ? header.join(",") : header;
    if (typeof raw === "string" && raw.length > 0) {
      const chain = raw.split(",").map((part) => part.trim()).filter(Boolean);
      const index2 = chain.length - hops;
      const candidate = chain[index2 >= 0 ? index2 : 0];
      if (candidate) return normalize(candidate);
    }
  }
  return normalize(req.ip ?? req.socket?.remoteAddress ?? "unknown");
}
function normalize(ip) {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) return trimmed.slice("::ffff:".length);
  return trimmed || "unknown";
}
var init_clientIp = __esm({
  "server/_core/clientIp.ts"() {
    "use strict";
  }
});

// server/_core/loginRateLimit.ts
var loginRateLimit_exports = {};
__export(loginRateLimit_exports, {
  DEFAULT_LOGIN_RATE_LIMIT: () => DEFAULT_LOGIN_RATE_LIMIT,
  LoginRateLimiter: () => LoginRateLimiter,
  loginRateLimiter: () => loginRateLimiter,
  normalizeEmailKey: () => normalizeEmailKey,
  registerRateLimiter: () => registerRateLimiter
});
function normalizeEmailKey(email) {
  return email.trim().toLowerCase();
}
var DEFAULT_LOGIN_RATE_LIMIT, LoginRateLimiter, loginRateLimiter, registerRateLimiter;
var init_loginRateLimit = __esm({
  "server/_core/loginRateLimit.ts"() {
    "use strict";
    DEFAULT_LOGIN_RATE_LIMIT = {
      windowMs: 15 * 6e4,
      maxFailuresPerEmail: 5,
      maxFailuresPerIp: 20,
      baseBlockMs: 6e4,
      maxBlockMs: 60 * 6e4,
      maxTrackedKeys: 1e4,
      now: () => Date.now()
    };
    LoginRateLimiter = class {
      options;
      emailBuckets = /* @__PURE__ */ new Map();
      ipBuckets = /* @__PURE__ */ new Map();
      constructor(options = {}) {
        this.options = { ...DEFAULT_LOGIN_RATE_LIMIT, ...options };
      }
      /**
       * À appeler AVANT de vérifier le mot de passe.
       *
       * ATOMICITÉ (corrige une faille TOCTOU vérifiée en production)
       * -----------------------------------------------------------
       * Cette méthode RÉSERVE la tentative : elle incrémente le compteur
       * immédiatement, avant tout `await` de l'appelant.
       *
       * Une première version se contentait de LIRE le compteur, la comptabilisation
       * n'intervenant qu'ensuite via `recordFailure`. Or tRPC exécute les appels d'un
       * même lot `httpBatchLink` EN PARALLÈLE : les N `check()` s'exécutaient tous
       * avant le premier `recordFailure`, lisaient donc un compteur encore vierge et
       * repartaient tous « autorisés ». Mesuré sur le serveur : 20 mots de passe
       * testés dans UNE seule requête HTTP avant tout blocage.
       *
       * En réservant dès la lecture, la N-ième tentative concurrente voit déjà les
       * N-1 précédentes. `recordSuccess` libère ensuite les réservations du compte.
       */
      check(input) {
        const now = this.options.now();
        const emailKey = normalizeEmailKey(input.email);
        const ipVerdict = this.reserve(
          this.ipBuckets,
          input.ip,
          now,
          this.options.maxFailuresPerIp,
          "ip"
        );
        if (!ipVerdict.allowed) return ipVerdict;
        const emailVerdict = this.reserve(
          this.emailBuckets,
          emailKey,
          now,
          this.options.maxFailuresPerEmail,
          "email"
        );
        if (!emailVerdict.allowed) {
          this.release(this.ipBuckets, input.ip);
        }
        return emailVerdict;
      }
      /**
       * À appeler après un échec (mot de passe faux OU e-mail inconnu).
       *
       * La tentative a déjà été comptée par `check()`. Cette méthode CONFIRME
       * l'échec : elle transforme la réservation en échec définitif et arme le
       * blocage à repli exponentiel si le seuil est franchi.
       */
      recordFailure(input) {
        const now = this.options.now();
        this.confirmFailure(
          this.emailBuckets,
          normalizeEmailKey(input.email),
          now,
          this.options.maxFailuresPerEmail
        );
        this.confirmFailure(this.ipBuckets, input.ip, now, this.options.maxFailuresPerIp);
      }
      /**
       * À appeler après une connexion réussie : purge le compteur du compte.
       * Le compteur IP est volontairement CONSERVÉ — sinon un attaquant possédant
       * un compte valide pourrait remettre son quota IP à zéro à volonté entre deux
       * salves de credential-stuffing.
       */
      recordSuccess(input) {
        this.emailBuckets.delete(normalizeEmailKey(input.email));
      }
      /** Tests / maintenance. */
      reset() {
        this.emailBuckets.clear();
        this.ipBuckets.clear();
      }
      /**
       * Réserve une tentative de façon atomique (aucun `await` à l'intérieur : le
       * modèle mono-thread de Node garantit qu'aucun autre appel ne s'intercale).
       *
       * Renvoie `allowed: false` si le quota est déjà consommé ou si un blocage court.
       */
      reserve(store, key, now, maxFailures, scope) {
        let bucket = store.get(key);
        if (bucket) {
          const blocageTermine = bucket.blockedUntil > 0 && bucket.blockedUntil <= now;
          const fenetreEcoulee = now - bucket.windowStartedAt >= this.options.windowMs;
          if (blocageTermine) {
            bucket.failures = 0;
            bucket.blockedUntil = 0;
            bucket.windowStartedAt = now;
          } else if (bucket.blockedUntil === 0 && fenetreEcoulee) {
            store.delete(key);
            bucket = void 0;
          }
        }
        if (bucket && bucket.blockedUntil > now) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1e3)),
            scope
          };
        }
        if (!bucket) {
          bucket = { failures: 0, blocks: 0, windowStartedAt: now, blockedUntil: 0, lastSeenAt: now };
          store.set(key, bucket);
        }
        if (bucket.failures >= maxFailures) {
          bucket.lastSeenAt = now;
          this.armBlock(bucket, now);
          return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1e3)),
            scope
          };
        }
        bucket.failures += 1;
        bucket.lastSeenAt = now;
        this.evictIfNeeded(store, now);
        return { allowed: true };
      }
      /** Rend une réservation prise à tort (ex. refus par l'autre compteur). */
      release(store, key) {
        const bucket = store.get(key);
        if (!bucket) return;
        bucket.failures = Math.max(0, bucket.failures - 1);
        if (bucket.failures === 0 && bucket.blockedUntil === 0 && bucket.blocks === 0) {
          store.delete(key);
        }
      }
      /**
       * Confirme un échec déjà réservé : arme le blocage si le seuil est franchi.
       * N'incrémente PAS le compteur (`reserve` l'a fait), pour éviter tout
       * double comptage.
       */
      confirmFailure(store, key, now, maxFailures) {
        const bucket = store.get(key);
        if (!bucket) return;
        bucket.lastSeenAt = now;
        if (bucket.failures >= maxFailures) {
          this.armBlock(bucket, now);
        }
        this.evictIfNeeded(store, now);
      }
      /**
       * Arme (ou prolonge) le blocage avec un repli exponentiel : chaque blocage
       * successif double la peine, plafonnée à `maxBlockMs`.
       *
       * Le compteur `blocks` sert de mémoire de récidive : il survit à l'expiration
       * d'une peine, de sorte qu'un attaquant qui revient après chaque déblocage
       * subit une attente croissante plutôt que de repartir au minimum.
       */
      armBlock(bucket, now) {
        if (bucket.blockedUntil > now) return;
        const blockMs = Math.min(
          this.options.maxBlockMs,
          this.options.baseBlockMs * 2 ** bucket.blocks
        );
        bucket.blocks += 1;
        bucket.blockedUntil = now + blockMs;
      }
      /**
       * Garde-fou mémoire : sans plafond, un attaquant pourrait faire grossir la
       * Map indéfiniment (une clé par e-mail inventé) — un DoS mémoire.
       * On purge d'abord les entrées périmées, puis les plus anciennes.
       */
      evictIfNeeded(store, now) {
        if (store.size <= this.options.maxTrackedKeys) return;
        const staleKeys = [];
        store.forEach((bucket, key) => {
          const expired = bucket.blockedUntil <= now && now - bucket.windowStartedAt >= this.options.windowMs;
          if (expired) staleKeys.push(key);
        });
        staleKeys.forEach((key) => store.delete(key));
        if (store.size <= this.options.maxTrackedKeys) return;
        const surplus = store.size - this.options.maxTrackedKeys;
        const entries = [];
        store.forEach((bucket, key) => entries.push({ key, lastSeenAt: bucket.lastSeenAt }));
        entries.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
        for (let i = 0; i < surplus; i++) {
          const entry = entries[i];
          if (entry) store.delete(entry.key);
        }
      }
    };
    loginRateLimiter = new LoginRateLimiter();
    registerRateLimiter = new LoginRateLimiter({
      maxFailuresPerEmail: 3,
      maxFailuresPerIp: 10,
      windowMs: 60 * 6e4,
      baseBlockMs: 5 * 6e4,
      maxBlockMs: 60 * 6e4
    });
  }
});

// server/_core/localAuth.ts
var localAuth_exports = {};
__export(localAuth_exports, {
  signLocalSession: () => signLocalSession,
  verifyLocalSession: () => verifyLocalSession
});
import { SignJWT, jwtVerify } from "jose";
function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}
async function signLocalSession(payload, expiresInMs = ONE_YEAR_MS2) {
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1e3);
  return new SignJWT({
    openId: payload.openId,
    email: payload.email,
    name: payload.name,
    tenantId: payload.tenantId
  }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(getSecret());
}
async function verifyLocalSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { openId, email, name, tenantId } = payload;
    if (typeof openId !== "string" || typeof email !== "string" || typeof name !== "string" || typeof tenantId !== "number") {
      return null;
    }
    return { openId, email, name, tenantId };
  } catch {
    return null;
  }
}
var ONE_YEAR_MS2;
var init_localAuth = __esm({
  "server/_core/localAuth.ts"() {
    "use strict";
    init_env();
    ONE_YEAR_MS2 = 365 * 24 * 60 * 60 * 1e3;
  }
});

// netlify/functions/api.ts
import { webcrypto as nodeWebCrypto } from "node:crypto";
import serverlessHttp from "serverless-http";

// server/_core/index.ts
import "dotenv/config";
import express4 from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/storageProxy.ts
init_env();
import fs from "node:fs";
import path from "node:path";
function registerStorageProxy(app) {
  app.get("/storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key || key.includes("..") || key.includes("//")) {
      res.status(400).send("Invalid storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      const filePath = path.resolve(path.join(import.meta.dirname, "../../storage"), key);
      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
      }
      res.sendFile(filePath);
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "/")
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z2 } from "zod";

// shared/billing.ts
var DOCUMENT_STATUSES = [
  "brouillon",
  "a_envoyer",
  "envoye",
  "accepte",
  "refuse",
  "partiellement_paye",
  "paye",
  "en_retard",
  "annule"
];
function calculateDocumentTotals(lines) {
  return lines.reduce(
    (totals, line) => {
      const base = Math.round(line.quantity * line.unitPrice);
      const tax = Math.round(base * line.taxRate / 100);
      return {
        subtotal: totals.subtotal + base,
        taxTotal: totals.taxTotal + tax,
        total: totals.total + base + tax
      };
    },
    { subtotal: 0, taxTotal: 0, total: 0 }
  );
}
function initialDocumentStatus(status, isAiDraft) {
  return isAiDraft ? "brouillon" : status ?? "brouillon";
}
function formatDocumentNumber(kind, year, value) {
  const prefix = kind === "devis" ? "DEV" : "FAC";
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}
function summarizeDashboard(documents2, now = /* @__PURE__ */ new Date()) {
  const isLate = (document) => document.kind === "facture" && Boolean(document.dueDate && document.dueDate < now && !["paye", "annule"].includes(document.status));
  const paid = documents2.filter((document) => document.kind === "facture" && document.status === "paye");
  return {
    toProcess: documents2.filter((document) => ["brouillon", "a_envoyer"].includes(document.status)).length,
    sent: documents2.filter((document) => document.status === "envoye").length,
    accepted: documents2.filter((document) => document.status === "accepte").length,
    paidCount: paid.length,
    paidTotal: paid.reduce((sum, document) => sum + document.total, 0),
    overdue: documents2.filter(isLate).length,
    invoicesToFollow: documents2.filter((document) => document.kind === "facture" && ["envoye", "partiellement_paye", "en_retard"].includes(document.status)).length
  };
}
function calculatePaymentBalance(total, paidAmount) {
  const paid = Math.max(0, paidAmount);
  return { paidAmount: paid, balanceDue: Math.max(0, total - paid), isPaid: paid >= total && total > 0 };
}
function isInvoiceOverdue(status, dueDate, now = /* @__PURE__ */ new Date()) {
  return Boolean(dueDate && dueDate < now && !["brouillon", "a_envoyer", "paye", "annule", "refuse"].includes(status));
}
function invoicePaymentStatus(total, paidAmount, dueDate, currentStatus, now = /* @__PURE__ */ new Date()) {
  const balance = calculatePaymentBalance(total, paidAmount);
  if (balance.isPaid) return "paye";
  if (balance.paidAmount > 0) return "partiellement_paye";
  if (isInvoiceOverdue(currentStatus, dueDate, now)) return "en_retard";
  return currentStatus;
}
function formatGnf(value) {
  return `${new Intl.NumberFormat("fr-GN", {
    maximumFractionDigits: 0
  }).format(value)} GNF`;
}

// shared/companySettingsValidation.ts
function valueOf(value) {
  return value?.trim() ?? "";
}
function validateCompanyFinancialDetails(input) {
  const taxId = valueOf(input.taxId);
  const registrationNumber = valueOf(input.registrationNumber);
  const bankName = valueOf(input.bankName);
  const accountName = valueOf(input.accountName);
  const accountNumber = valueOf(input.accountNumber);
  const iban = valueOf(input.iban).replaceAll(" ", "");
  const swift = valueOf(input.swift).toUpperCase();
  const errors = {};
  if (taxId && taxId.length < 2) errors.taxId = "Saisissez au moins 2 caract\xE8res, ou laissez le champ vide.";
  if (registrationNumber && registrationNumber.length < 2) errors.registrationNumber = "Saisissez au moins 2 caract\xE8res, ou laissez le champ vide.";
  const hasBankDetails = Boolean(bankName || accountName || accountNumber || iban || swift);
  if (hasBankDetails && bankName.length < 2) errors.bankName = "Indiquez le nom de la banque si des coordonn\xE9es de r\xE8glement sont saisies.";
  if (hasBankDetails && accountName.length < 2) errors.accountName = "Indiquez le titulaire du compte si des coordonn\xE9es de r\xE8glement sont saisies.";
  if (hasBankDetails && accountNumber.length < 4) errors.accountNumber = "Indiquez un num\xE9ro de compte d\u2019au moins 4 caract\xE8res.";
  if (iban && !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban.toUpperCase())) errors.iban = "L\u2019IBAN doit contenir 15 \xE0 34 caract\xE8res sans espace.";
  if (swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) errors.swift = "Le code SWIFT / BIC doit contenir 8 ou 11 caract\xE8res.";
  return errors;
}

// shared/defaultServices.ts
var SERVICE_CATEGORIES = ["btp", "forage", "hydraulique", "hygiene", "maintenance", "etude", "transport", "autre"];
var LUCEPRES_DEFAULT_SERVICES = [
  { code: "BTP-PRE-001", name: "Pr\xE9paration et installation de chantier", category: "btp", description: "Installation, s\xE9curisation et pr\xE9paration des zones de travaux.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-FON-001", name: "Fondations et terrassement pr\xE9paratoire", category: "btp", description: "Pr\xE9paration des fondations et terrassement selon les m\xE9tr\xE9s valid\xE9s.", unit: "m\xB3", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-ELV-001", name: "\xC9l\xE9vation des ouvrages", category: "btp", description: "\xC9l\xE9vation des murs, poteaux ou \xE9l\xE9ments structurels du projet.", unit: "m\xB2", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-GOE-001", name: "B\xE9ton arm\xE9 et gros \u0153uvre", category: "btp", description: "R\xE9alisation des \xE9l\xE9ments en b\xE9ton arm\xE9 et ouvrages de structure.", unit: "m\xB3", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-DIA-001", name: "Diagnostic technique du b\xE2ti", category: "btp", description: "\xC9tat des lieux, relev\xE9s et diagnostic pr\xE9alable aux travaux.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-DEP-001", name: "D\xE9pose et \xE9vacuation contr\xF4l\xE9e", category: "btp", description: "D\xE9pose des \xE9l\xE9ments existants et \xE9vacuation selon les contraintes du site.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-REN-001", name: "R\xE9habilitation des ouvrages existants", category: "btp", description: "R\xE9paration et remise en \xE9tat des ouvrages existants.", unit: "m\xB2", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-FIN-001", name: "Finitions et remise en \xE9tat", category: "btp", description: "Finitions, nettoyage de r\xE9ception et remise en \xE9tat des espaces.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-IMP-001", name: "Implantation et pr\xE9paration de site", category: "btp", description: "Implantation, pr\xE9paration des emprises et organisation initiale du site.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-ASS-001", name: "Assainissement et \xE9vacuation de site", category: "btp", description: "Travaux d\u2019assainissement et gestion des \xE9vacuations du site.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-ACC-001", name: "Voiries, acc\xE8s et r\xE9seaux divers", category: "btp", description: "Cr\xE9ation ou am\xE9lioration des acc\xE8s, voiries et r\xE9seaux divers.", unit: "ml", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "BTP-EXT-001", name: "Am\xE9nagements ext\xE9rieurs", category: "btp", description: "Am\xE9nagement et finition des espaces ext\xE9rieurs du chantier.", unit: "m\xB2", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYD-ETU-001", name: "\xC9tude et diagnostic hydraulique", category: "hydraulique", description: "Analyse initiale du besoin, du site et des contraintes techniques.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYD-ADD-001", name: "Pose de conduite d\u2019adduction", category: "hydraulique", description: "Pose et raccordement de conduite d\u2019adduction d\u2019eau.", unit: "ml", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYD-EQP-001", name: "Fourniture et pose d\u2019\xE9quipement hydraulique", category: "hydraulique", description: "Fourniture, installation et essais d\u2019\xE9quipement hydraulique.", unit: "unit\xE9", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYG-NET-001", name: "Nettoyage professionnel de site", category: "hygiene", description: "Nettoyage ponctuel ou de fin de chantier pour un site professionnel.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYG-ASS-001", name: "Assainissement et hygi\xE8ne de site", category: "hygiene", description: "Intervention d\u2019hygi\xE8ne, d\u2019assainissement et de mise en propret\xE9.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "HYG-ENT-001", name: "Entretien p\xE9riodique de site", category: "hygiene", description: "Prestation r\xE9currente d\u2019entretien selon la fr\xE9quence convenue.", unit: "mois", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "MNT-DIA-001", name: "Diagnostic de maintenance", category: "maintenance", description: "Contr\xF4le d\u2019un \xE9quipement ou d\u2019une installation avant intervention.", unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "MNT-PRE-001", name: "Maintenance pr\xE9ventive", category: "maintenance", description: "Visite d\u2019entretien pr\xE9ventif avec v\xE9rifications et actions planifi\xE9es.", unit: "intervention", defaultUnitPrice: 0, defaultTaxRate: 0 },
  { code: "MNT-REP-001", name: "R\xE9paration et r\xE9habilitation", category: "maintenance", description: "Remise en \xE9tat d\u2019une installation ou d\u2019un \xE9quipement existant.", unit: "intervention", defaultUnitPrice: 0, defaultTaxRate: 0 }
];
function getMissingDefaultServices(existingCodes) {
  const knownCodes = new Set(existingCodes);
  return LUCEPRES_DEFAULT_SERVICES.filter((service) => !knownCodes.has(service.code));
}

// shared/paymentSchedule.ts
function validateQuotePaymentSchedule(input) {
  const errors = {};
  const hasSchedule = input.depositPercent !== void 0 && input.depositPercent !== null;
  if (!hasSchedule) return errors;
  if (!Number.isInteger(input.depositPercent) || input.depositPercent < 1 || input.depositPercent > 99) errors.depositPercent = "L\u2019acompte doit \xEAtre un pourcentage entier compris entre 1 et 99.";
  if (!input.depositDueDate) errors.depositDueDate = "Indiquez la date d\u2019\xE9ch\xE9ance de l\u2019acompte.";
  if (!input.balanceDueDate) errors.balanceDueDate = "Indiquez la date d\u2019\xE9ch\xE9ance du solde.";
  if (input.depositDueDate && input.balanceDueDate && input.depositDueDate > input.balanceDueDate) errors.balanceDueDate = "Le solde ne peut pas \xEAtre exigible avant l\u2019acompte.";
  return errors;
}

// server/db.ts
init_tenantContext();
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
import {
  bigint,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar
} from "drizzle-orm/pg-core";
var planEnum = pgEnum("plan", ["trial", "pro", "enterprise"]);
var status_active_trialEnum = pgEnum("status_active_trial", ["active", "trial", "suspended", "cancelled"]);
var role_admin_memberEnum = pgEnum("role_admin_member", ["admin", "member", "viewer"]);
var role_admin_directeurEnum = pgEnum("role_admin_directeur", ["admin", "directeur", "cadre", "client"]);
var status_pending_acceptedEnum = pgEnum("status_pending_accepted", ["pending", "accepted", "revoked"]);
var identityKindEnum = pgEnum("identityKind", ["immatriculee", "en_immatriculation", "personne_physique", "sans_immatriculation", "autre"]);
var type_btp_forageEnum = pgEnum("type_btp_forage", ["btp", "forage", "mixte"]);
var status_actif_en_pauseEnum = pgEnum("status_actif_en_pause", ["actif", "en_pause", "termine"]);
var category_materiaux_main_oeuvreEnum = pgEnum("category_materiaux_main_oeuvre", ["materiaux", "main_oeuvre", "transport", "equipement", "sous_traitance", "autre"]);
var category_btp_forageEnum = pgEnum("category_btp_forage", [
  "btp",
  "forage",
  "hydraulique",
  "hygiene",
  "maintenance",
  "etude",
  "transport",
  "autre"
]);
var isActiveEnum = pgEnum("isActive", ["oui", "non"]);
var kindEnum = pgEnum("kind", ["devis", "facture"]);
var invoiceStageEnum = pgEnum("invoiceStage", ["standard", "acompte", "solde"]);
var status_brouillon_a_envoyerEnum = pgEnum("status_brouillon_a_envoyer", [
  "brouillon",
  "a_envoyer",
  "envoye",
  "accepte",
  "refuse",
  "partiellement_paye",
  "paye",
  "en_retard",
  "annule"
]);
var isAiDraftEnum = pgEnum("isAiDraft", ["oui", "non"]);
var collectionStatusEnum = pgEnum("collectionStatus", ["a_traiter", "contacte", "a_rappeler"]);
var methodEnum = pgEnum("method", ["especes", "virement", "cheque", "mobile_money", "autre"]);
var type_relance_preparee_noteEnum = pgEnum("type_relance_preparee_note", ["relance_preparee", "note", "statut_recouvrement", "responsable_recouvrement", "date_rappel_recouvrement", "email_envoye", "statut_document"]);
var category_communication_collaborationEnum = pgEnum("category_communication_collaboration", ["communication", "collaboration", "chantier", "comptabilite"]);
var transportEnum = pgEnum("transport", ["api", "mcp"]);
var authTypeEnum = pgEnum("authType", ["oauth2", "api_key", "none"]);
var isSupportedEnum = pgEnum("isSupported", ["oui", "non"]);
var directionEnum = pgEnum("direction", ["lecture", "ecriture", "bidirectionnel"]);
var riskLevelEnum = pgEnum("riskLevel", ["faible", "moyen", "eleve"]);
var requiresApprovalEnum = pgEnum("requiresApproval", ["oui", "non"]);
var status_eligible_credentials_pendingEnum = pgEnum("status_eligible_credentials_pending", ["eligible", "credentials_pending", "testing", "active", "degraded", "revoked", "disabled"]);
var status_queued_approvedEnum = pgEnum("status_queued_approved", ["queued", "approved", "running", "completed", "failed", "cancelled"]);
var decisionEnum = pgEnum("decision", ["autorise", "refuse", "information"]);
var status_authorization_ready_completedEnum = pgEnum("status_authorization_ready_completed", ["authorization_ready", "completed", "failed", "expired"]);
var signatureStatusEnum = pgEnum("signatureStatus", ["valid", "invalid", "pending"]);
var processingStatusEnum = pgEnum("processingStatus", ["accepted", "rejected", "processed", "failed"]);
var role_directeur_general_responsable_commercialEnum = pgEnum("role_directeur_general_responsable_commercial", ["directeur_general", "responsable_commercial"]);
var canApproveEnum = pgEnum("canApprove", ["oui", "non"]);
var canActivateEnum = pgEnum("canActivate", ["oui", "non"]);
var scopeEnum = pgEnum("scope", ["global", "commercial"]);
var status_active_suspendueEnum = pgEnum("status_active_suspendue", ["active", "suspendue", "revoquee"]);
var purposeEnum = pgEnum("purpose", ["relance_facture", "suivi_devis"]);
var channelEnum = pgEnum("channel", ["email", "whatsapp"]);
var toneEnum = pgEnum("tone", ["courtois", "professionnel", "ferme", "commercial"]);
var status_brouillon_a_approuverEnum = pgEnum("status_brouillon_a_approuver", ["brouillon", "a_approuver", "active_simulation", "suspendue", "expiree", "revoquee"]);
var requiresSecondApprovalEnum = pgEnum("requiresSecondApproval", ["oui", "non"]);
var status_brouillon_simuleeEnum = pgEnum("status_brouillon_simulee", ["brouillon", "simulee", "a_approuver", "approuvee", "active_simulation", "suspendue", "archivee"]);
var lastExecutionStatusEnum = pgEnum("lastExecutionStatus", ["pending", "success", "skipped", "failed"]);
var status_simulation_prete_remis_testEnum = pgEnum("status_simulation_prete_remis_test", ["simulation_prete", "remis_test", "bloquee", "annulee"]);
var status_previsualise_remis_testEnum = pgEnum("status_previsualise_remis_test", ["previsualise", "remis_test", "annule"]);
var enabledEnum = pgEnum("enabled", ["oui", "non"]);
var tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  plan: planEnum("plan").default("trial").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  trialEndsAt: timestamp("trialEndsAt"),
  status: status_active_trialEnum("status").default("trial").notNull(),
  currency: varchar("currency", { length: 3 }).default("GNF").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
});
var tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    role: role_admin_memberEnum("role").default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [unique("tenant_memberships_user_tenant_unique").on(table.userId, table.tenantId)]
);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").references(() => tenants.id, { onDelete: "set null" }),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: role_admin_directeurEnum("role").default("cadre").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  role: role_admin_directeurEnum("role").default("cadre").notNull(),
  invitedBy: integer("invitedBy").notNull(),
  status: status_pending_acceptedEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedByUser: integer("acceptedByUser"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("invitations_email_idx").on(table.email), index("invitations_status_idx").on(table.status)]);
var passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("password_resets_user_idx").on(table.userId), index("password_resets_status_idx").on(table.expiresAt)]);
var clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    companyName: varchar("companyName", { length: 180 }).notNull(),
    contactName: varchar("contactName", { length: 180 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    address: text("address"),
    taxId: varchar("taxId", { length: 100 }),
    identityKind: identityKindEnum("identityKind").default("immatriculee").notNull(),
    registrationNumber: varchar("registrationNumber", { length: 100 }),
    notes: text("notes"),
    defaultDiscountPercent: integer("defaultDiscountPercent").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [index("clients_companyName_idx").on(table.companyName)]
);
var projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 180 }).notNull(),
    reference: varchar("reference", { length: 80 }),
    type: type_btp_forageEnum("type").notNull(),
    status: status_actif_en_pauseEnum("status").default("actif").notNull(),
    location: varchar("location", { length: 255 }),
    description: text("description"),
    plannedBudget: bigint("plannedBudget", { mode: "number" }).default(0).notNull(),
    minimumMarginRate: integer("minimumMarginRate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [
    index("projects_clientId_idx").on(table.clientId),
    index("projects_status_idx").on(table.status)
  ]
);
var projectCosts = pgTable(
  "project_costs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    category: category_materiaux_main_oeuvreEnum("category").notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    incurredAt: date("incurredAt", { mode: "date" }).notNull(),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("project_costs_project_date_idx").on(table.projectId, table.incurredAt), index("project_costs_category_idx").on(table.category)]
);
var projectCostAttachments = pgTable(
  "project_cost_attachments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    projectCostId: integer("projectCostId").notNull().references(() => projectCosts.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    size: integer("size").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 512 }).notNull(),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("project_cost_attachments_cost_idx").on(table.projectCostId)]
);
var services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    category: category_btp_forageEnum("category").default("autre").notNull(),
    description: text("description"),
    unit: varchar("unit", { length: 30 }).default("unit\xE9").notNull(),
    defaultUnitPrice: bigint("defaultUnitPrice", { mode: "number" }).default(0).notNull(),
    defaultTaxRate: integer("defaultTaxRate").default(0).notNull(),
    isActive: isActiveEnum("isActive").default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [unique("services_code_unique").on(table.code)]
);
var servicePriceRevisions = pgTable(
  "service_price_revisions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    serviceId: integer("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
    previousUnitPrice: bigint("previousUnitPrice", { mode: "number" }).notNull(),
    nextUnitPrice: bigint("nextUnitPrice", { mode: "number" }).notNull(),
    previousTaxRate: integer("previousTaxRate").notNull(),
    nextTaxRate: integer("nextTaxRate").notNull(),
    changedById: integer("changedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("service_price_revisions_serviceId_createdAt_idx").on(table.serviceId, table.createdAt)]
);
var documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    kind: kindEnum("kind").notNull(),
    number: varchar("number", { length: 80 }).notNull(),
    clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
    projectId: integer("projectId").references(() => projects.id, { onDelete: "set null" }),
    relatedDocumentId: integer("relatedDocumentId"),
    invoiceStage: invoiceStageEnum("invoiceStage").default("standard").notNull(),
    status: status_brouillon_a_envoyerEnum("status").default("brouillon").notNull(),
    issueDate: date("issueDate", { mode: "date" }).notNull(),
    dueDate: date("dueDate", { mode: "date" }),
    validUntil: date("validUntil", { mode: "date" }),
    depositPercent: integer("depositPercent"),
    depositDueDate: date("depositDueDate", { mode: "date" }),
    balanceDueDate: date("balanceDueDate", { mode: "date" }),
    discountPercent: integer("discountPercent").default(0).notNull(),
    discountAmount: bigint("discountAmount", { mode: "number" }).default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("GNF").notNull(),
    subtotal: bigint("subtotal", { mode: "number" }).default(0).notNull(),
    taxTotal: bigint("taxTotal", { mode: "number" }).default(0).notNull(),
    total: bigint("total", { mode: "number" }).default(0).notNull(),
    notes: text("notes"),
    isAiDraft: isAiDraftEnum("isAiDraft").default("non").notNull(),
    collectionStatus: collectionStatusEnum("collectionStatus").default("a_traiter").notNull(),
    collectionReminderDate: date("collectionReminderDate", { mode: "date" }),
    collectionOwnerId: integer("collectionOwnerId").references(() => users.id, { onDelete: "set null" }),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [
    unique("documents_number_unique").on(table.number),
    index("documents_kind_status_idx").on(table.kind, table.status),
    index("documents_clientId_idx").on(table.clientId),
    index("documents_dueDate_idx").on(table.dueDate),
    index("documents_related_stage_idx").on(table.relatedDocumentId, table.invoiceStage),
    index("documents_collection_owner_status_idx").on(table.collectionOwnerId, table.collectionStatus),
    index("documents_updatedAt_idx").on(table.updatedAt),
    index("documents_kind_updatedAt_idx").on(table.kind, table.updatedAt),
    index("documents_projectId_idx").on(table.projectId)
  ]
);
var documentLines = pgTable(
  "document_lines",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
    unit: varchar("unit", { length: 30 }).default("unit\xE9").notNull(),
    unitPrice: bigint("unitPrice", { mode: "number" }).default(0).notNull(),
    taxRate: integer("taxRate").default(0).notNull(),
    lineTotal: bigint("lineTotal", { mode: "number" }).default(0).notNull(),
    serviceId: integer("serviceId").references(() => services.id, { onDelete: "set null" })
  },
  (table) => [
    index("document_lines_documentId_idx").on(table.documentId),
    unique("document_lines_document_position_unique").on(table.documentId, table.position)
  ]
);
var payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    paidAt: date("paidAt", { mode: "date" }).notNull(),
    method: methodEnum("method").default("autre").notNull(),
    reference: varchar("reference", { length: 120 }),
    notes: text("notes"),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    index("payments_documentId_idx").on(table.documentId),
    index("payments_paidAt_idx").on(table.paidAt)
  ]
);
var paymentPromises = pgTable(
  "payment_promises",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
    promisedDate: date("promisedDate", { mode: "date" }).notNull(),
    note: varchar("note", { length: 500 }),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [unique("payment_promises_document_unique").on(table.documentId), index("payment_promises_date_idx").on(table.promisedDate)]
);
var companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  legalName: varchar("legalName", { length: 180 }).default("Lucepress").notNull(),
  legalAddress: text("legalAddress"),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  identityKind: identityKindEnum("identityKind").default("immatriculee").notNull(),
  taxId: varchar("taxId", { length: 100 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  bankName: varchar("bankName", { length: 180 }),
  accountName: varchar("accountName", { length: 180 }),
  accountNumber: varchar("accountNumber", { length: 120 }),
  iban: varchar("iban", { length: 120 }),
  swift: varchar("swift", { length: 32 }),
  paymentInstructions: text("paymentInstructions"),
  documentFooter: text("documentFooter"),
  updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
});
var clientAttachments = pgTable(
  "client_attachments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    size: integer("size").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 512 }).notNull(),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("client_attachments_clientId_idx").on(table.clientId)]
);
var clientActivities = pgTable(
  "client_activities",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    documentId: integer("documentId").references(() => documents.id, { onDelete: "set null" }),
    type: type_relance_preparee_noteEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("client_activities_clientId_createdAt_idx").on(table.clientId, table.createdAt)]
);
var documentShareLinks = pgTable(
  "document_share_links",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: integer("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    recipientEmail: varchar("recipientEmail", { length: 320 }),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    lastAccessAt: timestamp("lastAccessAt"),
    accessCount: integer("accessCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    index("document_share_links_document_idx").on(table.documentId, table.revokedAt),
    index("document_share_links_tenant_expires_idx").on(table.tenantId, table.expiresAt)
  ]
);
var integrationProviders = pgTable(
  "integration_providers",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: category_communication_collaborationEnum("category").notNull(),
    transport: transportEnum("transport").notNull(),
    documentationUrl: varchar("documentationUrl", { length: 512 }),
    authType: authTypeEnum("authType").notNull(),
    isSupported: isSupportedEnum("isSupported").default("oui").notNull(),
    sortOrder: integer("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [unique("integration_providers_slug_unique").on(table.slug), index("integration_providers_category_idx").on(table.category, table.sortOrder)]
);
var integrationCapabilities = pgTable(
  "integration_capabilities",
  {
    id: serial("id").primaryKey(),
    providerId: integer("providerId").notNull().references(() => integrationProviders.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 100 }).notNull(),
    label: varchar("label", { length: 180 }).notNull(),
    direction: directionEnum("direction").notNull(),
    riskLevel: riskLevelEnum("riskLevel").default("moyen").notNull(),
    requiresApproval: requiresApprovalEnum("requiresApproval").default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [unique("integration_capabilities_provider_code_unique").on(table.providerId, table.code), index("integration_capabilities_provider_idx").on(table.providerId)]
);
var integrationConnections = pgTable(
  "integration_connections",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    providerId: integer("providerId").notNull().references(() => integrationProviders.id, { onDelete: "restrict" }),
    status: status_eligible_credentials_pendingEnum("status").default("eligible").notNull(),
    grantedScopes: text("grantedScopes"),
    /** Référence opaque vers un gestionnaire de secrets ; aucune clé n’est stockée ici. */
    secretRef: varchar("secretRef", { length: 255 }),
    lastHealthCheckAt: timestamp("lastHealthCheckAt"),
    lastError: text("lastError"),
    enabledById: integer("enabledById").references(() => users.id, { onDelete: "set null" }),
    connectedAt: timestamp("connectedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [unique("integration_connections_provider_unique").on(table.providerId), index("integration_connections_status_idx").on(table.status)]
);
var integrationJobs = pgTable(
  "integration_jobs",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    operation: varchar("operation", { length: 100 }).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
    payloadHash: varchar("payloadHash", { length: 128 }).notNull(),
    status: status_queued_approvedEnum("status").default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("lastError"),
    approvedById: integer("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    approvalNote: varchar("approvalNote", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [unique("integration_jobs_idempotency_unique").on(table.idempotencyKey), index("integration_jobs_connection_status_idx").on(table.connectionId, table.status)]
);
var integrationMappings = pgTable(
  "integration_mappings",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    internalId: integer("internalId").notNull(),
    externalId: varchar("externalId", { length: 255 }).notNull(),
    externalVersion: varchar("externalVersion", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [unique("integration_mappings_connection_entity_internal_unique").on(table.connectionId, table.entityType, table.internalId), index("integration_mappings_external_idx").on(table.connectionId, table.externalId)]
);
var integrationAuditLogs = pgTable(
  "integration_audit_logs",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").references(() => integrationConnections.id, { onDelete: "set null" }),
    actorId: integer("actorId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    target: varchar("target", { length: 255 }),
    decision: decisionEnum("decision").default("information").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("integration_audit_logs_connection_created_idx").on(table.connectionId, table.createdAt), index("integration_audit_logs_actor_created_idx").on(table.actorId, table.createdAt)]
);
var integrationOauthSessions = pgTable(
  "integration_oauth_sessions",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    providerId: integer("providerId").notNull().references(() => integrationProviders.id, { onDelete: "cascade" }),
    clientId: varchar("clientId", { length: 255 }).notNull(),
    redirectUri: varchar("redirectUri", { length: 512 }).notNull(),
    requestedScopes: text("requestedScopes").notNull(),
    stateHash: varchar("stateHash", { length: 128 }).notNull(),
    status: status_authorization_ready_completedEnum("status").default("authorization_ready").notNull(),
    error: text("error"),
    expiresAt: timestamp("expiresAt").notNull(),
    completedAt: timestamp("completedAt"),
    createdById: integer("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [unique("integration_oauth_sessions_state_hash_unique").on(table.stateHash), index("integration_oauth_sessions_connection_status_idx").on(table.connectionId, table.status)]
);
var integrationWebhookEvents = pgTable(
  "integration_webhook_events",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connectionId").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
    externalEventId: varchar("externalEventId", { length: 255 }).notNull(),
    eventType: varchar("eventType", { length: 120 }).notNull(),
    deliveryStatus: varchar("deliveryStatus", { length: 120 }),
    signatureStatus: signatureStatusEnum("signatureStatus").default("pending").notNull(),
    processingStatus: processingStatusEnum("processingStatus").default("accepted").notNull(),
    payloadHash: varchar("payloadHash", { length: 128 }).notNull(),
    summary: varchar("summary", { length: 500 }),
    error: text("error"),
    occurredAt: timestamp("occurredAt").notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt")
  },
  (table) => [unique("integration_webhook_events_connection_external_unique").on(table.connectionId, table.externalEventId), index("integration_webhook_events_connection_received_idx").on(table.connectionId, table.receivedAt), index("integration_webhook_events_signature_idx").on(table.signatureStatus, table.receivedAt)]
);
var agentOperatorGrants = pgTable(
  "agent_operator_grants",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: role_directeur_general_responsable_commercialEnum("role").notNull(),
    canApprove: canApproveEnum("canApprove").default("oui").notNull(),
    canActivate: canActivateEnum("canActivate").default("non").notNull(),
    scope: scopeEnum("scope").default("commercial").notNull(),
    status: status_active_suspendueEnum("status").default("active").notNull(),
    expiresAt: timestamp("expiresAt"),
    grantedById: integer("grantedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [
    unique("agent_operator_grants_user_role_unique").on(table.userId, table.role),
    index("agent_operator_grants_user_status_idx").on(table.userId, table.status)
  ]
);
var agentDelegations = pgTable(
  "agent_delegations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    purpose: purposeEnum("purpose").notNull(),
    channel: channelEnum("channel").notNull(),
    tone: toneEnum("tone").default("professionnel").notNull(),
    status: status_brouillon_a_approuverEnum("status").default("brouillon").notNull(),
    startsAt: timestamp("startsAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    dailyLimit: integer("dailyLimit").default(60).notNull(),
    contactCooldownDays: integer("contactCooldownDays").default(7).notNull(),
    requiresSecondApproval: requiresSecondApprovalEnum("requiresSecondApproval").default("non").notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    policyVersion: integer("policyVersion").default(1).notNull(),
    ownerId: integer("ownerId").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: integer("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    secondApprovedById: integer("secondApprovedById").references(() => users.id, { onDelete: "set null" }),
    secondApprovedAt: timestamp("secondApprovedAt"),
    activatedById: integer("activatedById").references(() => users.id, { onDelete: "set null" }),
    suspendedById: integer("suspendedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [
    index("agent_delegations_owner_status_idx").on(table.ownerId, table.status),
    index("agent_delegations_status_expiry_idx").on(table.status, table.expiresAt),
    index("agent_delegations_schedule_uid_idx").on(table.scheduleCronTaskUid)
  ]
);
var agentCampaigns = pgTable(
  "agent_campaigns",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    delegationId: integer("delegationId").notNull().references(() => agentDelegations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    status: status_brouillon_simuleeEnum("status").default("brouillon").notNull(),
    scheduledFor: timestamp("scheduledFor"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    scheduleCronExpression: varchar("scheduleCronExpression", { length: 80 }),
    scheduleTimeZone: varchar("scheduleTimeZone", { length: 80 }).default("Africa/Conakry").notNull(),
    nextExecutionAt: timestamp("nextExecutionAt"),
    lastExecutedAt: timestamp("lastExecutedAt"),
    lastExecutionStatus: lastExecutionStatusEnum("lastExecutionStatus").default("pending").notNull(),
    eligibleCount: integer("eligibleCount").default(0).notNull(),
    preparedById: integer("preparedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: integer("approvedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    secondApprovedById: integer("secondApprovedById").references(() => users.id, { onDelete: "set null" }),
    secondApprovedAt: timestamp("secondApprovedAt"),
    activatedById: integer("activatedById").references(() => users.id, { onDelete: "set null" }),
    suspendedById: integer("suspendedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [
    index("agent_campaigns_delegation_status_idx").on(table.delegationId, table.status),
    index("agent_campaigns_scheduled_status_idx").on(table.scheduledFor, table.status),
    index("agent_campaigns_schedule_uid_idx").on(table.scheduleCronTaskUid)
  ]
);
var agentMessageJobs = pgTable(
  "agent_message_jobs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: integer("campaignId").notNull().references(() => agentCampaigns.id, { onDelete: "cascade" }),
    clientId: integer("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
    documentId: integer("documentId").notNull().references(() => documents.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    contentHash: varchar("contentHash", { length: 128 }).notNull(),
    status: status_simulation_prete_remis_testEnum("status").default("simulation_prete").notNull(),
    blockedReason: varchar("blockedReason", { length: 500 }),
    scheduledFor: timestamp("scheduledFor"),
    policySnapshot: text("policySnapshot").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [
    unique("agent_message_jobs_idempotency_unique").on(table.idempotencyKey),
    index("agent_message_jobs_campaign_status_idx").on(table.campaignId, table.status),
    index("agent_message_jobs_document_idx").on(table.documentId)
  ]
);
var agentTestEmailDeliveries = pgTable(
  "agent_test_email_deliveries",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: integer("campaignId").notNull().references(() => agentCampaigns.id, { onDelete: "cascade" }),
    messageJobId: integer("messageJobId").notNull().references(() => agentMessageJobs.id, { onDelete: "cascade" }),
    testRecipient: varchar("testRecipient", { length: 255 }).default("Bo\xEEte de test Lucepress").notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    status: status_previsualise_remis_testEnum("status").default("previsualise").notNull(),
    runKey: varchar("runKey", { length: 255 }).notNull(),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    unique("agent_test_email_deliveries_run_key_unique").on(table.runKey),
    index("agent_test_email_deliveries_campaign_date_idx").on(table.campaignId, table.createdAt),
    index("agent_test_email_deliveries_job_idx").on(table.messageJobId)
  ]
);
var agentAuditLogs = pgTable(
  "agent_audit_logs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    delegationId: integer("delegationId").references(() => agentDelegations.id, { onDelete: "set null" }),
    campaignId: integer("campaignId").references(() => agentCampaigns.id, { onDelete: "set null" }),
    actorId: integer("actorId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    target: varchar("target", { length: 255 }),
    decision: decisionEnum("decision").default("information").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    index("agent_audit_logs_delegation_date_idx").on(table.delegationId, table.createdAt),
    index("agent_audit_logs_campaign_date_idx").on(table.campaignId, table.createdAt),
    index("agent_audit_logs_actor_date_idx").on(table.actorId, table.createdAt)
  ]
);
var documentSequences = pgTable(
  "document_sequences",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    kind: kindEnum("kind").notNull(),
    lastValue: integer("lastValue").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [unique("document_sequences_kind_unique").on(table.kind)]
);
var emailTemplates = pgTable(
  "email_templates",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").references(() => tenants.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    html: text("html").notNull(),
    text: text("text"),
    enabled: enabledEnum("enabled").default("oui").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().defaultNow().notNull()
  },
  (table) => [
    unique("email_templates_tenant_slug_unique").on(table.tenantId, table.slug),
    index("email_templates_slug_idx").on(table.slug)
  ]
);

// shared/identityPaperwork.ts
var IDENTITY_KINDS = [
  "immatriculee",
  "en_immatriculation",
  "personne_physique",
  "sans_immatriculation",
  "autre"
];
function isIdentityKind(value) {
  return IDENTITY_KINDS.includes(value ?? "");
}
function normalizeIdentityKind(value) {
  return isIdentityKind(value) ? value : "immatriculee";
}
function isPaperworkMissingField(field) {
  return /taxid|nif|rccm|immatricul|registration/i.test(field.replace(/\s/g, ""));
}
function omitOptionalPaperworkMissingFields(fields) {
  return fields.filter((field) => !isPaperworkMissingField(field));
}

// shared/documentShare.ts
import { createHash, randomBytes } from "node:crypto";
var DOCUMENT_SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1e3;
var DOCUMENT_SHARE_TOKEN_BYTES = 32;
function createDocumentShareToken() {
  return randomBytes(DOCUMENT_SHARE_TOKEN_BYTES).toString("hex");
}
function hashDocumentShareToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function isPlausibleDocumentShareToken(token) {
  return /^[a-f0-9]{64}$/i.test(token.trim());
}
var GUEST_DOCUMENT_INVALID_MESSAGE = "Ce lien est invalide, expir\xE9 ou n\u2019est plus disponible. Demandez un nouvel envoi \xE0 Lucepres.";
function computeDocumentShareExpiry(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const maxExpiry = new Date(now.getTime() + DOCUMENT_SHARE_TTL_MS);
  const candidates = [maxExpiry.getTime()];
  if (input.validUntil) {
    const validUntil = new Date(input.validUntil);
    if (!Number.isNaN(validUntil.getTime())) {
      candidates.push(Math.min(maxExpiry.getTime(), validUntil.getTime() + 14 * 864e5));
    }
  }
  if (input.dueDate) {
    const dueDate = new Date(input.dueDate);
    if (!Number.isNaN(dueDate.getTime())) {
      candidates.push(Math.min(maxExpiry.getTime(), dueDate.getTime() + 60 * 864e5));
    }
  }
  return new Date(Math.max(...candidates.filter((value) => value >= now.getTime()), now.getTime() + 14 * 864e5));
}

// shared/clientDuplicates.ts
function normalizeText(value) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function normalizePhone(value) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.startsWith("224") && digits.length > 9 ? digits.slice(3) : digits;
}
function findPotentialClientDuplicates(clients2, candidate, excludedId) {
  const candidateName = normalizeText(candidate.companyName);
  const candidateEmail = normalizeText(candidate.email);
  const candidatePhone = normalizePhone(candidate.phone);
  return clients2.flatMap((client) => {
    if (client.id === excludedId) return [];
    const reasons = [];
    if (candidateName.length > 2 && candidateName === normalizeText(client.companyName)) reasons.push("raison sociale identique");
    if (candidateEmail.length > 3 && candidateEmail === normalizeText(client.email)) reasons.push("e-mail identique");
    if (candidatePhone.length >= 6 && candidatePhone === normalizePhone(client.phone)) reasons.push("t\xE9l\xE9phone identique");
    return reasons.length ? [{ client, reasons }] : [];
  });
}

// shared/clientActivityTimeline.ts
function buildClientActivityTimeline(clientId, documents2, activities, payments2 = []) {
  const documentEvents = documents2.map((document) => ({
    id: `document-${document.id}`,
    clientId,
    documentId: document.id,
    type: "document_genere",
    title: `${document.kind === "facture" ? "Facture" : "Devis"} ${document.number} g\xE9n\xE9r\xE9`,
    description: `Document ${document.status.replaceAll("_", " ")} \xB7 ${document.total.toLocaleString("fr-GN")} GNF`,
    createdAt: document.createdAt
  }));
  const reminderEvents = activities.map((activity) => ({ ...activity, id: `activity-${activity.id}` }));
  const paymentEvents = payments2.map((payment) => ({
    id: `payment-${payment.id}`,
    clientId,
    documentId: payment.documentId,
    type: "paiement_enregistre",
    title: `Paiement de ${payment.amount.toLocaleString("fr-GN")} GNF enregistr\xE9`,
    description: `Facture ${payment.documentNumber} \xB7 ${payment.method.replaceAll("_", " ")}${payment.reference ? ` \xB7 R\xE9f. ${payment.reference}` : ""}`,
    createdAt: payment.paidAt ?? payment.createdAt
  }));
  return [...documentEvents, ...reminderEvents, ...paymentEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// shared/companyProfile.ts
var LUCEPRES_PUBLIC_PROFILE = {
  displayName: "Lucepres",
  legalName: "Lucepres Sarl",
  location: "Conakry, Guin\xE9e",
  phone: "+224 624 19 06 20",
  email: "Lucepres@gmail.com",
  positioning: "Solutions durables",
  documentFooter: "Solutions durables pour les communaut\xE9s."
};

// shared/depositInvoice.ts
function calculateDepositInvoiceAmount(quoteTotal, depositPercent) {
  if (!Number.isInteger(depositPercent) || !depositPercent || depositPercent < 1 || depositPercent > 99) throw new Error("Le devis ne comporte pas d\u2019acompte valide.");
  if (!Number.isInteger(quoteTotal) || quoteTotal <= 0) throw new Error("Le devis doit avoir un montant total positif.");
  return Math.round(quoteTotal * depositPercent / 100);
}

// shared/balanceInvoice.ts
function calculateBalanceInvoiceAmount(quoteTotal, depositInvoiceTotal) {
  if (!Number.isInteger(quoteTotal) || quoteTotal <= 0) throw new Error("Le devis d\u2019origine doit avoir un montant total positif.");
  if (!Number.isInteger(depositInvoiceTotal) || depositInvoiceTotal <= 0) throw new Error("La facture d\u2019acompte doit avoir un montant positif.");
  const balance = quoteTotal - depositInvoiceTotal;
  if (balance <= 0) throw new Error("Le devis ne comporte pas de solde \xE0 facturer.");
  return balance;
}
function assertDepositInvoiceIsFullyPaid(depositInvoiceTotal, paidAmount) {
  if (!Number.isInteger(depositInvoiceTotal) || depositInvoiceTotal <= 0) throw new Error("La facture d\u2019acompte doit avoir un montant positif.");
  if (!Number.isInteger(paidAmount) || paidAmount < depositInvoiceTotal) throw new Error("La facture d\u2019acompte doit \xEAtre int\xE9gralement r\xE9gl\xE9e avant de cr\xE9er le solde.");
}
function reuseExistingGeneratedInvoice(existing) {
  return existing ? { ...existing, existing: true } : null;
}

// shared/discounts.ts
function calculateDocumentDiscount(lines, discountPercent = 0) {
  const totals = calculateDocumentTotals(lines);
  const normalizedPercent = Number.isInteger(discountPercent) && discountPercent >= 0 && discountPercent <= 99 ? discountPercent : 0;
  const discountAmount = Math.round(totals.total * normalizedPercent / 100);
  return { ...totals, discountPercent: normalizedPercent, discountAmount, totalAfterDiscount: totals.total - discountAmount };
}

// shared/integrationAdapterPreparation.ts
var INTEGRATION_ADAPTER_PREPARATIONS = [
  {
    providerSlug: "whatsapp-business",
    mode: "api",
    activationChecklist: ["Compte WhatsApp Business v\xE9rifi\xE9", "Mod\xE8les de messages valid\xE9s", "Secret webhook configur\xE9 c\xF4t\xE9 serveur"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false
  },
  {
    providerSlug: "google-workspace",
    mode: "api",
    activationChecklist: ["Application OAuth enregistr\xE9e", "Scopes Drive et Calendar minimis\xE9s", "Compte administrateur autoris\xE9"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false
  },
  {
    providerSlug: "procore",
    mode: "api",
    activationChecklist: ["Application Procore approuv\xE9e", "Soci\xE9t\xE9 et projets mapp\xE9s", "Droits d\u2019\xE9criture chantier confirm\xE9s"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false
  },
  {
    providerSlug: "quickbooks-online",
    mode: "api",
    activationChecklist: ["Application Intuit autoris\xE9e", "Soci\xE9t\xE9 comptable s\xE9lectionn\xE9e", "R\xE8gles de rapprochement valid\xE9es"],
    executionPolicy: "validation_humaine",
    readyForExternalExecution: false
  },
  {
    providerSlug: "workspace-mcp",
    mode: "mcp",
    activationChecklist: ["Serveur MCP inscrit sur liste blanche", "Capacit\xE9s d\xE9couvertes et approuv\xE9es", "Politique lecture seule confirm\xE9e"],
    executionPolicy: "lecture_seulement",
    readyForExternalExecution: false
  }
];
function getIntegrationAdapterPreparation(providerSlug) {
  return INTEGRATION_ADAPTER_PREPARATIONS.find((item) => item.providerSlug === providerSlug) ?? null;
}

// shared/integrationRegistry.ts
var DEFAULT_INTEGRATION_PROVIDERS = [
  {
    slug: "whatsapp-business",
    name: "WhatsApp Business",
    category: "communication",
    transport: "api",
    documentationUrl: "https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 10,
    capabilities: [
      { code: "send_message", label: "Pr\xE9parer et envoyer un message approuv\xE9", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
      { code: "read_delivery_status", label: "Lire les statuts de livraison", direction: "lecture", riskLevel: "faible", requiresApproval: "non" }
    ]
  },
  {
    slug: "google-workspace",
    name: "Google Workspace",
    category: "collaboration",
    transport: "api",
    documentationUrl: "https://developers.google.com/workspace/calendar/api/guides/overview",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 20,
    capabilities: [
      { code: "archive_document", label: "Archiver un document dans Drive", direction: "ecriture", riskLevel: "moyen", requiresApproval: "oui" },
      { code: "create_calendar_event", label: "Cr\xE9er une \xE9ch\xE9ance de chantier", direction: "ecriture", riskLevel: "moyen", requiresApproval: "oui" },
      { code: "read_calendar", label: "Lire les \xE9ch\xE9ances autoris\xE9es", direction: "lecture", riskLevel: "faible", requiresApproval: "non" }
    ]
  },
  {
    slug: "procore",
    name: "Procore",
    category: "chantier",
    transport: "api",
    documentationUrl: "https://developers.procore.com/documentation/introduction",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 30,
    capabilities: [
      { code: "read_project", label: "Lire un projet de chantier", direction: "lecture", riskLevel: "faible", requiresApproval: "non" },
      { code: "sync_project_document", label: "Synchroniser un document de chantier", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
      { code: "create_daily_log", label: "Cr\xE9er un rapport journalier", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" }
    ]
  },
  {
    slug: "quickbooks-online",
    name: "QuickBooks Online",
    category: "comptabilite",
    transport: "api",
    documentationUrl: "https://developer.intuit.com/app/developer/qbo/docs/get-started",
    authType: "oauth2",
    isSupported: "oui",
    sortOrder: 40,
    capabilities: [
      { code: "read_company", label: "V\xE9rifier la soci\xE9t\xE9 comptable", direction: "lecture", riskLevel: "faible", requiresApproval: "non" },
      { code: "sync_customer", label: "Synchroniser un client", direction: "ecriture", riskLevel: "moyen", requiresApproval: "oui" },
      { code: "create_invoice", label: "Cr\xE9er une facture comptable", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" },
      { code: "record_payment", label: "Enregistrer un paiement comptable", direction: "ecriture", riskLevel: "eleve", requiresApproval: "oui" }
    ]
  },
  {
    slug: "workspace-mcp",
    name: "Workspace via MCP",
    category: "collaboration",
    transport: "mcp",
    documentationUrl: "https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture",
    authType: "oauth2",
    isSupported: "non",
    sortOrder: 50,
    capabilities: [
      { code: "discover_tools", label: "D\xE9couvrir les outils MCP autoris\xE9s", direction: "lecture", riskLevel: "moyen", requiresApproval: "non" },
      { code: "read_context", label: "Lire un contexte de travail autoris\xE9", direction: "lecture", riskLevel: "moyen", requiresApproval: "non" }
    ]
  }
];
function parseGrantedScopes(serialized) {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) && parsed.every((scope) => typeof scope === "string") ? parsed : [];
  } catch {
    return [];
  }
}

// shared/googleWorkspaceOAuth.ts
var GOOGLE_WORKSPACE_SCOPE_OPTIONS = [
  { value: "https://www.googleapis.com/auth/calendar.readonly", label: "Lire les calendriers autoris\xE9s" },
  { value: "https://www.googleapis.com/auth/calendar.events", label: "Cr\xE9er des \xE9ch\xE9ances de chantier" },
  { value: "https://www.googleapis.com/auth/drive.file", label: "Archiver les documents cr\xE9\xE9s par Lucepres" }
];
var allowedScopes = new Set(GOOGLE_WORKSPACE_SCOPE_OPTIONS.map((scope) => scope.value));
function normalizeGoogleWorkspaceScopes(scopes) {
  const unique2 = Array.from(new Set(scopes.filter((scope) => allowedScopes.has(scope))));
  if (!unique2.length) throw new Error("S\xE9lectionnez au moins une autorisation Google Workspace.");
  return unique2;
}
function buildGoogleWorkspaceAuthorizationUrl(input) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: input.state
  }).toString();
  return url.toString();
}

// server/integrations/connectionSecurity.ts
var opaqueReferencePattern = /^integrations\/[a-z0-9/_-]{3,255}$/i;
function createPreparedIntegrationConnectionValues(userId) {
  return {
    status: "credentials_pending",
    grantedScopes: null,
    secretRef: null,
    lastError: null,
    lastHealthCheckAt: null,
    enabledById: userId,
    connectedAt: null
  };
}
function assertOpaqueIntegrationSecretReference(secretRef) {
  if (!opaqueReferencePattern.test(secretRef)) throw new Error("La connexion ne peut conserver qu\u2019une r\xE9f\xE9rence de secret opaque.");
  return secretRef;
}

// server/integrations/adapterRegistry.ts
var IntegrationExecutionBlockedError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "IntegrationExecutionBlockedError";
  }
};
function createAdapter(descriptor) {
  return {
    descriptor,
    describe: () => descriptor,
    async execute(request, dispatch) {
      if (request.providerSlug !== descriptor.providerSlug) throw new IntegrationExecutionBlockedError("L\u2019adaptateur s\xE9lectionn\xE9 ne correspond pas \xE0 cette connexion.");
      if (!descriptor.supportedOperations.includes(request.operation)) throw new IntegrationExecutionBlockedError("Cette op\xE9ration n\u2019est pas autoris\xE9e par l\u2019adaptateur.");
      if (!request.explicitActivation || request.connectionStatus !== "active") throw new IntegrationExecutionBlockedError("Aucun appel externe n\u2019est permis avant l\u2019activation explicite de la connexion.");
      try {
        if (!request.secretRef) throw new Error();
        assertOpaqueIntegrationSecretReference(request.secretRef);
      } catch {
        throw new IntegrationExecutionBlockedError("Une r\xE9f\xE9rence de secret opaque est requise avant toute ex\xE9cution externe.");
      }
      if (descriptor.requiresHumanApproval && !request.approvalId) throw new IntegrationExecutionBlockedError("Une approbation m\xE9tier est requise avant cette op\xE9ration externe.");
      return dispatch({ connectionId: request.connectionId, providerSlug: request.providerSlug, operation: request.operation, secretRef: request.secretRef });
    }
  };
}
var adapters = [
  createAdapter({ providerSlug: "whatsapp-business", displayName: "WhatsApp Business", transport: "api", supportedOperations: ["send_message", "read_delivery_status"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "google-workspace", displayName: "Google Workspace", transport: "api", supportedOperations: ["archive_document", "create_calendar_event", "read_calendar"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "procore", displayName: "Procore", transport: "api", supportedOperations: ["read_project", "sync_project_document", "create_daily_log"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "quickbooks-online", displayName: "QuickBooks Online", transport: "api", supportedOperations: ["read_company", "sync_customer", "create_invoice", "record_payment"], requiresHumanApproval: true, executionEnabledByDefault: false }),
  createAdapter({ providerSlug: "workspace-mcp", displayName: "Workspace via MCP", transport: "mcp", supportedOperations: ["discover_tools", "read_context"], requiresHumanApproval: false, executionEnabledByDefault: false })
];
var adaptersBySlug = new Map(adapters.map((adapter) => [adapter.descriptor.providerSlug, adapter]));
function resolveIntegrationAdapter(providerSlug) {
  return adaptersBySlug.get(providerSlug) ?? null;
}

// server/integrations/secretConfiguration.ts
function getIntegrationSecretConfiguration(environment = process.env) {
  return {
    googleOAuthConfigured: Boolean(environment.GOOGLE_OAUTH_CLIENT_SECRET),
    whatsappWebhookConfigured: Boolean(environment.WHATSAPP_APP_SECRET && environment.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
  };
}
function requireIntegrationSecret(value, label) {
  if (!value) throw new Error(`${label} n\u2019est pas encore configur\xE9. Le flux externe reste d\xE9sactiv\xE9.`);
  return value;
}

// shared/projectFinancials.ts
function calculateProjectMargin({ revenueCollected, costTotal, plannedRevenue = 0, plannedBudget = 0, minimumMarginRate = null }) {
  const margin = revenueCollected - costTotal;
  const hasPlannedMargin = plannedRevenue > 0 && plannedBudget > 0;
  const plannedMargin = hasPlannedMargin ? plannedRevenue - plannedBudget : null;
  const marginRate = revenueCollected > 0 ? Math.round(margin / revenueCollected * 1e3) / 10 : null;
  const hasMinimumMarginRate = minimumMarginRate !== null;
  return {
    revenueCollected,
    costTotal,
    margin,
    marginRate,
    plannedRevenue,
    plannedBudget,
    plannedMargin,
    plannedMarginRate: hasPlannedMargin ? Math.round(plannedMargin / plannedRevenue * 1e3) / 10 : null,
    marginVariance: plannedMargin === null ? null : margin - plannedMargin,
    minimumMarginRate,
    isMarginBelowTarget: hasMinimumMarginRate && marginRate !== null && marginRate < minimumMarginRate
  };
}

// shared/receivables.ts
function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}
function getDaysOverdue(dueDate, now = /* @__PURE__ */ new Date()) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(0, Math.floor((startOfDay(now) - startOfDay(due)) / 864e5));
}
function isPaymentPromiseOverdue(promisedDate, now = /* @__PURE__ */ new Date()) {
  if (!promisedDate) return false;
  const promised = new Date(promisedDate);
  if (Number.isNaN(promised.getTime())) return false;
  return startOfDay(promised) < startOfDay(now);
}
function isPaymentPromiseDueSoon(promisedDate, now = /* @__PURE__ */ new Date(), days = 7) {
  if (!promisedDate) return false;
  const promised = new Date(promisedDate);
  if (Number.isNaN(promised.getTime())) return false;
  const today = startOfDay(now);
  const deadline = today + days * 864e5;
  const promisedDay = startOfDay(promised);
  return promisedDay >= today && promisedDay <= deadline;
}
function summarizeReceivables(documents2, now = /* @__PURE__ */ new Date()) {
  const invoices = documents2.filter((document) => document.balanceDue > 0).map((document) => ({ ...document, daysOverdue: document.isOverdue ? getDaysOverdue(document.dueDate, now) : 0, isPaymentPromiseOverdue: isPaymentPromiseOverdue(document.paymentPromise?.promisedDate, now), isPaymentPromiseDueSoon: isPaymentPromiseDueSoon(document.paymentPromise?.promisedDate, now) })).sort((left, right) => Number(right.isPaymentPromiseOverdue) - Number(left.isPaymentPromiseOverdue) || Number(right.isOverdue) - Number(left.isOverdue) || right.daysOverdue - left.daysOverdue || right.balanceDue - left.balanceDue);
  const overdue = invoices.filter((invoice) => invoice.isOverdue);
  const current = invoices.filter((invoice) => !invoice.isOverdue);
  const expiredPromises = invoices.filter((invoice) => invoice.isPaymentPromiseOverdue);
  const upcomingPromises = invoices.filter((invoice) => invoice.isPaymentPromiseDueSoon).sort((left, right) => new Date(left.paymentPromise.promisedDate).getTime() - new Date(right.paymentPromise.promisedDate).getTime());
  return {
    invoices,
    upcomingPromises,
    summary: {
      openCount: invoices.length,
      overdueCount: overdue.length,
      outstandingTotal: invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      overdueTotal: overdue.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      currentTotal: current.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      expiredPromiseCount: expiredPromises.length,
      expiredPromiseTotal: expiredPromises.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      upcomingPromiseCount: upcomingPromises.length,
      upcomingPromiseTotal: upcomingPromises.reduce((sum, invoice) => sum + invoice.balanceDue, 0)
    }
  };
}

// shared/collectionFollowUp.ts
var collectionFollowUpLabels = {
  a_traiter: "\xC0 traiter",
  contacte: "Contact\xE9",
  a_rappeler: "\xC0 rappeler"
};
function normalizeCollectionReminderDate(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) throw new Error("La date de rappel est invalide.");
  const date2 = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date2.getTime()) || date2.toISOString().slice(0, 10) !== value) throw new Error("La date de rappel est invalide.");
  return date2;
}
function validateCollectionReminder(status, reminderDate, now = /* @__PURE__ */ new Date()) {
  if (status !== "a_rappeler") return null;
  if (!reminderDate) return "Choisissez une date de rappel pour ce statut.";
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (reminderDate < today) return "La date de rappel doit \xEAtre aujourd\u2019hui ou ult\xE9rieure.";
  return null;
}
function isCollectionReportMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
function collectionMonthBounds(value) {
  if (!isCollectionReportMonth(value)) throw new Error("Le mois du rapport est invalide.");
  const [year, month] = value.split("-").map(Number);
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

// shared/workspaceSearch.ts
function normalizeWorkspaceSearch(value) {
  return value.trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function dayTimestamp(value) {
  if (!value) return null;
  const timestamp2 = new Date(value).getTime();
  return Number.isNaN(timestamp2) ? null : new Date(timestamp2).setHours(0, 0, 0, 0);
}
function matchesFilters(result, filters) {
  if (filters.kind && result.kind !== filters.kind) return false;
  const timestamp2 = dayTimestamp(result.date);
  const from = dayTimestamp(filters.dateFrom);
  const to = dayTimestamp(filters.dateTo);
  if ((from !== null || to !== null) && timestamp2 === null) return false;
  if (from !== null && timestamp2 < from) return false;
  if (to !== null && timestamp2 > to) return false;
  if (filters.status && result.status !== filters.status) return false;
  if (filters.amountMin !== void 0 && (result.amount === null || result.amount === void 0 || result.amount < filters.amountMin)) return false;
  if (filters.amountMax !== void 0 && (result.amount === null || result.amount === void 0 || result.amount > filters.amountMax)) return false;
  return true;
}
function compareNullable(left, right, direction) {
  const leftMissing = left === null || left === void 0 || left === "";
  const rightMissing = right === null || right === void 0 || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  const comparison = left < right ? -1 : left > right ? 1 : 0;
  return direction === "asc" ? comparison : -comparison;
}
function buildWorkspaceSearchResults(input) {
  const query = normalizeWorkspaceSearch(input.query);
  const filters = input.filters || {};
  if (query.length < 2) return [];
  const indexed = [
    ...input.clients.map((client) => ({ result: { id: client.id, kind: "client", title: client.companyName, subtitle: ["Client", client.contactName || client.email || client.phone].filter(Boolean).join(" \xB7 "), href: `/clients?clientId=${client.id}`, date: client.updatedAt || client.createdAt || null, status: null, amount: null }, terms: [client.companyName, client.contactName, client.email, client.phone] })),
    ...input.documents.map((document) => ({ result: { id: document.id, kind: document.kind, title: document.number, subtitle: [document.clientName, document.projectName, document.status].filter(Boolean).join(" \xB7 "), href: `/documents/${document.id}`, date: document.issueDate || null, status: document.status, amount: document.total ?? null }, terms: [document.number, document.clientName, document.projectName, document.status] })),
    ...input.receivables.map((receivable) => ({ result: { id: receivable.id, kind: "creance", title: receivable.number, subtitle: ["Cr\xE9ance", receivable.clientName, receivable.collectionStatus].filter(Boolean).join(" \xB7 "), href: `/creances?facture=${receivable.id}`, date: receivable.dueDate || receivable.issueDate || null, status: receivable.collectionStatus, amount: receivable.balanceDue }, terms: [receivable.number, receivable.clientName, receivable.collectionStatus] }))
  ];
  return indexed.map((entry) => ({ ...entry, normalized: entry.terms.filter(Boolean).map((term) => normalizeWorkspaceSearch(String(term))) })).filter((entry) => entry.normalized.some((term) => term.includes(query)) && matchesFilters(entry.result, filters)).sort((left, right) => {
    const direction = filters.sortDirection || "desc";
    if (filters.sortBy === "date") return compareNullable(dayTimestamp(left.result.date), dayTimestamp(right.result.date), direction);
    if (filters.sortBy === "amount") return compareNullable(left.result.amount, right.result.amount, direction);
    if (filters.sortBy === "status") return compareNullable(normalizeWorkspaceSearch(left.result.status || ""), normalizeWorkspaceSearch(right.result.status || ""), direction);
    return Number(right.normalized.some((term) => term.startsWith(query))) - Number(left.normalized.some((term) => term.startsWith(query))) || left.result.title.localeCompare(right.result.title, "fr");
  }).slice(0, 24).map((entry) => entry.result);
}

// shared/agentDelegationPolicy.ts
var AGENT_DELEGATION_MAX_DAYS = 90;
var AGENT_DAILY_LIMIT = 60;
var AGENT_SECOND_APPROVAL_THRESHOLD = 20;
function getDelegationPolicyErrors(input) {
  const errors = {};
  const durationMs = input.expiresAt.getTime() - input.startsAt.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) errors.expiresAt = "La date d\u2019expiration doit \xEAtre post\xE9rieure au d\xE9but de la d\xE9l\xE9gation.";
  if (durationMs > AGENT_DELEGATION_MAX_DAYS * 864e5) errors.expiresAt = `Une d\xE9l\xE9gation ne peut pas d\xE9passer ${AGENT_DELEGATION_MAX_DAYS} jours.`;
  if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > AGENT_DAILY_LIMIT) errors.dailyLimit = `Le plafond doit \xEAtre compris entre 1 et ${AGENT_DAILY_LIMIT} messages par jour.`;
  if (!Number.isInteger(input.contactCooldownDays) || input.contactCooldownDays < 1 || input.contactCooldownDays > 30) errors.contactCooldownDays = "Le d\xE9lai minimal par contact doit \xEAtre compris entre 1 et 30 jours.";
  return errors;
}
function requiresSecondApproval(eligibleCount) {
  return eligibleCount > AGENT_SECOND_APPROVAL_THRESHOLD;
}
function createAgentMessageDraft(input) {
  const politeIntro = input.tone === "ferme" ? "Nous vous invitons \xE0 nous indiquer sans d\xE9lai la suite \xE0 donner." : "Nous restons \xE0 votre disposition pour toute pr\xE9cision utile.";
  if (input.purpose === "relance_facture") {
    const dueDate = input.dueDate ? new Date(input.dueDate).toLocaleDateString("fr-FR") : "\xE0 v\xE9rifier";
    return {
      subject: `Rappel \u2014 facture ${input.documentNumber}`,
      body: `Bonjour ${input.clientName},

Nous vous adressons un rappel concernant la facture ${input.documentNumber}, dont le solde enregistr\xE9 est de ${(input.balanceDue ?? 0).toLocaleString("fr-FR")} GNF. Son \xE9ch\xE9ance est fix\xE9e au ${dueDate}.

${politeIntro}

Cordialement,
Lucepress Solutions Durables

Brouillon IA \u2014 relecture administrateur obligatoire.`
    };
  }
  const validUntil = input.validUntil ? new Date(input.validUntil).toLocaleDateString("fr-FR") : "\xE0 confirmer";
  return {
    subject: `Suivi \u2014 devis ${input.documentNumber}`,
    body: `Bonjour ${input.clientName},

Nous souhaitons savoir si vous avez pu examiner notre devis ${input.documentNumber}, valable jusqu\u2019au ${validUntil}. Nous pouvons r\xE9pondre \xE0 vos questions ou ajuster les \xE9l\xE9ments techniques apr\xE8s \xE9change avec vous.

${politeIntro}

Cordialement,
Lucepress Solutions Durables

Brouillon IA \u2014 relecture administrateur obligatoire.`
  };
}
function isCampaignEligibleForSimulation(input) {
  if (input.purpose === "relance_facture") return input.kind === "facture" && input.balanceDue > 0 && input.isOverdue;
  return input.kind === "devis" && input.status === "envoye";
}

// shared/documentConcurrency.ts
function isConcurrentDocumentUpdate(storedUpdatedAt, expectedUpdatedAt) {
  if (!expectedUpdatedAt || !storedUpdatedAt) return false;
  const stored = new Date(storedUpdatedAt).getTime();
  const expected = new Date(expectedUpdatedAt).getTime();
  if (Number.isNaN(stored) || Number.isNaN(expected)) return false;
  return stored !== expected;
}

// server/db.ts
init_env();
import { createHash as createHash3, randomBytes as randomBytes4 } from "node:crypto";

// server/_core/dbPool.ts
var DEFAULT_POOL = 10;
var MIN_POOL = 2;
var MAX_POOL = 50;
function parseDatabasePoolSize(raw) {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_POOL;
  return Math.min(MAX_POOL, Math.max(MIN_POOL, parsed));
}

// server/db.ts
var _db = null;
var _client = null;
var _lastDbError = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (_client) {
        try {
          await _client.end();
        } catch {
        }
      }
      _client = postgres(process.env.DATABASE_URL, {
        max: parseDatabasePoolSize(process.env.DATABASE_POOL_SIZE),
        connect_timeout: 10,
        idle_timeout: 30,
        prepare: false
      });
      _db = drizzle(_client);
      await _client`SELECT 1`;
    } catch (error) {
      _lastDbError = error instanceof Error ? error.message : String(error);
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _client = null;
    }
  }
  return _db;
}
function getLastDbError() {
  return _lastDbError;
}
async function pingDatabase() {
  try {
    const db = await getDb();
    if (!db || !_client) return false;
    await _client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("La base de donn\xE9es Lucepress est indisponible.");
  return db;
}
async function upsertUser(user2) {
  if (!user2.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user2.openId };
  const updateSet = {};
  ["name", "email", "loginMethod"].forEach((field) => {
    if (user2[field] !== void 0) {
      values[field] = user2[field] ?? null;
      updateSet[field] = user2[field] ?? null;
    }
  });
  values.lastSignedIn = user2.lastSignedIn ?? /* @__PURE__ */ new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user2.role !== void 0) {
    values.role = user2.role;
    updateSet.role = user2.role;
  } else if (user2.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getUserByEmail(email, tenantId) {
  const db = await getDb();
  if (!db) return void 0;
  const filter = tenantId != null ? and(eq(users.email, email), eq(users.tenantId, tenantId)) : eq(users.email, email);
  const result = await db.select().from(users).where(filter).limit(1);
  return result[0];
}
async function createLocalUser(input) {
  const db = await requireDb();
  const openId = `local_${randomBytes4(12).toString("hex")}`;
  const result = await db.insert(users).values({
    openId,
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name ?? null,
    loginMethod: "email",
    role: input.role,
    tenantId: input.tenantId ?? 1,
    lastSignedIn: /* @__PURE__ */ new Date()
  }).returning({ id: users.id });
  return { id: result[0].id, openId };
}
async function countUsersWithPassword() {
  const db = await requireDb();
  const result = await db.select({ value: sql`count(*)` }).from(users).where(sql`${users.passwordHash} is not null`);
  return Number(result[0]?.value ?? 0);
}
async function setUserPasswordHash(userId, passwordHash) {
  const db = await requireDb();
  await db.update(users).set({ passwordHash }).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
}
async function listUsers() {
  const db = await requireDb();
  return db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
    loginMethod: users.loginMethod,
    lastSignedIn: users.lastSignedIn,
    createdAt: users.createdAt
  }).from(users).where(eq(users.tenantId, currentTenant())).orderBy(asc(users.name), asc(users.email));
}
async function setUserRole(userId, role) {
  const db = await requireDb();
  await db.update(users).set({ role }).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
}
async function resetUserPassword(userId, passwordHash) {
  const db = await requireDb();
  await db.update(users).set({ passwordHash, loginMethod: "email" }).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
}
async function deleteUser(userId) {
  const db = await requireDb();
  const [cible] = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant()))).limit(1);
  if (!cible) return { deleted: false, reason: "compte_introuvable" };
  if (cible.role === "admin") {
    const [restant] = await db.select({ value: sql`count(*)` }).from(users).where(and(eq(users.role, "admin"), sql`${users.passwordHash} is not null`));
    if (Number(restant?.value ?? 0) <= 1) {
      return { deleted: false, reason: "dernier_admin" };
    }
  }
  await db.delete(users).where(and(eq(users.id, userId), eq(users.tenantId, currentTenant())));
  return { deleted: true };
}
var INVITATION_TTL_MS = 72 * 60 * 60 * 1e3;
async function createInvitation(input) {
  const db = await requireDb();
  const [row] = await db.insert(invitations).values({
    tenantId: input.tenantId ?? currentTenant(),
    tokenHash: input.tokenHash,
    email: input.email,
    role: input.role,
    invitedBy: input.invitedBy,
    status: "pending",
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS)
  }).returning({ id: invitations.id });
  return { id: row.id };
}
async function findInvitationByToken(token) {
  const { hashInvitationToken: hashInvitationToken2, isPlausibleInvitationToken: isPlausibleInvitationToken2 } = await Promise.resolve().then(() => (init_invitationToken(), invitationToken_exports));
  if (!isPlausibleInvitationToken2(token)) {
    return { reason: "not_found" };
  }
  const db = await requireDb();
  const tokenHash = hashInvitationToken2(token);
  const [inv] = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
  if (!inv) return { reason: "not_found" };
  if (inv.status === "accepted") return { invitation: inv, reason: "already_accepted" };
  if (inv.status === "revoked") return { invitation: inv, reason: "revoked" };
  if (inv.expiresAt.getTime() <= Date.now()) return { invitation: inv, reason: "expired" };
  return { invitation: inv, reason: "pending" };
}
async function rotateInvitationToken(id) {
  const db = await requireDb();
  const [inv] = await db.select().from(invitations).where(and(
    eq(invitations.id, id),
    eq(invitations.tenantId, currentTenant())
  )).limit(1);
  if (!inv || inv.status !== "pending") return null;
  if (inv.expiresAt.getTime() <= Date.now()) return null;
  const { createInvitationToken: createInvitationToken2, hashInvitationToken: hashInvitationToken2 } = await Promise.resolve().then(() => (init_invitationToken(), invitationToken_exports));
  const token = createInvitationToken2();
  const tokenHash = hashInvitationToken2(token);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  await db.update(invitations).set({ tokenHash, expiresAt }).where(and(
    eq(invitations.id, id),
    eq(invitations.tenantId, currentTenant())
  ));
  return { token, email: inv.email, role: inv.role, expiresAt };
}
async function markInvitationAccepted(tokenHash, acceptedByUser) {
  const db = await requireDb();
  await db.update(invitations).set({ status: "accepted", acceptedAt: /* @__PURE__ */ new Date(), acceptedByUser }).where(eq(invitations.tokenHash, tokenHash));
}
async function revokeInvitation(id) {
  const db = await requireDb();
  await db.update(invitations).set({ status: "revoked" }).where(and(eq(invitations.id, id), eq(invitations.tenantId, currentTenant())));
}
async function listInvitations() {
  const db = await requireDb();
  return db.select().from(invitations).where(eq(invitations.tenantId, currentTenant())).orderBy(desc(invitations.createdAt));
}
async function deleteInvitation(id) {
  const db = await requireDb();
  await db.delete(invitations).where(and(eq(invitations.id, id), eq(invitations.tenantId, currentTenant())));
}
var PASSWORD_RESET_TTL_MS = 60 * 60 * 1e3;
async function createPasswordReset(input) {
  const db = await requireDb();
  await db.update(passwordResets).set({ usedAt: /* @__PURE__ */ new Date() }).where(and(eq(passwordResets.userId, input.userId), sql`${passwordResets.usedAt} IS NULL`));
  const [row] = await db.insert(passwordResets).values({
    tenantId: input.tenantId ?? currentTenant(),
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS)
  }).returning({ id: passwordResets.id });
  return { id: row.id };
}
async function findPasswordResetByToken(token) {
  const db = await requireDb();
  const { verifyPassword: verifyPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
  const all = await db.select().from(passwordResets);
  for (const reset of all) {
    if (reset.usedAt) continue;
    if (reset.expiresAt.getTime() <= Date.now()) continue;
    const ok = await verifyPassword2(token, reset.tokenHash);
    if (ok) return reset;
  }
  return void 0;
}
async function markPasswordResetUsed(resetId) {
  const db = await requireDb();
  await db.update(passwordResets).set({ usedAt: /* @__PURE__ */ new Date() }).where(eq(passwordResets.id, resetId));
}
async function listClients() {
  const db = await requireDb();
  return db.select().from(clients).where(eq(clients.tenantId, currentTenant())).orderBy(asc(clients.companyName));
}
async function listCollectionAssignees() {
  const db = await requireDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.tenantId, currentTenant())).orderBy(asc(users.name));
}
async function getClientById(id) {
  const db = await requireDb();
  const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.tenantId, currentTenant()))).limit(1);
  return result[0];
}
async function createClient(input) {
  const db = await requireDb();
  const result = await db.insert(clients).values({
    tenantId: currentTenant(),
    companyName: input.companyName,
    contactName: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    taxId: input.taxId || null,
    identityKind: normalizeIdentityKind(input.identityKind),
    registrationNumber: input.registrationNumber || null,
    notes: input.notes || null,
    defaultDiscountPercent: input.defaultDiscountPercent ?? 0
  }).returning({ id: clients.id });
  return { id: result[0].id };
}
async function updateClient(id, input) {
  const db = await requireDb();
  await db.update(clients).set({
    companyName: input.companyName,
    contactName: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    taxId: input.taxId || null,
    identityKind: normalizeIdentityKind(input.identityKind),
    registrationNumber: input.registrationNumber || null,
    notes: input.notes || null,
    defaultDiscountPercent: input.defaultDiscountPercent ?? 0
  }).where(and(eq(clients.id, id), eq(clients.tenantId, currentTenant())));
  return { success: true };
}
async function findClientDuplicates(input, excludedId) {
  const existing = await listClients();
  return findPotentialClientDuplicates(existing, input, excludedId).map((match) => ({
    id: match.client.id,
    companyName: match.client.companyName,
    contactName: match.client.contactName,
    email: match.client.email,
    phone: match.client.phone,
    reasons: match.reasons
  }));
}
async function listClientAttachments(clientId) {
  const db = await requireDb();
  return db.select().from(clientAttachments).where(and(eq(clientAttachments.clientId, clientId), eq(clientAttachments.tenantId, currentTenant()))).orderBy(desc(clientAttachments.createdAt));
}
async function createClientAttachment(input) {
  const db = await requireDb();
  const result = await db.insert(clientAttachments).values({ ...input, tenantId: currentTenant() }).returning({ id: clientAttachments.id });
  return { id: result[0].id };
}
async function createClientActivity(input) {
  const db = await requireDb();
  const result = await db.insert(clientActivities).values({ tenantId: currentTenant(), ...input, documentId: input.documentId ?? null, description: input.description ?? null }).returning({ id: clientActivities.id });
  return { id: result[0].id };
}
async function listStaffAuditJournal(input) {
  const db = await requireDb();
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);
  const conditions = [eq(clientActivities.tenantId, currentTenant())];
  if (input?.type) conditions.push(eq(clientActivities.type, input.type));
  return db.select({
    id: clientActivities.id,
    type: clientActivities.type,
    title: clientActivities.title,
    description: clientActivities.description,
    createdAt: clientActivities.createdAt,
    clientId: clients.id,
    clientName: clients.companyName,
    documentId: documents.id,
    documentNumber: documents.number,
    actorId: users.id,
    actorName: users.name
  }).from(clientActivities).innerJoin(clients, and(eq(clientActivities.clientId, clients.id), eq(clients.tenantId, currentTenant()))).leftJoin(documents, and(eq(clientActivities.documentId, documents.id), eq(documents.tenantId, currentTenant()))).leftJoin(users, eq(clientActivities.createdById, users.id)).where(and(...conditions)).orderBy(desc(clientActivities.createdAt)).limit(limit);
}
var GUEST_HIDDEN_STATUSES = /* @__PURE__ */ new Set(["brouillon", "annule"]);
async function revokeActiveDocumentShareLinks(documentId) {
  const db = await requireDb();
  await db.update(documentShareLinks).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and(
    eq(documentShareLinks.documentId, documentId),
    eq(documentShareLinks.tenantId, currentTenant()),
    sql`${documentShareLinks.revokedAt} IS NULL`
  ));
}
async function issueDocumentShareLink(input) {
  const db = await requireDb();
  await revokeActiveDocumentShareLinks(input.documentId);
  const token = createDocumentShareToken();
  const tokenHash = hashDocumentShareToken(token);
  const expiresAt = computeDocumentShareExpiry({
    validUntil: input.validUntil,
    dueDate: input.dueDate
  });
  await db.insert(documentShareLinks).values({
    tenantId: currentTenant(),
    documentId: input.documentId,
    tokenHash,
    recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
    createdById: input.createdById,
    expiresAt
  });
  return { token, expiresAt };
}
async function loadGuestDocumentPayload(documentId, tenantId) {
  return runWithTenant(tenantId, async () => {
    const document = await getDocumentById(documentId);
    if (!document) return null;
    if (GUEST_HIDDEN_STATUSES.has(document.status)) return null;
    const company = await getCompanySettings();
    return {
      document: {
        id: document.id,
        kind: document.kind,
        number: document.number,
        status: document.status,
        issueDate: document.issueDate,
        dueDate: document.dueDate,
        validUntil: document.validUntil,
        depositPercent: document.depositPercent,
        depositDueDate: document.depositDueDate,
        balanceDueDate: document.balanceDueDate,
        discountPercent: document.discountPercent,
        discountAmount: document.discountAmount,
        subtotal: document.subtotal,
        taxTotal: document.taxTotal,
        total: document.total,
        notes: document.notes,
        clientName: document.clientName,
        contactName: document.contactName,
        clientAddress: document.clientAddress,
        projectName: document.projectName,
        lines: document.lines.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          lineTotal: line.lineTotal
        })),
        paidAmount: document.paidAmount,
        balanceDue: document.balanceDue,
        canRespond: document.kind === "devis" && document.status === "envoye"
      },
      company: {
        legalName: company.legalName,
        legalAddress: company.legalAddress,
        phone: company.phone,
        email: company.email,
        website: company.website,
        identityKind: company.identityKind,
        taxId: company.taxId,
        registrationNumber: company.registrationNumber,
        bankName: company.bankName,
        accountName: company.accountName,
        accountNumber: company.accountNumber,
        iban: company.iban,
        swift: company.swift,
        paymentInstructions: company.paymentInstructions,
        documentFooter: company.documentFooter
      }
    };
  });
}
async function getGuestDocumentByShareToken(token) {
  if (!isPlausibleDocumentShareToken(token)) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  const db = await requireDb();
  const tokenHash = hashDocumentShareToken(token.trim().toLowerCase());
  const [link] = await db.select().from(documentShareLinks).where(eq(documentShareLinks.tokenHash, tokenHash)).limit(1);
  if (!link || link.revokedAt || link.expiresAt.getTime() < Date.now()) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  const payload = await loadGuestDocumentPayload(link.documentId, link.tenantId);
  if (!payload) throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  await db.update(documentShareLinks).set({
    lastAccessAt: /* @__PURE__ */ new Date(),
    accessCount: sql`${documentShareLinks.accessCount} + 1`
  }).where(eq(documentShareLinks.id, link.id));
  return {
    ...payload,
    share: {
      expiresAt: link.expiresAt,
      recipientEmail: link.recipientEmail
    }
  };
}
async function respondToGuestQuoteByShareToken(input) {
  if (!isPlausibleDocumentShareToken(input.token)) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  const db = await requireDb();
  const tokenHash = hashDocumentShareToken(input.token.trim().toLowerCase());
  const [link] = await db.select().from(documentShareLinks).where(eq(documentShareLinks.tokenHash, tokenHash)).limit(1);
  if (!link || link.revokedAt || link.expiresAt.getTime() < Date.now()) {
    throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
  }
  return runWithTenant(link.tenantId, async () => {
    const document = await getDocumentById(link.documentId);
    if (!document || document.kind !== "devis") throw new Error(GUEST_DOCUMENT_INVALID_MESSAGE);
    if (document.status !== "envoye") {
      throw new Error("Ce devis n\u2019est plus en attente de votre r\xE9ponse.");
    }
    if (document.validUntil) {
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const validUntil = new Date(document.validUntil);
      validUntil.setHours(0, 0, 0, 0);
      if (validUntil < today) {
        throw new Error("Ce devis a expir\xE9. Contactez Lucepres pour une mise \xE0 jour.");
      }
    }
    const actorId = link.createdById ?? void 0;
    await updateDocumentStatus(document.id, input.decision, actorId, {
      title: input.decision === "accepte" ? "Devis accept\xE9 via lien e-mail" : "Devis refus\xE9 via lien e-mail",
      description: `${document.number} \xB7 d\xE9cision guest`
    });
    if (!actorId) {
      await db.insert(clientActivities).values({
        tenantId: link.tenantId,
        clientId: document.clientId,
        documentId: document.id,
        type: "statut_document",
        title: input.decision === "accepte" ? "Devis accept\xE9 via lien e-mail" : "Devis refus\xE9 via lien e-mail",
        description: `${document.number} \xB7 d\xE9cision guest`,
        createdById: null
      });
    }
    return { success: true, status: input.decision, number: document.number };
  });
}
async function listClientActivities(clientId) {
  const db = await requireDb();
  const [activities, clientDocuments, clientPayments] = await Promise.all([
    db.select().from(clientActivities).where(and(eq(clientActivities.clientId, clientId), eq(clientActivities.tenantId, currentTenant()))).orderBy(desc(clientActivities.createdAt)),
    db.select({ id: documents.id, kind: documents.kind, number: documents.number, total: documents.total, status: documents.status, createdAt: documents.createdAt }).from(documents).where(and(eq(documents.clientId, clientId), eq(documents.tenantId, currentTenant()))).orderBy(desc(documents.createdAt)),
    db.select({ id: payments.id, documentId: payments.documentId, documentNumber: documents.number, amount: payments.amount, method: payments.method, reference: payments.reference, paidAt: payments.paidAt, createdAt: payments.createdAt }).from(payments).innerJoin(documents, eq(payments.documentId, documents.id)).where(and(eq(documents.clientId, clientId), eq(documents.tenantId, currentTenant()))).orderBy(desc(payments.paidAt))
  ]);
  return buildClientActivityTimeline(clientId, clientDocuments, activities, clientPayments);
}
var emptyCompanySettings = () => ({
  id: 0,
  tenantId: 1,
  legalName: LUCEPRES_PUBLIC_PROFILE.legalName,
  legalAddress: LUCEPRES_PUBLIC_PROFILE.location,
  phone: LUCEPRES_PUBLIC_PROFILE.phone,
  email: LUCEPRES_PUBLIC_PROFILE.email,
  website: null,
  identityKind: "immatriculee",
  taxId: null,
  registrationNumber: null,
  bankName: null,
  accountName: null,
  accountNumber: null,
  iban: null,
  swift: null,
  paymentInstructions: null,
  documentFooter: LUCEPRES_PUBLIC_PROFILE.documentFooter,
  updatedAt: /* @__PURE__ */ new Date()
});
function normalizeCompanySettings(input) {
  return {
    tenantId: currentTenant(),
    legalName: input.legalName,
    legalAddress: input.legalAddress || null,
    phone: input.phone || null,
    email: input.email || null,
    website: input.website || null,
    identityKind: normalizeIdentityKind(input.identityKind),
    taxId: input.taxId || null,
    registrationNumber: input.registrationNumber || null,
    bankName: input.bankName || null,
    accountName: input.accountName || null,
    accountNumber: input.accountNumber || null,
    iban: input.iban || null,
    swift: input.swift || null,
    paymentInstructions: input.paymentInstructions || null,
    documentFooter: input.documentFooter || null
  };
}
async function getCompanySettings() {
  const db = await requireDb();
  const result = await db.select().from(companySettings).where(eq(companySettings.tenantId, currentTenant())).limit(1);
  return result[0] ?? emptyCompanySettings();
}
async function saveCompanySettings(input) {
  const db = await requireDb();
  const values = normalizeCompanySettings(input);
  const existing = await db.select({ id: companySettings.id }).from(companySettings).where(eq(companySettings.tenantId, currentTenant())).limit(1);
  if (existing[0]) await db.update(companySettings).set(values).where(and(eq(companySettings.id, existing[0].id), eq(companySettings.tenantId, currentTenant())));
  else await db.insert(companySettings).values(values);
  return getCompanySettings();
}
async function listProjects() {
  const db = await requireDb();
  return db.select({
    id: projects.id,
    name: projects.name,
    reference: projects.reference,
    type: projects.type,
    status: projects.status,
    location: projects.location,
    description: projects.description,
    plannedBudget: projects.plannedBudget,
    minimumMarginRate: projects.minimumMarginRate,
    clientId: projects.clientId,
    clientName: clients.companyName,
    createdAt: projects.createdAt
  }).from(projects).innerJoin(clients, eq(projects.clientId, clients.id)).where(eq(projects.tenantId, currentTenant())).orderBy(desc(projects.createdAt));
}
async function createProject(input) {
  const db = await requireDb();
  const result = await db.insert(projects).values({
    tenantId: currentTenant(),
    ...input,
    reference: input.reference || null,
    location: input.location || null,
    description: input.description || null
  }).returning({ id: projects.id });
  return { id: result[0].id };
}
async function updateProjectPlannedBudget(input) {
  const db = await requireDb();
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant()))).limit(1);
  if (!project[0]) throw new Error("Le chantier s\xE9lectionn\xE9 est introuvable.");
  await db.update(projects).set({ plannedBudget: input.plannedBudget }).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant())));
  return { success: true };
}
async function updateProjectFinancialTargets(input) {
  const db = await requireDb();
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant()))).limit(1);
  if (!project[0]) throw new Error("Le chantier s\xE9lectionn\xE9 est introuvable.");
  await db.update(projects).set({ plannedBudget: input.plannedBudget, minimumMarginRate: input.minimumMarginRate }).where(and(eq(projects.id, input.id), eq(projects.tenantId, currentTenant())));
  return { success: true };
}
async function listProjectCosts(projectId) {
  const db = await requireDb();
  const query = db.select({
    id: projectCosts.id,
    projectId: projectCosts.projectId,
    projectName: projects.name,
    clientName: clients.companyName,
    category: projectCosts.category,
    description: projectCosts.description,
    amount: projectCosts.amount,
    incurredAt: projectCosts.incurredAt,
    createdAt: projectCosts.createdAt
  }).from(projectCosts).innerJoin(projects, eq(projectCosts.projectId, projects.id)).innerJoin(clients, eq(projects.clientId, clients.id));
  return projectId ? query.where(and(eq(projectCosts.projectId, projectId), eq(projectCosts.tenantId, currentTenant()))).orderBy(desc(projectCosts.incurredAt), desc(projectCosts.createdAt)) : query.orderBy(desc(projectCosts.incurredAt), desc(projectCosts.createdAt));
}
async function createProjectCost(input) {
  const db = await requireDb();
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.tenantId, currentTenant()))).limit(1);
  if (!project[0]) throw new Error("Le chantier s\xE9lectionn\xE9 est introuvable.");
  const result = await db.insert(projectCosts).values({ tenantId: currentTenant(), ...input, incurredAt: new Date(input.incurredAt) }).returning({ id: projectCosts.id });
  return { id: result[0].id };
}
async function deleteProjectCost(id) {
  const db = await requireDb();
  await db.delete(projectCosts).where(and(eq(projectCosts.id, id), eq(projectCosts.tenantId, currentTenant())));
  return { success: true };
}
async function getProjectCostById(id) {
  const db = await requireDb();
  const result = await db.select({ id: projectCosts.id, projectId: projectCosts.projectId }).from(projectCosts).where(and(eq(projectCosts.id, id), eq(projectCosts.tenantId, currentTenant()))).limit(1);
  return result[0] ?? null;
}
async function listProjectCostAttachments(projectCostId) {
  const db = await requireDb();
  return db.select({ id: projectCostAttachments.id, projectCostId: projectCostAttachments.projectCostId, fileName: projectCostAttachments.fileName, contentType: projectCostAttachments.contentType, size: projectCostAttachments.size, storageUrl: projectCostAttachments.storageUrl, createdAt: projectCostAttachments.createdAt }).from(projectCostAttachments).where(and(eq(projectCostAttachments.projectCostId, projectCostId), eq(projectCostAttachments.tenantId, currentTenant()))).orderBy(desc(projectCostAttachments.createdAt));
}
async function createProjectCostAttachment(input) {
  const db = await requireDb();
  const result = await db.insert(projectCostAttachments).values({ ...input, tenantId: currentTenant() }).returning({ id: projectCostAttachments.id });
  return { id: result[0].id };
}
async function deleteProjectCostAttachment(id) {
  const db = await requireDb();
  await db.delete(projectCostAttachments).where(and(eq(projectCostAttachments.id, id), eq(projectCostAttachments.tenantId, currentTenant())));
  return { success: true };
}
async function listProjectProfitability() {
  const db = await requireDb();
  const [projectRows, costRows, paymentRows, plannedRevenueRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, reference: projects.reference, status: projects.status, clientName: clients.companyName, plannedBudget: projects.plannedBudget, minimumMarginRate: projects.minimumMarginRate }).from(projects).innerJoin(clients, eq(projects.clientId, clients.id)).where(eq(projects.tenantId, currentTenant())).orderBy(desc(projects.createdAt)),
    db.select({ projectId: projectCosts.projectId, costTotal: sql`coalesce(sum(${projectCosts.amount}), 0)` }).from(projectCosts).where(eq(projectCosts.tenantId, currentTenant())).groupBy(projectCosts.projectId),
    db.select({ projectId: documents.projectId, revenueCollected: sql`coalesce(sum(${payments.amount}), 0)` }).from(documents).innerJoin(payments, eq(payments.documentId, documents.id)).where(and(eq(documents.kind, "facture"), sql`${documents.projectId} is not null`, sql`${documents.status} <> 'annule'`)).groupBy(documents.projectId),
    db.select({ projectId: documents.projectId, plannedRevenue: sql`coalesce(sum(${documents.total}), 0)` }).from(documents).where(and(eq(documents.kind, "devis"), eq(documents.status, "accepte"), sql`${documents.projectId} is not null`)).groupBy(documents.projectId)
  ]);
  const costsByProject = new Map(costRows.map((row) => [row.projectId, Number(row.costTotal)]));
  const revenueByProject = new Map(paymentRows.filter((row) => row.projectId !== null).map((row) => [row.projectId, Number(row.revenueCollected)]));
  const plannedRevenueByProject = new Map(plannedRevenueRows.filter((row) => row.projectId !== null).map((row) => [row.projectId, Number(row.plannedRevenue)]));
  return projectRows.map((project) => ({ ...project, ...calculateProjectMargin({ revenueCollected: revenueByProject.get(project.id) ?? 0, costTotal: costsByProject.get(project.id) ?? 0, plannedRevenue: plannedRevenueByProject.get(project.id) ?? 0, plannedBudget: Number(project.plannedBudget), minimumMarginRate: project.minimumMarginRate }) }));
}
async function listServices() {
  const db = await requireDb();
  const existingCodes = await db.select({ code: services.code }).from(services);
  const missingDefaults = getMissingDefaultServices(existingCodes.map((service) => service.code));
  if (missingDefaults.length) await db.insert(services).values(missingDefaults.map((d) => ({ ...d, tenantId: currentTenant() })));
  return db.select().from(services).where(eq(services.tenantId, currentTenant())).orderBy(asc(services.category), asc(services.name));
}
async function createService(input) {
  const db = await requireDb();
  const result = await db.insert(services).values({
    tenantId: currentTenant(),
    ...input,
    description: input.description || null
  }).returning({ id: services.id });
  return { id: result[0].id };
}
async function updateServiceTariff(input) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const current = await tx.select().from(services).where(and(eq(services.id, input.id), eq(services.tenantId, currentTenant()))).limit(1);
    const service = current[0];
    if (!service) throw new Error("Prestation introuvable.");
    const changed = service.defaultUnitPrice !== input.defaultUnitPrice || service.defaultTaxRate !== input.defaultTaxRate;
    if (!changed) return { success: true, revisionCreated: false };
    await tx.update(services).set({ defaultUnitPrice: input.defaultUnitPrice, defaultTaxRate: input.defaultTaxRate }).where(and(eq(services.id, input.id), eq(services.tenantId, currentTenant())));
    await tx.insert(servicePriceRevisions).values({ tenantId: currentTenant(), serviceId: service.id, previousUnitPrice: service.defaultUnitPrice, nextUnitPrice: input.defaultUnitPrice, previousTaxRate: service.defaultTaxRate, nextTaxRate: input.defaultTaxRate, changedById: input.changedById });
    return { success: true, revisionCreated: true };
  });
}
async function listServicePriceRevisions(serviceId) {
  const db = await requireDb();
  return db.select({ id: servicePriceRevisions.id, previousUnitPrice: servicePriceRevisions.previousUnitPrice, nextUnitPrice: servicePriceRevisions.nextUnitPrice, previousTaxRate: servicePriceRevisions.previousTaxRate, nextTaxRate: servicePriceRevisions.nextTaxRate, createdAt: servicePriceRevisions.createdAt, changedByName: users.name }).from(servicePriceRevisions).leftJoin(users, eq(servicePriceRevisions.changedById, users.id)).where(and(eq(servicePriceRevisions.serviceId, serviceId), eq(servicePriceRevisions.tenantId, currentTenant()))).orderBy(desc(servicePriceRevisions.createdAt));
}
async function listAllServicePriceRevisions() {
  const db = await requireDb();
  return db.select({ id: servicePriceRevisions.id, serviceCode: services.code, serviceName: services.name, previousUnitPrice: servicePriceRevisions.previousUnitPrice, nextUnitPrice: servicePriceRevisions.nextUnitPrice, previousTaxRate: servicePriceRevisions.previousTaxRate, nextTaxRate: servicePriceRevisions.nextTaxRate, createdAt: servicePriceRevisions.createdAt, changedByName: users.name }).from(servicePriceRevisions).innerJoin(services, eq(servicePriceRevisions.serviceId, services.id)).leftJoin(users, eq(servicePriceRevisions.changedById, users.id)).where(eq(servicePriceRevisions.tenantId, currentTenant())).orderBy(desc(servicePriceRevisions.createdAt));
}
async function ensureDefaultIntegrationProviders() {
  const db = await requireDb();
  for (const provider of DEFAULT_INTEGRATION_PROVIDERS) {
    await db.insert(integrationProviders).values({
      slug: provider.slug,
      name: provider.name,
      category: provider.category,
      transport: provider.transport,
      documentationUrl: provider.documentationUrl,
      authType: provider.authType,
      isSupported: provider.isSupported,
      sortOrder: provider.sortOrder
    }).onConflictDoUpdate({
      target: integrationProviders.slug,
      set: {
        name: provider.name,
        category: provider.category,
        transport: provider.transport,
        documentationUrl: provider.documentationUrl,
        authType: provider.authType,
        isSupported: provider.isSupported,
        sortOrder: provider.sortOrder
      }
    });
  }
  const persisted = await db.select({ id: integrationProviders.id, slug: integrationProviders.slug }).from(integrationProviders);
  const providerIds = new Map(persisted.map((provider) => [provider.slug, provider.id]));
  for (const provider of DEFAULT_INTEGRATION_PROVIDERS) {
    const providerId = providerIds.get(provider.slug);
    if (!providerId) continue;
    for (const capability of provider.capabilities) {
      await db.insert(integrationCapabilities).values({ providerId, ...capability }).onConflictDoUpdate({
        target: [integrationCapabilities.providerId, integrationCapabilities.code],
        set: {
          label: capability.label,
          direction: capability.direction,
          riskLevel: capability.riskLevel,
          requiresApproval: capability.requiresApproval
        }
      });
    }
  }
}
async function listIntegrations() {
  const db = await requireDb();
  await ensureDefaultIntegrationProviders();
  const [providers, capabilities, connections] = await Promise.all([
    db.select().from(integrationProviders).orderBy(asc(integrationProviders.sortOrder)),
    db.select().from(integrationCapabilities),
    db.select({
      id: integrationConnections.id,
      providerId: integrationConnections.providerId,
      status: integrationConnections.status,
      grantedScopes: integrationConnections.grantedScopes,
      lastHealthCheckAt: integrationConnections.lastHealthCheckAt,
      lastError: integrationConnections.lastError,
      connectedAt: integrationConnections.connectedAt,
      updatedAt: integrationConnections.updatedAt,
      enabledByName: users.name
    }).from(integrationConnections).leftJoin(users, eq(integrationConnections.enabledById, users.id))
  ]);
  const connectionsByProvider = new Map(connections.map((connection) => [connection.providerId, connection]));
  return providers.map((provider) => {
    const connection = connectionsByProvider.get(provider.id) ?? null;
    return {
      ...provider,
      capabilities: capabilities.filter((capability) => capability.providerId === provider.id),
      adapterPreparation: getIntegrationAdapterPreparation(provider.slug),
      adapter: resolveIntegrationAdapter(provider.slug)?.describe() ?? null,
      connection: connection ? { ...connection, grantedScopes: parseGrantedScopes(connection.grantedScopes) } : null,
      readiness: !provider.isSupported ? "non_disponible" : connection?.status === "active" ? "pret" : connection?.status === "degraded" ? "a_verifier" : "a_preparer"
    };
  });
}
async function prepareIntegrationConnection(providerSlug, userId) {
  const db = await requireDb();
  await ensureDefaultIntegrationProviders();
  return db.transaction(async (tx) => {
    const providerRows = await tx.select().from(integrationProviders).where(eq(integrationProviders.slug, providerSlug)).limit(1);
    const provider = providerRows[0];
    if (!provider) throw new Error("Fournisseur d\u2019int\xE9gration introuvable.");
    if (provider.isSupported !== "oui") throw new Error("Cette int\xE9gration MCP est document\xE9e mais n\u2019est pas encore disponible dans Lucepres.");
    if (!resolveIntegrationAdapter(provider.slug)) throw new Error("Aucun adaptateur applicatif s\xE9curis\xE9 n\u2019est disponible pour ce fournisseur.");
    const existingRows = await tx.select().from(integrationConnections).where(and(eq(integrationConnections.providerId, provider.id), eq(integrationConnections.tenantId, currentTenant()))).limit(1);
    const existing = existingRows[0];
    if (existing && existing.status !== "disabled" && existing.status !== "revoked") return { id: existing.id, status: existing.status, reused: true };
    let connectionId;
    if (existing) {
      connectionId = existing.id;
      await tx.update(integrationConnections).set(createPreparedIntegrationConnectionValues(userId)).where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, currentTenant())));
    } else {
      const result = await tx.insert(integrationConnections).values({ tenantId: currentTenant(), providerId: provider.id, ...createPreparedIntegrationConnectionValues(userId) }).returning({ id: integrationConnections.id });
      connectionId = result[0].id;
    }
    await tx.insert(integrationAuditLogs).values({ connectionId, actorId: userId, action: "connection_prepared", target: provider.slug, decision: "information", metadata: JSON.stringify({ transport: provider.transport, authType: provider.authType }) });
    return { id: connectionId, status: "credentials_pending", reused: false };
  });
}
async function disableIntegrationConnection(connectionId, userId) {
  const db = await requireDb();
  const existing = await db.select({ id: integrationConnections.id }).from(integrationConnections).where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, currentTenant()))).limit(1);
  if (!existing[0]) throw new Error("Connexion d\u2019int\xE9gration introuvable.");
  await db.transaction(async (tx) => {
    await tx.update(integrationConnections).set({ status: "disabled", grantedScopes: null, secretRef: null, lastError: null }).where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, currentTenant())));
    await tx.insert(integrationAuditLogs).values({ connectionId, actorId: userId, action: "connection_disabled", decision: "autorise" });
  });
  return { success: true };
}
async function listIntegrationAuditLogs() {
  const db = await requireDb();
  return db.select({
    id: integrationAuditLogs.id,
    action: integrationAuditLogs.action,
    target: integrationAuditLogs.target,
    decision: integrationAuditLogs.decision,
    createdAt: integrationAuditLogs.createdAt,
    providerName: integrationProviders.name,
    actorName: users.name
  }).from(integrationAuditLogs).leftJoin(integrationConnections, eq(integrationAuditLogs.connectionId, integrationConnections.id)).leftJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id)).leftJoin(users, eq(integrationAuditLogs.actorId, users.id)).where(eq(integrationConnections.tenantId, currentTenant())).orderBy(desc(integrationAuditLogs.createdAt)).limit(30);
}
async function startGoogleWorkspaceOAuth(input) {
  const db = await requireDb();
  requireIntegrationSecret(process.env.GOOGLE_OAUTH_CLIENT_SECRET, "Le secret client OAuth Google");
  const clientId = input.clientId.trim();
  const redirectUri = input.redirectUri.trim();
  if (!clientId) throw new Error("L\u2019identifiant client OAuth Google est requis.");
  if (!redirectUri.startsWith("https://")) throw new Error("L\u2019URI de redirection OAuth doit utiliser HTTPS.");
  const scopes = normalizeGoogleWorkspaceScopes(input.scopes);
  const rows = await db.select({ connectionId: integrationConnections.id, providerId: integrationProviders.id, status: integrationConnections.status }).from(integrationConnections).innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id)).where(eq(integrationProviders.slug, "google-workspace")).limit(1);
  const connection = rows[0];
  if (!connection) throw new Error("Pr\xE9parez d\u2019abord la connexion Google Workspace dans le centre d\u2019int\xE9grations.");
  if (connection.status === "disabled" || connection.status === "revoked") throw new Error("R\xE9activez la connexion Google Workspace avant de commencer OAuth.");
  const state = randomBytes4(32).toString("base64url");
  const stateHash = createHash3("sha256").update(state).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
  const result = await db.insert(integrationOauthSessions).values({
    connectionId: connection.connectionId,
    providerId: connection.providerId,
    clientId,
    redirectUri,
    requestedScopes: JSON.stringify(scopes),
    stateHash,
    expiresAt,
    createdById: input.userId
  }).returning({ id: integrationOauthSessions.id });
  const sessionId = result[0].id;
  await db.insert(integrationAuditLogs).values({ connectionId: connection.connectionId, actorId: input.userId, action: "google_oauth_started", target: "google-workspace", decision: "information", metadata: JSON.stringify({ scopes, sessionId }) });
  return { sessionId, authorizationUrl: buildGoogleWorkspaceAuthorizationUrl({ clientId, redirectUri, scopes, state }), expiresAt };
}
function getIntegrationRuntimeReadiness() {
  return getIntegrationSecretConfiguration();
}
async function listGoogleWorkspaceOauthSessions() {
  const db = await requireDb();
  return db.select({
    id: integrationOauthSessions.id,
    status: integrationOauthSessions.status,
    requestedScopes: integrationOauthSessions.requestedScopes,
    redirectUri: integrationOauthSessions.redirectUri,
    expiresAt: integrationOauthSessions.expiresAt,
    error: integrationOauthSessions.error,
    createdAt: integrationOauthSessions.createdAt,
    createdByName: users.name
  }).from(integrationOauthSessions).innerJoin(integrationProviders, eq(integrationOauthSessions.providerId, integrationProviders.id)).leftJoin(users, eq(integrationOauthSessions.createdById, users.id)).where(eq(integrationProviders.slug, "google-workspace")).orderBy(desc(integrationOauthSessions.createdAt)).limit(10);
}
async function listPendingIntegrationApprovals() {
  const db = await requireDb();
  return db.select({
    id: integrationJobs.id,
    operation: integrationJobs.operation,
    payloadHash: integrationJobs.payloadHash,
    attempts: integrationJobs.attempts,
    createdAt: integrationJobs.createdAt,
    connectionId: integrationConnections.id,
    providerName: integrationProviders.name,
    providerSlug: integrationProviders.slug
  }).from(integrationJobs).innerJoin(integrationConnections, eq(integrationJobs.connectionId, integrationConnections.id)).innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id)).where(and(eq(integrationJobs.status, "queued"), eq(integrationConnections.tenantId, currentTenant()))).orderBy(asc(integrationJobs.createdAt));
}
async function decideIntegrationApproval(input) {
  const db = await requireDb();
  const jobRows = await db.select({ id: integrationJobs.id, connectionId: integrationJobs.connectionId, status: integrationJobs.status, operation: integrationJobs.operation }).from(integrationJobs).where(eq(integrationJobs.id, input.jobId)).limit(1);
  const job = jobRows[0];
  if (!job) throw new Error("Demande d\u2019approbation introuvable.");
  if (job.status !== "queued") throw new Error("Cette demande a d\xE9j\xE0 re\xE7u une d\xE9cision.");
  const nextStatus = input.decision === "approve" ? "approved" : "cancelled";
  const decision = input.decision === "approve" ? "autorise" : "refuse";
  await db.transaction(async (tx) => {
    await tx.update(integrationJobs).set({ status: nextStatus, approvedById: input.userId, approvedAt: /* @__PURE__ */ new Date(), approvalNote: input.note?.trim() || null }).where(eq(integrationJobs.id, job.id));
    await tx.insert(integrationAuditLogs).values({ connectionId: job.connectionId, actorId: input.userId, action: `external_write_${nextStatus}`, target: job.operation, decision, metadata: input.note?.trim() ? JSON.stringify({ note: input.note.trim(), jobId: job.id }) : JSON.stringify({ jobId: job.id }) });
  });
  return { success: true, status: nextStatus };
}
async function getIntegrationOperationsDashboard() {
  const db = await requireDb();
  const [connections, approvals, webhookEvents] = await Promise.all([
    db.select({ id: integrationConnections.id, status: integrationConnections.status, lastHealthCheckAt: integrationConnections.lastHealthCheckAt, lastError: integrationConnections.lastError, providerName: integrationProviders.name, providerSlug: integrationProviders.slug }).from(integrationConnections).innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id)).where(eq(integrationConnections.tenantId, currentTenant())).orderBy(asc(integrationProviders.sortOrder)),
    listPendingIntegrationApprovals(),
    db.select({ id: integrationWebhookEvents.id, eventType: integrationWebhookEvents.eventType, deliveryStatus: integrationWebhookEvents.deliveryStatus, signatureStatus: integrationWebhookEvents.signatureStatus, processingStatus: integrationWebhookEvents.processingStatus, summary: integrationWebhookEvents.summary, error: integrationWebhookEvents.error, receivedAt: integrationWebhookEvents.receivedAt, occurredAt: integrationWebhookEvents.occurredAt }).from(integrationWebhookEvents).innerJoin(integrationConnections, eq(integrationWebhookEvents.connectionId, integrationConnections.id)).innerJoin(integrationProviders, eq(integrationConnections.providerId, integrationProviders.id)).where(eq(integrationProviders.slug, "whatsapp-business")).orderBy(desc(integrationWebhookEvents.receivedAt)).limit(30)
  ]);
  return {
    connections,
    pendingApprovals: approvals,
    webhookEvents,
    summary: {
      activeConnections: connections.filter((connection) => connection.status === "active").length,
      degradedConnections: connections.filter((connection) => connection.status === "degraded").length,
      pendingApprovals: approvals.length,
      acceptedWebhooks: webhookEvents.filter((event) => event.processingStatus === "accepted" || event.processingStatus === "processed").length,
      rejectedWebhooks: webhookEvents.filter((event) => event.processingStatus === "rejected" || event.signatureStatus === "invalid").length
    }
  };
}
async function getAgentOperatorAccess(userId, systemRole) {
  if (systemRole === "admin") return { canApprove: true, canActivate: true, scope: "global", isAdministrator: true, grantIds: [] };
  const db = await requireDb();
  const now = /* @__PURE__ */ new Date();
  const grants = await db.select().from(agentOperatorGrants).where(eq(agentOperatorGrants.userId, userId));
  const active = grants.filter((grant) => grant.status === "active" && (!grant.expiresAt || grant.expiresAt > now));
  if (!active.length) return null;
  return {
    canApprove: active.some((grant) => grant.canApprove === "oui"),
    canActivate: active.some((grant) => grant.canActivate === "oui"),
    scope: active.some((grant) => grant.scope === "global") ? "global" : "commercial",
    isAdministrator: false,
    grantIds: active.map((grant) => grant.id)
  };
}
async function listAgentOperators() {
  const db = await requireDb();
  const [people, grants] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, systemRole: users.role }).from(users).where(eq(users.tenantId, currentTenant())).orderBy(asc(users.name)),
    db.select().from(agentOperatorGrants).where(eq(agentOperatorGrants.tenantId, currentTenant())).orderBy(desc(agentOperatorGrants.updatedAt))
  ]);
  return people.map((person) => ({
    ...person,
    grants: grants.filter((grant) => grant.userId === person.id)
  }));
}
async function upsertAgentOperatorGrant(input) {
  const db = await requireDb();
  const subject = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.userId), eq(users.tenantId, currentTenant()))).limit(1);
  if (!subject[0]) throw new Error("Utilisateur introuvable pour cette habilitation.");
  const values = {
    tenantId: currentTenant(),
    userId: input.userId,
    role: input.role,
    canApprove: input.canApprove ? "oui" : "non",
    canActivate: input.canActivate ? "oui" : "non",
    scope: input.scope,
    status: input.status,
    expiresAt: input.expiresAt ?? null,
    grantedById: input.grantedById
  };
  await db.transaction(async (tx) => {
    await tx.insert(agentOperatorGrants).values(values).onConflictDoUpdate({ target: [agentOperatorGrants.userId, agentOperatorGrants.role], set: { ...values, updatedAt: /* @__PURE__ */ new Date() } });
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), actorId: input.grantedById, action: "operator_grant_upserted", target: `user:${input.userId}`, decision: "autorise", metadata: JSON.stringify({ role: input.role, scope: input.scope, canApprove: input.canApprove, canActivate: input.canActivate, status: input.status, expiresAt: input.expiresAt ?? null }) });
  });
  return { success: true };
}
async function listAgentDelegationCenter() {
  const db = await requireDb();
  const [delegations, campaigns, jobs, audit, operatorGrants, testEmailDeliveries] = await Promise.all([
    db.select({
      id: agentDelegations.id,
      name: agentDelegations.name,
      purpose: agentDelegations.purpose,
      channel: agentDelegations.channel,
      tone: agentDelegations.tone,
      status: agentDelegations.status,
      startsAt: agentDelegations.startsAt,
      expiresAt: agentDelegations.expiresAt,
      dailyLimit: agentDelegations.dailyLimit,
      contactCooldownDays: agentDelegations.contactCooldownDays,
      requiresSecondApproval: agentDelegations.requiresSecondApproval,
      policyVersion: agentDelegations.policyVersion,
      ownerId: agentDelegations.ownerId,
      ownerName: users.name,
      approvedById: agentDelegations.approvedById,
      approvedAt: agentDelegations.approvedAt,
      secondApprovedById: agentDelegations.secondApprovedById,
      secondApprovedAt: agentDelegations.secondApprovedAt,
      activatedById: agentDelegations.activatedById,
      suspendedById: agentDelegations.suspendedById,
      createdAt: agentDelegations.createdAt,
      updatedAt: agentDelegations.updatedAt
    }).from(agentDelegations).innerJoin(users, eq(agentDelegations.ownerId, users.id)).where(eq(agentDelegations.tenantId, currentTenant())).orderBy(desc(agentDelegations.updatedAt)),
    db.select({
      id: agentCampaigns.id,
      delegationId: agentCampaigns.delegationId,
      delegationName: agentDelegations.name,
      purpose: agentDelegations.purpose,
      channel: agentDelegations.channel,
      name: agentCampaigns.name,
      status: agentCampaigns.status,
      scheduledFor: agentCampaigns.scheduledFor,
      scheduleCronTaskUid: agentCampaigns.scheduleCronTaskUid,
      scheduleCronExpression: agentCampaigns.scheduleCronExpression,
      scheduleTimeZone: agentCampaigns.scheduleTimeZone,
      nextExecutionAt: agentCampaigns.nextExecutionAt,
      lastExecutedAt: agentCampaigns.lastExecutedAt,
      lastExecutionStatus: agentCampaigns.lastExecutionStatus,
      eligibleCount: agentCampaigns.eligibleCount,
      preparedById: agentCampaigns.preparedById,
      approvedById: agentCampaigns.approvedById,
      approvedAt: agentCampaigns.approvedAt,
      secondApprovedById: agentCampaigns.secondApprovedById,
      secondApprovedAt: agentCampaigns.secondApprovedAt,
      activatedById: agentCampaigns.activatedById,
      suspendedById: agentCampaigns.suspendedById,
      createdAt: agentCampaigns.createdAt,
      updatedAt: agentCampaigns.updatedAt
    }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(eq(agentCampaigns.tenantId, currentTenant())).orderBy(desc(agentCampaigns.updatedAt)).limit(40),
    db.select({
      id: agentMessageJobs.id,
      campaignId: agentMessageJobs.campaignId,
      clientId: agentMessageJobs.clientId,
      clientName: clients.companyName,
      documentId: agentMessageJobs.documentId,
      documentNumber: documents.number,
      subject: agentMessageJobs.subject,
      body: agentMessageJobs.body,
      status: agentMessageJobs.status,
      blockedReason: agentMessageJobs.blockedReason,
      scheduledFor: agentMessageJobs.scheduledFor,
      createdAt: agentMessageJobs.createdAt
    }).from(agentMessageJobs).innerJoin(clients, eq(agentMessageJobs.clientId, clients.id)).innerJoin(documents, eq(agentMessageJobs.documentId, documents.id)).where(eq(agentMessageJobs.tenantId, currentTenant())).orderBy(desc(agentMessageJobs.createdAt)).limit(80),
    db.select({ id: agentAuditLogs.id, delegationId: agentAuditLogs.delegationId, campaignId: agentAuditLogs.campaignId, action: agentAuditLogs.action, target: agentAuditLogs.target, decision: agentAuditLogs.decision, metadata: agentAuditLogs.metadata, createdAt: agentAuditLogs.createdAt, actorName: users.name }).from(agentAuditLogs).leftJoin(users, eq(agentAuditLogs.actorId, users.id)).where(eq(agentAuditLogs.tenantId, currentTenant())).orderBy(desc(agentAuditLogs.createdAt)).limit(100),
    db.select().from(agentOperatorGrants).orderBy(desc(agentOperatorGrants.updatedAt)),
    db.select({ id: agentTestEmailDeliveries.id, campaignId: agentTestEmailDeliveries.campaignId, messageJobId: agentTestEmailDeliveries.messageJobId, campaignName: agentCampaigns.name, clientName: clients.companyName, documentNumber: documents.number, testRecipient: agentTestEmailDeliveries.testRecipient, subject: agentTestEmailDeliveries.subject, body: agentTestEmailDeliveries.body, status: agentTestEmailDeliveries.status, deliveredAt: agentTestEmailDeliveries.deliveredAt, createdAt: agentTestEmailDeliveries.createdAt }).from(agentTestEmailDeliveries).innerJoin(agentCampaigns, eq(agentTestEmailDeliveries.campaignId, agentCampaigns.id)).innerJoin(agentMessageJobs, eq(agentTestEmailDeliveries.messageJobId, agentMessageJobs.id)).innerJoin(clients, eq(agentMessageJobs.clientId, clients.id)).innerJoin(documents, eq(agentMessageJobs.documentId, documents.id)).where(eq(agentTestEmailDeliveries.tenantId, currentTenant())).orderBy(desc(agentTestEmailDeliveries.createdAt)).limit(100)
  ]);
  return {
    delegations,
    campaigns: campaigns.map((campaign) => ({ ...campaign, requiresSecondApproval: requiresSecondApproval(campaign.eligibleCount) })),
    jobs,
    audit,
    operatorGrants,
    testEmailDeliveries,
    channelReadiness: [
      { channel: "email", label: "E-mail", status: "preparatoire", detail: "Aucun connecteur e-mail applicatif n\u2019est activ\xE9 ; les campagnes restent en simulation." },
      { channel: "whatsapp", label: "WhatsApp Business", status: "preparatoire", detail: "La connexion WhatsApp Business reste d\xE9sactiv\xE9e tant que les secrets et v\xE9rifications ne sont pas configur\xE9s." }
    ],
    summary: {
      activeDelegations: delegations.filter((delegation) => delegation.status === "active_simulation").length,
      pendingApprovals: campaigns.filter((campaign) => campaign.status === "a_approuver").length,
      simulationReady: jobs.filter((job) => job.status === "simulation_prete").length,
      scheduledCampaigns: campaigns.filter((campaign) => Boolean(campaign.scheduleCronTaskUid)).length,
      testDelivered: testEmailDeliveries.filter((delivery) => delivery.status === "remis_test").length,
      blocked: jobs.filter((job) => job.status === "bloquee").length
    }
  };
}
async function createAgentDelegation(input) {
  const errors = getDelegationPolicyErrors(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const db = await requireDb();
  const result = await db.transaction(async (tx) => {
    const created = await tx.insert(agentDelegations).values({ tenantId: currentTenant(), ...input, status: "brouillon", requiresSecondApproval: "non" }).returning({ id: agentDelegations.id });
    const delegationId = created[0].id;
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId: input.ownerId, action: "delegation_created", target: input.name, decision: "information", metadata: JSON.stringify({ purpose: input.purpose, channel: input.channel, expiresAt: input.expiresAt, dailyLimit: input.dailyLimit, contactCooldownDays: input.contactCooldownDays }) });
    return { id: delegationId };
  });
  return result;
}
async function submitAgentDelegationForApproval(delegationId, actorId) {
  const db = await requireDb();
  const rows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = rows[0];
  if (!delegation) throw new Error("D\xE9l\xE9gation introuvable.");
  if (delegation.status !== "brouillon" && delegation.status !== "suspendue") throw new Error("Seule une d\xE9l\xE9gation brouillon ou suspendue peut \xEAtre soumise \xE0 approbation.");
  await db.transaction(async (tx) => {
    await tx.update(agentDelegations).set({ status: "a_approuver" }).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId, action: "delegation_submitted", target: delegation.name, decision: "information" });
  });
  return { success: true };
}
async function approveAgentDelegation(delegationId, actorId) {
  const db = await requireDb();
  const rows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = rows[0];
  if (!delegation) throw new Error("D\xE9l\xE9gation introuvable.");
  if (delegation.status !== "a_approuver") throw new Error("Cette d\xE9l\xE9gation ne peut pas \xEAtre approuv\xE9e dans son \xE9tat actuel.");
  if (delegation.expiresAt <= /* @__PURE__ */ new Date()) throw new Error("Cette d\xE9l\xE9gation est expir\xE9e et ne peut pas \xEAtre activ\xE9e.");
  await db.transaction(async (tx) => {
    await tx.update(agentDelegations).set({ status: "active_simulation", approvedById: actorId, approvedAt: /* @__PURE__ */ new Date(), activatedById: actorId }).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId, action: "delegation_approved_simulation", target: delegation.name, decision: "autorise", metadata: JSON.stringify({ mode: "simulation", externalDispatch: false }) });
  });
  return { success: true, status: "active_simulation" };
}
async function suspendAgentDelegation(delegationId, actorId) {
  const db = await requireDb();
  const rows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = rows[0];
  if (!delegation) throw new Error("D\xE9l\xE9gation introuvable.");
  if (delegation.status === "revoquee" || delegation.status === "expiree") throw new Error("Cette d\xE9l\xE9gation ne peut plus \xEAtre suspendue.");
  await db.transaction(async (tx) => {
    const campaignIds = (await tx.select({ id: agentCampaigns.id }).from(agentCampaigns).where(and(eq(agentCampaigns.delegationId, delegationId), eq(agentCampaigns.tenantId, currentTenant())))).map((campaign) => campaign.id);
    await tx.update(agentDelegations).set({ status: "suspendue", suspendedById: actorId }).where(and(eq(agentDelegations.id, delegationId), eq(agentDelegations.tenantId, currentTenant())));
    await tx.update(agentCampaigns).set({ status: "suspendue", suspendedById: actorId }).where(and(eq(agentCampaigns.delegationId, delegationId), eq(agentCampaigns.tenantId, currentTenant())));
    if (campaignIds.length) await tx.update(agentMessageJobs).set({ status: "annulee", blockedReason: "D\xE9l\xE9gation suspendue par un responsable habilit\xE9." }).where(inArray(agentMessageJobs.campaignId, campaignIds));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId, actorId, action: "delegation_suspended", target: delegation.name, decision: "autorise", metadata: JSON.stringify({ externalDispatch: false }) });
  });
  return { success: true };
}
async function createAgentCampaignSimulation(input) {
  const db = await requireDb();
  const delegationRows = await db.select().from(agentDelegations).where(and(eq(agentDelegations.id, input.delegationId), eq(agentDelegations.tenantId, currentTenant()))).limit(1);
  const delegation = delegationRows[0];
  if (!delegation) throw new Error("D\xE9l\xE9gation introuvable.");
  if (delegation.status !== "active_simulation") throw new Error("La d\xE9l\xE9gation doit \xEAtre approuv\xE9e en mode simulation avant de pr\xE9parer une campagne.");
  if (delegation.expiresAt <= /* @__PURE__ */ new Date()) throw new Error("La d\xE9l\xE9gation est expir\xE9e.");
  const effectiveScheduledFor = input.scheduledFor ?? /* @__PURE__ */ new Date();
  const dayStart = new Date(effectiveScheduledFor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const scheduledRows = await db.select({ count: sql`count(*)` }).from(agentMessageJobs).innerJoin(agentCampaigns, eq(agentMessageJobs.campaignId, agentCampaigns.id)).where(and(eq(agentCampaigns.delegationId, delegation.id), gt(agentMessageJobs.scheduledFor, new Date(dayStart.getTime() - 1)), lt(agentMessageJobs.scheduledFor, dayEnd)));
  const remainingDailyCapacity = Math.max(0, delegation.dailyLimit - Number(scheduledRows[0]?.count ?? 0));
  const documentsToCheck = await listDocuments(delegation.purpose === "relance_facture" ? "facture" : "devis");
  const cooldownStart = new Date(Date.now() - delegation.contactCooldownDays * 864e5);
  const recentJobs = await db.select({ clientId: agentMessageJobs.clientId }).from(agentMessageJobs).where(gt(agentMessageJobs.createdAt, cooldownStart));
  const contactedRecently = new Set(recentJobs.map((job) => job.clientId));
  const matchingDocuments = documentsToCheck.filter((document) => isCampaignEligibleForSimulation({ purpose: delegation.purpose, kind: document.kind, status: document.status, balanceDue: document.balanceDue, isOverdue: document.isOverdue }));
  const eligible = matchingDocuments.filter((document) => !contactedRecently.has(document.clientId)).slice(0, remainingDailyCapacity);
  const createdAt = /* @__PURE__ */ new Date();
  const skippedCount = Math.max(0, matchingDocuments.length - eligible.length);
  return db.transaction(async (tx) => {
    const created = await tx.insert(agentCampaigns).values({ tenantId: currentTenant(), delegationId: delegation.id, name: input.name, status: "simulee", scheduledFor: effectiveScheduledFor, eligibleCount: eligible.length, preparedById: input.preparedById }).returning({ id: agentCampaigns.id });
    const campaignId = created[0].id;
    for (const document of eligible) {
      const draft = createAgentMessageDraft({ purpose: delegation.purpose, tone: delegation.tone, documentNumber: document.number, clientName: document.clientName, balanceDue: document.balanceDue, dueDate: document.dueDate, validUntil: document.validUntil });
      const contentHash = createHash3("sha256").update(`${draft.subject}
${draft.body}`).digest("hex");
      await tx.insert(agentMessageJobs).values({ tenantId: currentTenant(), campaignId, clientId: document.clientId, documentId: document.id, idempotencyKey: `simulation:${campaignId}:${document.id}`, subject: draft.subject, body: draft.body, contentHash, status: "simulation_prete", scheduledFor: effectiveScheduledFor, policySnapshot: JSON.stringify({ policyVersion: delegation.policyVersion, dailyLimit: delegation.dailyLimit, contactCooldownDays: delegation.contactCooldownDays, channel: delegation.channel, purpose: delegation.purpose, mode: "simulation" }) });
    }
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: delegation.id, campaignId, actorId: input.preparedById, action: "campaign_simulated", target: input.name, decision: "information", metadata: JSON.stringify({ eligibleCount: eligible.length, skippedCount, remainingDailyCapacity, requiresSecondApproval: requiresSecondApproval(eligible.length), externalDispatch: false }) });
    return { id: campaignId, eligibleCount: eligible.length, skippedCount, requiresSecondApproval: requiresSecondApproval(eligible.length) };
  });
}
async function submitAgentCampaignForApproval(campaignId, actorId) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status !== "simulee") throw new Error("Seule une campagne simul\xE9e peut \xEAtre soumise \xE0 approbation.");
  await db.transaction(async (tx) => {
    await tx.update(agentCampaigns).set({ status: "a_approuver" }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_submitted", target: campaign.name, decision: "information", metadata: JSON.stringify({ eligibleCount: campaign.eligibleCount, requiresSecondApproval: requiresSecondApproval(campaign.eligibleCount) }) });
  });
  return { success: true };
}
async function approveAgentCampaign(campaignId, actorId) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status !== "a_approuver") throw new Error("Cette campagne ne peut pas \xEAtre approuv\xE9e dans son \xE9tat actuel.");
  const secondApprovalNeeded = requiresSecondApproval(campaign.eligibleCount);
  if (!campaign.approvedById) {
    await db.transaction(async (tx) => {
      await tx.update(agentCampaigns).set({ approvedById: actorId, approvedAt: /* @__PURE__ */ new Date(), status: secondApprovalNeeded ? "a_approuver" : "approuvee" }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
      await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_first_approval", target: campaign.name, decision: "autorise", metadata: JSON.stringify({ secondApprovalNeeded }) });
    });
    return { success: true, awaitingSecondApproval: secondApprovalNeeded };
  }
  if (!secondApprovalNeeded) throw new Error("Cette campagne a d\xE9j\xE0 \xE9t\xE9 approuv\xE9e.");
  if (campaign.approvedById === actorId) throw new Error("Un second responsable distinct doit confirmer cette campagne.");
  await db.transaction(async (tx) => {
    await tx.update(agentCampaigns).set({ secondApprovedById: actorId, secondApprovedAt: /* @__PURE__ */ new Date(), status: "approuvee" }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_second_approval", target: campaign.name, decision: "autorise" });
  });
  return { success: true, awaitingSecondApproval: false };
}
async function activateAgentCampaignSimulation(campaignId, actorId) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status !== "approuvee") throw new Error("La campagne doit \xEAtre enti\xE8rement approuv\xE9e avant activation simul\xE9e.");
  if (requiresSecondApproval(campaign.eligibleCount) && !campaign.secondApprovedById) throw new Error("Une seconde approbation distincte est requise pour cette campagne.");
  await db.transaction(async (tx) => {
    await tx.update(agentCampaigns).set({ status: "active_simulation", activatedById: actorId }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_activated_simulation", target: campaign.name, decision: "autorise", metadata: JSON.stringify({ externalDispatch: false }) });
  });
  return { success: true };
}
async function suspendAgentCampaign(campaignId, actorId) {
  const db = await requireDb();
  const rows = await db.select().from(agentCampaigns).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status === "archivee") throw new Error("Cette campagne est d\xE9j\xE0 archiv\xE9e.");
  await db.transaction(async (tx) => {
    await tx.update(agentCampaigns).set({ status: "suspendue", suspendedById: actorId }).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.update(agentMessageJobs).set({ status: "annulee", blockedReason: "Campagne suspendue par un responsable habilit\xE9." }).where(and(eq(agentMessageJobs.campaignId, campaignId), eq(agentMessageJobs.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: campaign.delegationId, campaignId, actorId, action: "campaign_suspended", target: campaign.name, decision: "autorise", metadata: JSON.stringify({ externalDispatch: false }) });
  });
  return { success: true };
}
async function setAgentCampaignSchedule(input) {
  const db = await requireDb();
  const rows = await db.select({ campaign: agentCampaigns, delegation: agentDelegations }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  const record = rows[0];
  if (!record) throw new Error("Campagne introuvable.");
  if (record.campaign.status !== "active_simulation") throw new Error("La campagne doit \xEAtre activ\xE9e en simulation avant de pouvoir \xEAtre programm\xE9e.");
  if (record.delegation.channel !== "email") throw new Error("La programmation de test est disponible pour les campagnes e-mail uniquement.");
  await db.transaction(async (tx) => {
    await tx.update(agentCampaigns).set({ scheduleCronTaskUid: input.scheduleCronTaskUid, scheduleCronExpression: input.scheduleCronExpression, scheduleTimeZone: "Africa/Conakry", nextExecutionAt: input.nextExecutionAt, lastExecutionStatus: "pending" }).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: record.campaign.delegationId, campaignId: input.campaignId, actorId: input.actorId, action: "campaign_schedule_created", target: record.campaign.name, decision: "autorise", metadata: JSON.stringify({ mode: "test_email", cron: input.scheduleCronExpression, timeZone: "Africa/Conakry", externalDispatch: false }) });
  });
  return { success: true };
}
async function assertAgentCampaignCanBeScheduled(campaignId) {
  const record = await getAgentCampaignById(campaignId);
  if (!record) throw new Error("Campagne introuvable.");
  if (record.campaign.status !== "active_simulation") throw new Error("La campagne doit \xEAtre activ\xE9e en simulation avant de pouvoir \xEAtre programm\xE9e.");
  if (record.delegation.channel !== "email") throw new Error("La programmation de test est disponible pour les campagnes e-mail uniquement.");
  if (record.campaign.scheduleCronTaskUid) throw new Error("Cette campagne dispose d\xE9j\xE0 d\u2019une programmation active.");
  return { name: record.campaign.name };
}
async function getAgentCampaignByScheduleTaskUid(taskUid) {
  const db = await requireDb();
  const rows = await db.select({ campaign: agentCampaigns, delegation: agentDelegations }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(and(eq(agentCampaigns.scheduleCronTaskUid, taskUid), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  return rows[0] ?? null;
}
async function deliverAgentCampaignToTestInbox(input) {
  const db = await requireDb();
  const record = await getAgentCampaignById(input.campaignId);
  if (!record) throw new Error("Campagne introuvable.");
  if (record.campaign.status !== "active_simulation") return { status: "skipped", delivered: 0, reason: "Campagne non active en simulation." };
  if (record.delegation.status !== "active_simulation" || record.delegation.expiresAt <= /* @__PURE__ */ new Date()) return { status: "skipped", delivered: 0, reason: "D\xE9l\xE9gation inactive ou expir\xE9e." };
  if (record.delegation.channel !== "email") return { status: "skipped", delivered: 0, reason: "Le connecteur de test ne prend en charge que l\u2019e-mail." };
  const jobs = await db.select().from(agentMessageJobs).where(and(eq(agentMessageJobs.campaignId, input.campaignId), eq(agentMessageJobs.status, "simulation_prete")));
  const deliveredAt = /* @__PURE__ */ new Date();
  if (!jobs.length) {
    await db.update(agentCampaigns).set({ lastExecutedAt: deliveredAt, lastExecutionStatus: "skipped" }).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    return { status: "skipped", delivered: 0, reason: "Aucun brouillon de test n\u2019est disponible." };
  }
  await db.transaction(async (tx) => {
    for (const job of jobs) {
      await tx.insert(agentTestEmailDeliveries).values({ tenantId: currentTenant(), campaignId: input.campaignId, messageJobId: job.id, subject: job.subject, body: job.body, status: "remis_test", runKey: `${input.runKeyPrefix}:${job.id}`, deliveredAt }).onConflictDoUpdate({ target: agentTestEmailDeliveries.runKey, set: { status: "remis_test", deliveredAt } });
      await tx.update(agentMessageJobs).set({ status: "remis_test" }).where(and(eq(agentMessageJobs.id, job.id), eq(agentMessageJobs.tenantId, currentTenant())));
    }
    await tx.update(agentCampaigns).set({ lastExecutedAt: deliveredAt, lastExecutionStatus: "success" }).where(and(eq(agentCampaigns.id, input.campaignId), eq(agentCampaigns.tenantId, currentTenant())));
    await tx.insert(agentAuditLogs).values({ tenantId: currentTenant(), delegationId: record.campaign.delegationId, campaignId: input.campaignId, actorId: input.actorId ?? null, action: "test_email_delivered", target: record.campaign.name, decision: "information", metadata: JSON.stringify({ delivered: jobs.length, mode: "test_inbox", externalDispatch: false }) });
  });
  return { status: "success", delivered: jobs.length };
}
async function getAgentCampaignById(campaignId) {
  const db = await requireDb();
  const rows = await db.select({ campaign: agentCampaigns, delegation: agentDelegations }).from(agentCampaigns).innerJoin(agentDelegations, eq(agentCampaigns.delegationId, agentDelegations.id)).where(and(eq(agentCampaigns.id, campaignId), eq(agentCampaigns.tenantId, currentTenant()))).limit(1);
  return rows[0] ?? null;
}
async function deliverAgentCampaignToTestInboxNow(campaignId, actorId) {
  return deliverAgentCampaignToTestInbox({ campaignId, actorId, runKeyPrefix: `manual-test:${campaignId}` });
}
async function deliverScheduledAgentCampaignToTestInbox(taskUid, tenantId) {
  const record = await getAgentCampaignByScheduleTaskUid(taskUid);
  if (!record) return { status: "orphan", delivered: 0 };
  const dayKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return runWithTenant(
    tenantId ?? record.campaign?.tenantId ?? null,
    () => deliverAgentCampaignToTestInbox({ campaignId: record.campaign.id, runKeyPrefix: `scheduled-test:${taskUid}:${dayKey}` })
  );
}
async function getAgentCopilotContext() {
  const [profitability, receivables] = await Promise.all([listProjectProfitability(), getReceivablesDashboard()]);
  return {
    projectsBelowTarget: profitability.filter((project) => project.isMarginBelowTarget).slice(0, 10).map((project) => ({ projectId: project.id, name: project.name, client: project.clientName, margin: project.margin, marginRate: project.marginRate, minimumMarginRate: project.minimumMarginRate, variance: project.marginVariance, revenueCollected: project.revenueCollected, costs: project.costTotal })),
    receivables: receivables.invoices.filter((invoice) => invoice.isPaymentPromiseOverdue || invoice.isOverdue).slice(0, 12).map((invoice) => ({ documentId: invoice.id, number: invoice.number, client: invoice.clientName, balanceDue: invoice.balanceDue, daysOverdue: invoice.daysOverdue, promiseOverdue: invoice.isPaymentPromiseOverdue, promiseDueSoon: invoice.isPaymentPromiseDueSoon, promisedDate: invoice.paymentPromise?.promisedDate ?? null })),
    summary: receivables.summary
  };
}
async function listDocuments(kind, opts) {
  const db = await requireDb();
  let query = db.select({
    id: documents.id,
    kind: documents.kind,
    number: documents.number,
    status: documents.status,
    issueDate: documents.issueDate,
    dueDate: documents.dueDate,
    validUntil: documents.validUntil,
    depositPercent: documents.depositPercent,
    depositDueDate: documents.depositDueDate,
    balanceDueDate: documents.balanceDueDate,
    total: documents.total,
    subtotal: documents.subtotal,
    taxTotal: documents.taxTotal,
    isAiDraft: documents.isAiDraft,
    relatedDocumentId: documents.relatedDocumentId,
    invoiceStage: documents.invoiceStage,
    collectionStatus: documents.collectionStatus,
    collectionReminderDate: documents.collectionReminderDate,
    collectionOwnerId: documents.collectionOwnerId,
    clientId: clients.id,
    clientName: clients.companyName,
    projectId: projects.id,
    projectName: projects.name,
    updatedAt: documents.updatedAt
  }).from(documents).innerJoin(clients, eq(documents.clientId, clients.id)).leftJoin(projects, eq(documents.projectId, projects.id)).where(eq(documents.tenantId, currentTenant())).$dynamic();
  if (kind) query = query.where(and(eq(documents.kind, kind), eq(documents.tenantId, currentTenant())));
  query = query.orderBy(desc(documents.updatedAt));
  if (opts?.limit) query = query.limit(opts.limit);
  const rows = await query;
  const paymentRows = await db.select({ documentId: payments.documentId, paidAmount: sql`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(eq(payments.tenantId, currentTenant())).groupBy(payments.documentId);
  const paidByDocument = new Map(paymentRows.map((row) => [row.documentId, Number(row.paidAmount)]));
  const enriched = rows.map((row) => {
    const paidAmount = row.kind === "facture" ? paidByDocument.get(row.id) ?? 0 : 0;
    const balance = calculatePaymentBalance(row.total, paidAmount);
    const status = row.kind === "facture" ? invoicePaymentStatus(row.total, paidAmount, row.dueDate, row.status) : row.status;
    return { ...row, status, paidAmount, balanceDue: row.kind === "facture" ? balance.balanceDue : 0, isOverdue: row.kind === "facture" && isInvoiceOverdue(status, row.dueDate) };
  });
  return kind ? enriched.filter((row) => row.kind === kind) : enriched;
}
async function getReceivablesDashboard() {
  const [invoices, promises] = await Promise.all([listDocuments("facture"), listPaymentPromises()]);
  const promisedByDocument = new Map(promises.map((promise) => [promise.documentId, promise]));
  return summarizeReceivables(invoices.map((invoice) => ({ ...invoice, paymentPromise: promisedByDocument.get(invoice.id) ?? null })));
}
async function searchWorkspace(input) {
  const [clientRows, documentRows, receivables] = await Promise.all([listClients(), listDocuments(), getReceivablesDashboard()]);
  return buildWorkspaceSearchResults({
    query: input.query,
    filters: input.filters,
    clients: clientRows,
    documents: documentRows,
    receivables: receivables.invoices.filter((invoice) => invoice.balanceDue > 0)
  });
}
async function updateCollectionFollowUp(input) {
  if (!input.collectionStatus && input.collectionReminderDate === void 0 && input.collectionOwnerId === void 0) throw new Error("Aucune mise \xE0 jour de suivi n\u2019a \xE9t\xE9 demand\xE9e.");
  const invoice = await getDocumentById(input.documentId);
  if (!invoice || invoice.kind !== "facture" || invoice.balanceDue <= 0) throw new Error("Le suivi concerne uniquement une facture avec un solde impay\xE9.");
  const effectiveStatus = input.collectionStatus ?? invoice.collectionStatus ?? "a_traiter";
  const storedReminderDate = invoice.collectionReminderDate ? new Date(invoice.collectionReminderDate) : null;
  const candidateReminderDate = input.collectionReminderDate === void 0 ? storedReminderDate : input.collectionReminderDate === null ? null : normalizeCollectionReminderDate(input.collectionReminderDate);
  const reminderDate = effectiveStatus === "a_rappeler" ? candidateReminderDate : null;
  const reminderError = validateCollectionReminder(effectiveStatus, reminderDate);
  if (reminderError) throw new Error(reminderError);
  const db = await requireDb();
  let owner = null;
  if (input.collectionOwnerId !== void 0 && input.collectionOwnerId !== null) {
    const candidates = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, input.collectionOwnerId)).limit(1);
    owner = candidates[0] ?? null;
    if (!owner) throw new Error("Le responsable s\xE9lectionn\xE9 est introuvable.");
  }
  const values = {};
  if (input.collectionStatus) values.collectionStatus = input.collectionStatus;
  if (input.collectionReminderDate !== void 0 || input.collectionStatus && effectiveStatus !== "a_rappeler") values.collectionReminderDate = reminderDate;
  if (input.collectionOwnerId !== void 0) values.collectionOwnerId = input.collectionOwnerId;
  await db.update(documents).set(values).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, currentTenant())));
  const activityWrites = [];
  if (input.collectionStatus) activityWrites.push(createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "statut_recouvrement", title: `Suivi recouvrement : ${collectionFollowUpLabels[input.collectionStatus]}`, description: `Facture ${invoice.number}`, createdById: input.updatedById }));
  if (input.collectionOwnerId !== void 0) {
    const ownerName = input.collectionOwnerId === null ? "Aucun responsable" : owner?.name || owner?.email || `Utilisateur ${input.collectionOwnerId}`;
    activityWrites.push(createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "responsable_recouvrement", title: "Responsable de recouvrement mis \xE0 jour", description: `${ownerName} \xB7 Facture ${invoice.number}`, createdById: input.updatedById }));
  }
  const oldReminderKey = storedReminderDate?.toISOString().slice(0, 10) ?? null;
  const newReminderKey = reminderDate?.toISOString().slice(0, 10) ?? null;
  if (oldReminderKey !== newReminderKey) activityWrites.push(createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "date_rappel_recouvrement", title: newReminderKey ? `Rappel pr\xE9vu le ${newReminderKey}` : "Date de rappel retir\xE9e", description: `Facture ${invoice.number}`, createdById: input.updatedById }));
  await Promise.all(activityWrites);
  return { success: true, collectionStatus: input.collectionStatus, collectionReminderDate: newReminderKey, collectionOwnerId: input.collectionOwnerId ?? void 0 };
}
async function reassignCollectionFollowUps(input) {
  const documentIds = Array.from(new Set(input.documentIds));
  if (!documentIds.length || documentIds.length > 20 || documentIds.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("S\xE9lectionnez entre 1 et 20 cr\xE9ances valides.");
  const db = await requireDb();
  const owners = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, input.collectionOwnerId)).limit(1);
  const owner = owners[0];
  if (!owner) throw new Error("Le responsable s\xE9lectionn\xE9 est introuvable.");
  const invoices = (await listDocuments("facture")).filter((invoice) => documentIds.includes(invoice.id));
  if (invoices.length !== documentIds.length || invoices.some((invoice) => invoice.balanceDue <= 0)) throw new Error("Toutes les cr\xE9ances s\xE9lectionn\xE9es doivent \xEAtre ouvertes et disponibles.");
  const changedInvoices = invoices.filter((invoice) => invoice.collectionOwnerId !== input.collectionOwnerId);
  if (changedInvoices.length) {
    await db.update(documents).set({ collectionOwnerId: input.collectionOwnerId }).where(inArray(documents.id, changedInvoices.map((invoice) => invoice.id)));
    const ownerName = owner.name || owner.email || `Utilisateur ${owner.id}`;
    await Promise.all(changedInvoices.map((invoice) => createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "responsable_recouvrement", title: "Responsable de recouvrement mis \xE0 jour", description: `${ownerName} \xB7 Facture ${invoice.number}`, createdById: input.updatedById })));
  }
  return { success: true, updatedCount: changedInvoices.length, unchangedCount: invoices.length - changedInvoices.length, collectionOwnerId: owner.id };
}
async function getCollectionMonthlyReport(month) {
  if (!isCollectionReportMonth(month)) throw new Error("Le mois du rapport est invalide.");
  const { start, end } = collectionMonthBounds(month);
  const startBefore = new Date(start.getTime() - 1);
  const [receivables, people, activities, paymentRows] = await Promise.all([
    getReceivablesDashboard(),
    listCollectionAssignees(),
    (async () => {
      const db = await requireDb();
      return db.select({ id: clientActivities.id, type: clientActivities.type, title: clientActivities.title, description: clientActivities.description, createdAt: clientActivities.createdAt, documentId: documents.id, documentNumber: documents.number, clientName: clients.companyName }).from(clientActivities).innerJoin(documents, eq(clientActivities.documentId, documents.id)).innerJoin(clients, eq(documents.clientId, clients.id)).where(and(eq(documents.kind, "facture"), gt(clientActivities.createdAt, startBefore), lt(clientActivities.createdAt, end))).orderBy(desc(clientActivities.createdAt));
    })(),
    (async () => {
      const db = await requireDb();
      return db.select({ id: payments.id, documentId: documents.id, documentNumber: documents.number, clientName: clients.companyName, amount: payments.amount, paidAt: payments.paidAt }).from(payments).innerJoin(documents, eq(payments.documentId, documents.id)).innerJoin(clients, eq(documents.clientId, clients.id)).where(and(eq(documents.kind, "facture"), gt(payments.paidAt, startBefore), lt(payments.paidAt, end))).orderBy(desc(payments.paidAt));
    })()
  ]);
  const ownerById = new Map(people.map((person) => [person.id, person.name || person.email || `Utilisateur ${person.id}`]));
  const statusCounts = { a_traiter: 0, contacte: 0, a_rappeler: 0 };
  receivables.invoices.forEach((invoice) => {
    statusCounts[invoice.collectionStatus ?? "a_traiter"] += 1;
  });
  const activityEvents = activities.map((activity) => ({ id: `activity-${activity.id}`, type: activity.type, title: activity.title, description: activity.description, documentId: activity.documentId, documentNumber: activity.documentNumber, clientName: activity.clientName, occurredAt: activity.createdAt }));
  const paymentEvents = paymentRows.map((payment) => ({ id: `payment-${payment.id}`, type: "paiement_enregistre", title: `Paiement de ${payment.amount.toLocaleString("fr-GN")} GNF enregistr\xE9`, description: `Facture ${payment.documentNumber}`, documentId: payment.documentId, documentNumber: payment.documentNumber, clientName: payment.clientName, occurredAt: payment.paidAt }));
  return {
    month,
    generatedAt: /* @__PURE__ */ new Date(),
    summary: { ...receivables.summary, statusCounts, assignedCount: receivables.invoices.filter((invoice) => Boolean(invoice.collectionOwnerId)).length, activityCount: activityEvents.length + paymentEvents.length, paymentCount: paymentEvents.length, monthlyCollectedAmount: paymentRows.reduce((sum, payment) => sum + payment.amount, 0) },
    invoices: receivables.invoices.map((invoice) => ({ ...invoice, collectionStatus: invoice.collectionStatus ?? "a_traiter", collectionOwnerName: invoice.collectionOwnerId ? ownerById.get(invoice.collectionOwnerId) ?? "Responsable indisponible" : null })),
    activities: [...activityEvents, ...paymentEvents].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
  };
}
async function listPaymentPromises(documentIds) {
  const db = await requireDb();
  const base = db.select({ id: paymentPromises.id, documentId: paymentPromises.documentId, promisedDate: paymentPromises.promisedDate, note: paymentPromises.note, updatedAt: paymentPromises.updatedAt }).from(paymentPromises);
  return documentIds?.length ? base.where(inArray(paymentPromises.documentId, documentIds)) : base.orderBy(desc(paymentPromises.updatedAt));
}
async function findClientByPortalEmail(email) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const db = await requireDb();
  const result = await db.select({ id: clients.id, companyName: clients.companyName, contactName: clients.contactName, email: clients.email }).from(clients).where(sql`lower(${clients.email}) = ${normalized}`).limit(1);
  return result[0] ?? null;
}
async function getClientPortalOverview(email) {
  const client = await findClientByPortalEmail(email);
  if (!client) return { client: null, invoices: [], quotes: [] };
  const [invoices, quotes] = await Promise.all([
    listDocuments("facture"),
    listDocuments("devis")
  ]);
  const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
  const clientQuotes = quotes.filter(
    (quote) => quote.clientId === client.id && ["envoye", "accepte", "refuse"].includes(quote.status)
  );
  const promises = await listPaymentPromises(clientInvoices.map((invoice) => invoice.id));
  const promisedByDocument = new Map(promises.map((promise) => [promise.documentId, promise]));
  return {
    client,
    invoices: clientInvoices.map((invoice) => ({ ...invoice, paymentPromise: promisedByDocument.get(invoice.id) ?? null })),
    quotes: clientQuotes
  };
}
async function getClientPortalInvoice(email, invoiceId) {
  const client = await findClientByPortalEmail(email);
  if (!client) return null;
  const invoice = await getDocumentById(invoiceId);
  if (!invoice || invoice.kind !== "facture" || invoice.clientId !== client.id) return null;
  const promise = await listPaymentPromises([invoiceId]);
  return { ...invoice, paymentPromise: promise[0] ?? null };
}
async function getClientPortalQuote(email, quoteId) {
  const client = await findClientByPortalEmail(email);
  if (!client) return null;
  const quote = await getDocumentById(quoteId);
  if (!quote || quote.kind !== "devis" || quote.clientId !== client.id) return null;
  if (!["envoye", "accepte", "refuse"].includes(quote.status)) return null;
  return quote;
}
async function respondToClientPortalQuote(input) {
  const client = await findClientByPortalEmail(input.email);
  if (!client) throw new Error("Votre compte n\u2019est associ\xE9 \xE0 aucun dossier client.");
  const quote = await getDocumentById(input.documentId);
  if (!quote || quote.kind !== "devis" || quote.clientId !== client.id) {
    throw new Error("Ce devis n\u2019est pas disponible pour votre compte.");
  }
  if (quote.status !== "envoye") {
    throw new Error("Ce devis n\u2019est plus en attente de votre r\xE9ponse.");
  }
  if (quote.validUntil) {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const validUntil = new Date(quote.validUntil);
    validUntil.setHours(0, 0, 0, 0);
    if (validUntil < today) {
      throw new Error("Ce devis a expir\xE9. Contactez Lucepres pour une mise \xE0 jour.");
    }
  }
  await updateDocumentStatus(quote.id, input.decision, input.createdById, {
    title: input.decision === "accepte" ? "Devis accept\xE9 par le client" : "Devis refus\xE9 par le client",
    description: `${quote.number} \xB7 d\xE9cision portail`
  });
  return { success: true, status: input.decision, number: quote.number };
}
async function createClientPaymentPromise(input) {
  const client = await findClientByPortalEmail(input.email);
  if (!client) throw new Error("Votre compte n\u2019est associ\xE9 \xE0 aucun dossier client.");
  const invoice = await getDocumentById(input.documentId);
  if (!invoice || invoice.kind !== "facture" || invoice.clientId !== client.id || invoice.balanceDue <= 0) throw new Error("Cette facture ne peut pas recevoir de promesse de paiement.");
  const promisedDate = new Date(input.promisedDate);
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(promisedDate.getTime()) || promisedDate < today) throw new Error("La date pr\xE9vue doit \xEAtre aujourd\u2019hui ou ult\xE9rieure.");
  const db = await requireDb();
  await db.insert(paymentPromises).values({ tenantId: currentTenant(), documentId: input.documentId, promisedDate, note: input.note?.trim() || null, createdById: input.createdById }).onConflictDoUpdate({ target: paymentPromises.documentId, set: { promisedDate, note: input.note?.trim() || null, createdById: input.createdById, updatedAt: /* @__PURE__ */ new Date() } });
  return { success: true };
}
async function getDocumentById(id) {
  const db = await requireDb();
  const header = await db.select({
    id: documents.id,
    kind: documents.kind,
    number: documents.number,
    status: documents.status,
    issueDate: documents.issueDate,
    dueDate: documents.dueDate,
    validUntil: documents.validUntil,
    depositPercent: documents.depositPercent,
    depositDueDate: documents.depositDueDate,
    balanceDueDate: documents.balanceDueDate,
    discountPercent: documents.discountPercent,
    discountAmount: documents.discountAmount,
    subtotal: documents.subtotal,
    taxTotal: documents.taxTotal,
    total: documents.total,
    notes: documents.notes,
    isAiDraft: documents.isAiDraft,
    collectionStatus: documents.collectionStatus,
    collectionReminderDate: documents.collectionReminderDate,
    collectionOwnerId: documents.collectionOwnerId,
    clientId: documents.clientId,
    projectId: documents.projectId,
    relatedDocumentId: documents.relatedDocumentId,
    invoiceStage: documents.invoiceStage,
    updatedAt: documents.updatedAt,
    clientName: clients.companyName,
    contactName: clients.contactName,
    clientAddress: clients.address,
    clientEmail: clients.email,
    clientTaxId: clients.taxId,
    clientRegistrationNumber: clients.registrationNumber,
    clientIdentityKind: clients.identityKind,
    projectName: projects.name,
    projectLocation: projects.location
  }).from(documents).innerJoin(clients, eq(documents.clientId, clients.id)).leftJoin(projects, eq(documents.projectId, projects.id)).where(and(eq(documents.id, id), eq(documents.tenantId, currentTenant()))).limit(1);
  if (!header[0]) return null;
  const lines = await db.select().from(documentLines).where(and(eq(documentLines.documentId, id), eq(documentLines.tenantId, currentTenant()))).orderBy(asc(documentLines.position));
  const paymentRows = await db.select().from(payments).where(and(eq(payments.documentId, id), eq(payments.tenantId, currentTenant()))).orderBy(desc(payments.paidAt), desc(payments.createdAt));
  const paidAmount = paymentRows.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = calculatePaymentBalance(header[0].total, paidAmount);
  const status = header[0].kind === "facture" ? invoicePaymentStatus(header[0].total, paidAmount, header[0].dueDate, header[0].status) : header[0].status;
  return { ...header[0], status, lines, payments: paymentRows, paidAmount, balanceDue: header[0].kind === "facture" ? balance.balanceDue : 0, isOverdue: header[0].kind === "facture" && isInvoiceOverdue(status, header[0].dueDate) };
}
async function createDocument(input) {
  const db = await requireDb();
  const totals = calculateDocumentDiscount(input.lines, input.discountPercent);
  const result = await db.transaction(async (tx) => {
    await tx.insert(documentSequences).values({ tenantId: currentTenant(), kind: input.kind, lastValue: 1 }).onConflictDoUpdate({ target: documentSequences.kind, set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const sequence = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, input.kind), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const serial2 = sequence[0]?.lastValue ?? 1;
    const documentValues = {
      tenantId: currentTenant(),
      kind: input.kind,
      number: formatDocumentNumber(input.kind, new Date(input.issueDate).getUTCFullYear(), serial2),
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      relatedDocumentId: input.relatedDocumentId ?? null,
      status: initialDocumentStatus(input.status, Boolean(input.isAiDraft)),
      issueDate: /* @__PURE__ */ new Date(`${input.issueDate}T00:00:00.000Z`),
      dueDate: input.dueDate ? /* @__PURE__ */ new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      validUntil: input.validUntil ? /* @__PURE__ */ new Date(`${input.validUntil}T00:00:00.000Z`) : null,
      depositPercent: input.depositPercent ?? null,
      depositDueDate: input.depositDueDate ? /* @__PURE__ */ new Date(`${input.depositDueDate}T00:00:00.000Z`) : null,
      balanceDueDate: input.balanceDueDate ? /* @__PURE__ */ new Date(`${input.balanceDueDate}T00:00:00.000Z`) : null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.totalAfterDiscount,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      notes: input.notes || null,
      isAiDraft: input.isAiDraft ? "oui" : "non",
      createdById: input.createdById
    };
    const documentResult = await tx.insert(documents).values(documentValues).returning({ id: documents.id });
    const documentId = documentResult[0].id;
    if (input.lines.length) {
      await tx.insert(documentLines).values(
        input.lines.map((line, index2) => {
          const base = Math.round(line.quantity * line.unitPrice);
          const tax = Math.round(base * line.taxRate / 100);
          return {
            tenantId: currentTenant(),
            documentId,
            position: index2 + 1,
            description: line.description,
            quantity: line.quantity.toFixed(2),
            unit: line.unit,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            lineTotal: base + tax,
            serviceId: line.serviceId ?? null
          };
        })
      );
    }
    return { id: documentId, number: formatDocumentNumber(input.kind, new Date(input.issueDate).getUTCFullYear(), serial2) };
  });
  return { ...result, totals: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.totalAfterDiscount, discountPercent: totals.discountPercent, discountAmount: totals.discountAmount } };
}
async function updateDocumentStatus(id, status, actorId, activity) {
  const db = await requireDb();
  const [current] = await db.select({ id: documents.id, clientId: documents.clientId, number: documents.number, status: documents.status }).from(documents).where(and(eq(documents.id, id), eq(documents.tenantId, currentTenant()))).limit(1);
  if (!current) throw new Error("Document introuvable.");
  if (current.status === status) return { success: true, changed: false };
  await db.update(documents).set({ status }).where(and(eq(documents.id, id), eq(documents.tenantId, currentTenant())));
  if (actorId) {
    await createClientActivity({
      clientId: current.clientId,
      documentId: id,
      type: "statut_document",
      title: activity?.title ?? `Statut document : ${current.status} \u2192 ${status}`,
      description: activity?.description ?? current.number,
      createdById: actorId
    });
  }
  return { success: true, changed: true };
}
async function createDepositInvoiceFromQuote(quoteId, createdById) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const quoteRows = await tx.select().from(documents).where(and(eq(documents.id, quoteId), eq(documents.tenantId, currentTenant()))).limit(1);
    const quote = quoteRows[0];
    if (!quote || quote.kind !== "devis") throw new Error("Le devis demand\xE9 est introuvable.");
    if (quote.status !== "accepte") throw new Error("Seul un devis accept\xE9 peut g\xE9n\xE9rer une facture d\u2019acompte.");
    const existing = await tx.select({ id: documents.id, number: documents.number }).from(documents).where(and(eq(documents.kind, "facture"), eq(documents.relatedDocumentId, quoteId), eq(documents.invoiceStage, "acompte"))).limit(1);
    const existingDeposit = reuseExistingGeneratedInvoice(existing[0]);
    if (existingDeposit) return existingDeposit;
    const amount = calculateDepositInvoiceAmount(quote.total, quote.depositPercent);
    await tx.insert(documentSequences).values({ tenantId: currentTenant(), kind: "facture", lastValue: 1 }).onConflictDoUpdate({ target: documentSequences.kind, set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const sequence = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, "facture"), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const serial2 = sequence[0]?.lastValue ?? 1;
    const number = formatDocumentNumber("facture", quote.issueDate.getUTCFullYear(), serial2);
    const result = await tx.insert(documents).values({
      tenantId: currentTenant(),
      kind: "facture",
      number,
      clientId: quote.clientId,
      projectId: quote.projectId,
      relatedDocumentId: quote.id,
      invoiceStage: "acompte",
      status: "brouillon",
      issueDate: /* @__PURE__ */ new Date(),
      dueDate: quote.depositDueDate ?? /* @__PURE__ */ new Date(),
      validUntil: null,
      depositPercent: null,
      depositDueDate: null,
      balanceDueDate: null,
      discountPercent: 0,
      discountAmount: 0,
      subtotal: amount,
      taxTotal: 0,
      total: amount,
      notes: `Facture d\u2019acompte de ${quote.depositPercent}% g\xE9n\xE9r\xE9e \xE0 partir du devis ${quote.number}.`,
      isAiDraft: "non",
      createdById
    }).returning({ id: documents.id });
    const id = result[0].id;
    await tx.insert(documentLines).values({ tenantId: currentTenant(), documentId: id, position: 1, description: `Acompte de ${quote.depositPercent}% sur devis ${quote.number}`, quantity: "1.00", unit: "forfait", unitPrice: amount, taxRate: 0, lineTotal: amount, serviceId: null });
    return { id, number, existing: false };
  });
}
async function createBalanceInvoiceFromDeposit(depositInvoiceId, createdById) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const depositRows = await tx.select().from(documents).where(and(eq(documents.id, depositInvoiceId), eq(documents.tenantId, currentTenant()))).limit(1);
    const deposit = depositRows[0];
    if (!deposit || deposit.kind !== "facture" || deposit.invoiceStage !== "acompte" || !deposit.relatedDocumentId) throw new Error("La facture d\u2019acompte demand\xE9e est introuvable.");
    const quoteRows = await tx.select().from(documents).where(and(eq(documents.id, deposit.relatedDocumentId), eq(documents.tenantId, currentTenant()))).limit(1);
    const quote = quoteRows[0];
    if (!quote || quote.kind !== "devis" || quote.status !== "accepte") throw new Error("Le devis d\u2019origine doit \xEAtre accept\xE9.");
    const depositPayments = await tx.select({ amount: payments.amount }).from(payments).where(and(eq(payments.documentId, deposit.id), eq(payments.tenantId, currentTenant())));
    const paidAmount = depositPayments.reduce((sum, payment) => sum + payment.amount, 0);
    assertDepositInvoiceIsFullyPaid(deposit.total, paidAmount);
    const existing = await tx.select({ id: documents.id, number: documents.number }).from(documents).where(and(eq(documents.kind, "facture"), eq(documents.relatedDocumentId, deposit.id), eq(documents.invoiceStage, "solde"))).limit(1);
    const existingBalance = reuseExistingGeneratedInvoice(existing[0]);
    if (existingBalance) return existingBalance;
    const amount = calculateBalanceInvoiceAmount(quote.total, deposit.total);
    await tx.insert(documentSequences).values({ tenantId: currentTenant(), kind: "facture", lastValue: 1 }).onConflictDoUpdate({ target: documentSequences.kind, set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const sequence = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, "facture"), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const serial2 = sequence[0]?.lastValue ?? 1;
    const number = formatDocumentNumber("facture", quote.issueDate.getUTCFullYear(), serial2);
    const result = await tx.insert(documents).values({
      tenantId: currentTenant(),
      kind: "facture",
      number,
      clientId: quote.clientId,
      projectId: quote.projectId,
      relatedDocumentId: deposit.id,
      invoiceStage: "solde",
      status: "brouillon",
      issueDate: /* @__PURE__ */ new Date(),
      dueDate: quote.balanceDueDate ?? /* @__PURE__ */ new Date(),
      validUntil: null,
      depositPercent: null,
      depositDueDate: null,
      balanceDueDate: null,
      discountPercent: 0,
      discountAmount: 0,
      subtotal: amount,
      taxTotal: 0,
      total: amount,
      notes: `Facture de solde g\xE9n\xE9r\xE9e apr\xE8s r\xE8glement de l\u2019acompte li\xE9 au devis ${quote.number}.`,
      isAiDraft: "non",
      createdById
    }).returning({ id: documents.id });
    const id = result[0].id;
    await tx.insert(documentLines).values({ tenantId: currentTenant(), documentId: id, position: 1, description: `Solde sur devis ${quote.number} apr\xE8s acompte`, quantity: "1.00", unit: "forfait", unitPrice: amount, taxRate: 0, lineTotal: amount, serviceId: null });
    return { id, number, existing: false };
  });
}
async function createInvoiceFromQuote(quoteId, createdById) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const quoteRows = await tx.select().from(documents).where(and(eq(documents.id, quoteId), eq(documents.tenantId, currentTenant()))).limit(1);
    const quote = quoteRows[0];
    if (!quote || quote.kind !== "devis") throw new Error("Le devis est introuvable.");
    if (quote.status !== "accepte") throw new Error("Seul un devis accept\xE9 peut \xEAtre converti en facture.");
    const existing = await tx.select({ id: documents.id }).from(documents).where(and(eq(documents.kind, "facture"), eq(documents.relatedDocumentId, quoteId), eq(documents.invoiceStage, "standard"))).limit(1);
    if (existing[0]) return { id: existing[0].id, existing: true };
    const lines = await tx.select().from(documentLines).where(and(eq(documentLines.documentId, quoteId), eq(documentLines.tenantId, currentTenant()))).orderBy(documentLines.position);
    if (!lines.length) throw new Error("Le devis ne contient aucune ligne \xE0 facturer.");
    await tx.insert(documentSequences).values({ tenantId: currentTenant(), kind: "facture", lastValue: 1 }).onConflictDoUpdate({ target: documentSequences.kind, set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
    const seq = await tx.select().from(documentSequences).where(and(eq(documentSequences.kind, "facture"), eq(documentSequences.tenantId, currentTenant()))).limit(1);
    const number = formatDocumentNumber("facture", (/* @__PURE__ */ new Date()).getUTCFullYear(), seq[0]?.lastValue ?? 1);
    const result = await tx.insert(documents).values({
      tenantId: currentTenant(),
      kind: "facture",
      number,
      clientId: quote.clientId,
      projectId: quote.projectId,
      relatedDocumentId: quote.id,
      invoiceStage: "standard",
      status: "brouillon",
      issueDate: /* @__PURE__ */ new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1e3),
      validUntil: null,
      depositPercent: null,
      depositDueDate: null,
      balanceDueDate: null,
      discountPercent: quote.discountPercent,
      discountAmount: quote.discountAmount,
      subtotal: quote.subtotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
      notes: `Facture g\xE9n\xE9r\xE9e \xE0 partir du devis ${quote.number}.`,
      isAiDraft: "non",
      createdById
    }).returning({ id: documents.id });
    const id = result[0].id;
    await tx.insert(documentLines).values(lines.map((l) => ({
      tenantId: currentTenant(),
      documentId: id,
      position: l.position,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      lineTotal: l.lineTotal,
      serviceId: l.serviceId
    })));
    return { id, number, existing: false };
  });
}
async function recordPayment(input) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const document = await tx.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, currentTenant()))).limit(1);
    const invoice = document[0];
    if (!invoice || invoice.kind !== "facture") throw new Error("Seules les factures peuvent recevoir un paiement.");
    if (["annule", "refuse"].includes(invoice.status)) throw new Error("Cette facture ne peut plus recevoir de paiement.");
    const existingPayments = await tx.select({ amount: payments.amount }).from(payments).where(and(eq(payments.documentId, input.documentId), eq(payments.tenantId, currentTenant())));
    const paidBefore = existingPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const balanceBefore = calculatePaymentBalance(invoice.total, paidBefore);
    if (input.amount > balanceBefore.balanceDue) throw new Error("Le montant saisi d\xE9passe le solde restant d\xFB.");
    const result = await tx.insert(payments).values({ tenantId: currentTenant(), documentId: input.documentId, amount: input.amount, paidAt: /* @__PURE__ */ new Date(`${input.paidAt}T00:00:00.000Z`), method: input.method, reference: input.reference || null, notes: input.notes || null, createdById: input.createdById }).returning({ id: payments.id });
    const paidAfter = paidBefore + input.amount;
    const status = invoicePaymentStatus(invoice.total, paidAfter, invoice.dueDate, invoice.status);
    await tx.update(documents).set({ status }).where(and(eq(documents.id, input.documentId), eq(documents.tenantId, currentTenant())));
    const methodLabel = input.method === "mobile_money" ? "Mobile Money (saisie)" : input.method;
    await tx.insert(clientActivities).values({
      tenantId: currentTenant(),
      clientId: invoice.clientId,
      documentId: input.documentId,
      type: "note",
      title: "Paiement manuel enregistr\xE9",
      description: `${invoice.number} \xB7 ${input.amount.toLocaleString("fr-GN")} GNF \xB7 ${methodLabel}${input.reference ? ` \xB7 r\xE9f. ${input.reference}` : ""}`,
      createdById: input.createdById
    });
    return { id: result[0].id, paidAmount: paidAfter, balanceDue: calculatePaymentBalance(invoice.total, paidAfter).balanceDue, status };
  });
}
async function updateDocument(input) {
  const db = await requireDb();
  const totals = calculateDocumentDiscount(input.lines, input.discountPercent);
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ id: documents.id, clientId: documents.clientId, number: documents.number, status: documents.status, updatedAt: documents.updatedAt }).from(documents).where(and(eq(documents.id, input.id), eq(documents.tenantId, currentTenant()))).limit(1);
    if (!current) throw new Error("Document introuvable.");
    if (isConcurrentDocumentUpdate(current.updatedAt, input.expectedUpdatedAt)) {
      throw new Error("Ce document a \xE9t\xE9 modifi\xE9 ailleurs. Rechargez la page avant d\u2019enregistrer.");
    }
    await tx.update(documents).set({
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      status: input.status,
      issueDate: /* @__PURE__ */ new Date(`${input.issueDate}T00:00:00.000Z`),
      dueDate: input.dueDate ? /* @__PURE__ */ new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      validUntil: input.validUntil ? /* @__PURE__ */ new Date(`${input.validUntil}T00:00:00.000Z`) : null,
      depositPercent: input.depositPercent ?? null,
      depositDueDate: input.depositDueDate ? /* @__PURE__ */ new Date(`${input.depositDueDate}T00:00:00.000Z`) : null,
      balanceDueDate: input.balanceDueDate ? /* @__PURE__ */ new Date(`${input.balanceDueDate}T00:00:00.000Z`) : null,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.totalAfterDiscount,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      notes: input.notes || null
    }).where(and(eq(documents.id, input.id), eq(documents.tenantId, currentTenant())));
    await tx.delete(documentLines).where(and(eq(documentLines.documentId, input.id), eq(documentLines.tenantId, currentTenant())));
    await tx.insert(documentLines).values(input.lines.map((line, index2) => {
      const base = Math.round(line.quantity * line.unitPrice);
      const tax = Math.round(base * line.taxRate / 100);
      return {
        tenantId: currentTenant(),
        documentId: input.id,
        position: index2 + 1,
        description: line.description,
        quantity: line.quantity.toFixed(2),
        unit: line.unit,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        lineTotal: base + tax,
        serviceId: line.serviceId ?? null
      };
    }));
    if (input.updatedById && current.status !== input.status) {
      await tx.insert(clientActivities).values({
        tenantId: currentTenant(),
        clientId: current.clientId,
        documentId: input.id,
        type: "statut_document",
        title: `Statut document : ${current.status} \u2192 ${input.status}`,
        description: current.number,
        createdById: input.updatedById
      });
    }
  });
  return { success: true, totals: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.totalAfterDiscount, discountPercent: totals.discountPercent, discountAmount: totals.discountAmount } };
}
async function getDashboardData() {
  const allDocuments = await listDocuments();
  const now = /* @__PURE__ */ new Date();
  const priority = allDocuments.filter((document) => document.status === "a_envoyer" || document.kind === "facture" && document.dueDate && document.dueDate < now && !["paye", "annule", "refuse"].includes(document.status)).slice(0, 6);
  return {
    counts: summarizeDashboard(allDocuments, now),
    priority
  };
}
async function listEmailTemplates() {
  const db = await requireDb();
  const tenantId = currentTenant();
  const rows = await db.select().from(emailTemplates).where(
    tenantId ? or(eq(emailTemplates.tenantId, tenantId), sql`${emailTemplates.tenantId} IS NULL`) : sql`${emailTemplates.tenantId} IS NULL`
  );
  const bySlug = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const existing = bySlug.get(row.slug);
    if (!existing || existing.tenantId === null && row.tenantId !== null) {
      bySlug.set(row.slug, row);
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}
async function getEmailTemplateBySlug(slug) {
  const db = await requireDb();
  const tenantId = currentTenant();
  if (tenantId) {
    const [tenantTemplate] = await db.select().from(emailTemplates).where(
      and(eq(emailTemplates.slug, slug), eq(emailTemplates.tenantId, tenantId))
    ).limit(1);
    if (tenantTemplate) return tenantTemplate;
  }
  const [globalTemplate] = await db.select().from(emailTemplates).where(
    and(eq(emailTemplates.slug, slug), sql`${emailTemplates.tenantId} IS NULL`)
  ).limit(1);
  return globalTemplate;
}
async function createEmailTemplate(input) {
  const db = await requireDb();
  const [row] = await db.insert(emailTemplates).values({
    slug: input.slug,
    name: input.name,
    subject: input.subject,
    html: input.html,
    text: input.text ?? null,
    tenantId: input.tenantId ?? currentTenant()
  }).returning({ id: emailTemplates.id });
  return { id: row.id };
}
async function updateEmailTemplate(id, input) {
  const db = await requireDb();
  await db.update(emailTemplates).set(input).where(eq(emailTemplates.id, id));
}
async function deleteEmailTemplate(id) {
  const db = await requireDb();
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
}
async function renderEmailTemplate2(slug, variables) {
  const template = await getEmailTemplateBySlug(slug);
  if (template && template.enabled !== "non") {
    let subject = template.subject;
    let html = template.html;
    let text2 = template.text ?? "";
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
      text2 = text2.replace(regex, value);
    }
    return { subject, html, text: text2 };
  }
  const { renderEmailTemplate: renderStatic, EMAIL_TEMPLATES: EMAIL_TEMPLATES2 } = await Promise.resolve().then(() => (init_emailTemplates(), emailTemplates_exports));
  const staticId = EMAIL_TEMPLATES2.find((entry) => entry.id === slug)?.id;
  if (!staticId) return null;
  return renderStatic(staticId, variables);
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req) || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "lax" : "lax",
    secure
  };
}

// server/_core/llm.ts
init_env();
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/chat/completions` : "https://integrate.api.nvidia.com/v1/chat/completions";
var resolveModelsUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/models` : "https://integrate.api.nvidia.com/v1/models";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
function extractJson(raw) {
  const text2 = raw.trim();
  try {
    return { value: JSON.parse(text2), ok: true };
  } catch {
  }
  const fence = text2.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return { value: JSON.parse(fence[1].trim()), ok: true };
    } catch {
    }
  }
  const start = text2.search(/[{\[]/);
  if (start !== -1) {
    for (let end = text2.length - 1; end > start; end--) {
      const ch = text2[end];
      if (ch === "}" || ch === "]") {
        const candidate = text2.slice(start, end + 1);
        try {
          return { value: JSON.parse(candidate), ok: true };
        } catch {
        }
      }
    }
  }
  return { value: raw, ok: false };
}
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage),
    stream: false
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.messages = payload.messages.map(
      (m) => m.role === "system" ? { ...m, content: `R\xC8GLE ABSOLUE : R\xE9ponds UNIQUEMENT par un objet JSON valide, sans aucun texte autour, sans bloc Markdown, sans explication. La premi\xE8re ligne doit \xEAtre exactement "{" et la derni\xE8re "}".

${m.content}` } : m
    );
  }
  if (model) {
    payload.model = model;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  if (normalizedResponseFormat) {
    const rf = normalizedResponseFormat;
    if (rf.type === "json_schema" && rf.json_schema?.schema) {
      payload.response_format = {
        type: "json_schema",
        json_schema: rf.json_schema
      };
    } else {
      payload.response_format = rf;
    }
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(rawContent);
  const safeContent = parsed.ok ? JSON.stringify(parsed.value) : rawContent;
  return {
    id: data.id ?? `chatcmpl-${Date.now()}`,
    created: data.created ?? Math.floor(Date.now() / 1e3),
    model: data.model,
    choices: [{
      index: 0,
      message: {
        role: data.choices?.[0]?.message?.role ?? "assistant",
        content: safeContent
      },
      finish_reason: data.choices?.[0]?.finish_reason ?? "stop"
    }],
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0
    }
  };
}
async function listLLMModels() {
  assertApiKey();
  const url = resolveModelsUrl();
  const response = await fetchWithBackoff(url, {
    headers: { authorization: `Bearer ${ENV.forgeApiKey}` }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  const data = await response.json();
  const models = (data.data ?? []).map((m) => ({
    id: m.id,
    object: m.object ?? "model",
    created: m.created ?? Date.now(),
    owned_by: m.owned_by ?? "nvidia"
  }));
  return { object: "list", data: models };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/health.ts
function buildHealthPayload(input) {
  const db = input.dbOk ? "up" : "down";
  return {
    ok: input.dbOk,
    db,
    uptimeSec: Math.max(0, Math.round(input.uptimeSec ?? process.uptime())),
    poolLimit: input.poolLimit ?? parseDatabasePoolSize(process.env.DATABASE_POOL_SIZE),
    timestamp: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
  };
}

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/trpc.ts
init_tenantContext();
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
var t = initTRPC.context().create({});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const user2 = ctx.user;
  const tenantId = ctx.tenantId;
  if (!user2) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!tenantId) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: "Aucun tenant associ\xE9." });
  }
  return runWithTenant(
    tenantId,
    () => next({
      ctx: {
        ...ctx,
        user: user2,
        tenantId
      }
    })
  );
});
function requireRoles(allowed, forbiddenMessage) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const user2 = ctx.user;
    const tenantId = ctx.tenantId;
    if (!user2 || !allowed.includes(user2.role)) {
      throw new TRPCError2({ code: "FORBIDDEN", message: forbiddenMessage });
    }
    if (!tenantId) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: "Aucun tenant associ\xE9." });
    }
    return runWithTenant(
      tenantId,
      () => next({
        ctx: {
          ...ctx,
          user: user2,
          tenantId
        }
      })
    );
  });
}
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  requireRoles(["admin"], NOT_ADMIN_ERR_MSG)
);
var directionProcedure = t.procedure.use(
  requireRoles(["admin", "directeur"], "Acc\xE8s r\xE9serv\xE9 \xE0 la direction.")
);
var staffProcedure = t.procedure.use(
  requireRoles(
    ["admin", "directeur", "cadre"],
    "Acc\xE8s r\xE9serv\xE9 \xE0 l\u2019\xE9quipe commerciale Lucepres."
  )
);

// server/_core/systemRouter.ts
var systemRouter = router({
  // Sans input obligatoire : le moniteur VPS / curl GET doit pouvoir
  // appeler /api/trpc/system.health sans payload.
  health: publicProcedure.query(async () => {
    const dbOk = await pingDatabase();
    return buildHealthPayload({ dbOk });
  }),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/_core/mailer.ts
import nodemailer from "nodemailer";
var host = process.env.SMTP_HOST?.trim();
var port = Number(process.env.SMTP_PORT);
var user = process.env.SMTP_USER?.trim();
var pass = process.env.SMTP_PASS?.trim();
var fromEnv = process.env.SMTP_FROM?.trim();
var transporter = null;
if (host && Number.isFinite(port) && port > 0 && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
} else {
  console.warn(
    "[mailer] Variables SMTP_* manquantes : les e\u2011mails ne seront pas envoy\xE9s."
  );
}
function isMailConfigured() {
  return transporter !== null;
}
function getSmtpUser() {
  return process.env.SMTP_USER?.trim() || void 0;
}
function getDefaultFrom() {
  if (fromEnv) return fromEnv;
  if (user) return `"Lucepres" <${user}>`;
  return "Lucepres <noreply@lucepress.local>";
}
async function sendMail(options) {
  if (!transporter) {
    throw new Error(
      "Le serveur SMTP n\u2019est pas configur\xE9. V\xE9rifiez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS."
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
    attachments: options.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType
    }))
  });
  const rejected = Array.isArray(info.rejected) ? info.rejected.map(String) : [];
  console.log(
    `[mailer] Envoy\xE9: ${info.messageId} \u2192 ${options.to}${options.bcc ? ` (bcc ${Array.isArray(options.bcc) ? options.bcc.join(",") : options.bcc})` : ""} accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(rejected)} response=${info.response || ""}`
  );
  if (rejected.length > 0) {
    throw new Error(`SMTP a rejet\xE9 le destinataire : ${rejected.join(", ")}`);
  }
  return info;
}

// shared/clientActivityTypes.ts
var CLIENT_ACTIVITY_TYPES = [
  "relance_preparee",
  "note",
  "statut_recouvrement",
  "responsable_recouvrement",
  "date_rappel_recouvrement",
  "email_envoye",
  "statut_document"
];

// shared/roles.ts
var STAFF_ROLES = ["admin", "directeur", "cadre"];
var APP_ROLES = [...STAFF_ROLES, "client"];
function isStaffRole(role) {
  return role === "admin" || role === "directeur" || role === "cadre";
}

// server/routers.ts
import { parse as parseCookieHeader } from "cookie";

// server/_core/heartbeat.ts
init_env();
import { TRPCError as TRPCError3 } from "@trpc/server";
var SERVICE = "webdevtoken.v1.WebDevService";
var buildEndpoint = (rpc) => {
  if (!ENV.forgeApiUrl) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service URL is not configured (BUILT_IN_FORGE_API_URL)."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service API key is not configured (BUILT_IN_FORGE_API_KEY)."
    });
  }
  const baseUrl = ENV.forgeApiUrl;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${SERVICE}/${rpc}`, normalizedBase).toString();
};
var callForge = async (rpc, body, userSession) => {
  const endpoint = buildEndpoint(rpc);
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${ENV.forgeApiKey}`,
    "content-type": "application/json",
    "connect-protocol-version": "1"
  };
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: `Heartbeat ${rpc} network error: ${String(error)}`
    });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw mapForgeError(response, detail, rpc);
  }
  return await response.json();
};
var mapForgeError = (response, detail, rpc) => {
  const status = response.status;
  let code = "INTERNAL_SERVER_ERROR";
  if (status === 401) code = "UNAUTHORIZED";
  else if (status === 403) code = "FORBIDDEN";
  else if (status === 404) code = "NOT_FOUND";
  else if (status === 400 || status === 422) code = "BAD_REQUEST";
  else if (status === 409) code = "CONFLICT";
  else if (status === 429) code = "TOO_MANY_REQUESTS";
  return new TRPCError3({
    code,
    message: `Heartbeat ${rpc} failed (${status})${detail ? `: ${detail}` : ""}`
  });
};
var stringifyPayload = (payload) => {
  if (payload === void 0 || payload === null) return "{}";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload);
};
var validateCallbackPath = (path3) => {
  if (!path3 || !path3.startsWith("/api/scheduled/")) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "callback path must start with /api/scheduled/"
    });
  }
};
async function createHeartbeatJob(job, userSession) {
  validateCallbackPath(job.path);
  return callForge(
    "CreateHeartbeatJob",
    {
      name: job.name,
      cronExpression: job.cron,
      callbackPath: job.path,
      callbackMethod: job.method ?? "POST",
      callbackPayload: stringifyPayload(job.payload),
      description: job.description ?? ""
    },
    userSession
  );
}

// shared/agentCampaignSchedule.ts
var WEEKDAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
function buildCampaignSchedule(input) {
  const match = /^(\d{2}):(\d{2})$/.exec(input.time);
  if (!match) throw new Error("Choisissez une heure au format HH:MM.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("L\u2019heure de programmation est invalide.");
  if (input.frequency === "weekly" && (!Number.isInteger(input.weekday) || (input.weekday ?? -1) < 0 || (input.weekday ?? 7) > 6)) throw new Error("Choisissez le jour de la campagne hebdomadaire.");
  const cron = input.frequency === "daily" ? `0 ${minute} ${hour} * * *` : `0 ${minute} ${hour} * * ${input.weekday}`;
  const label = input.frequency === "daily" ? `Chaque jour \xE0 ${input.time} (Conakry)` : `Chaque ${WEEKDAY_LABELS[input.weekday].toLowerCase()} \xE0 ${input.time} (Conakry)`;
  return { cron, label, timeZone: "Africa/Conakry" };
}

// shared/batchReminders.ts
var BATCH_REMINDER_LIMIT = 20;
function normalizeBatchReminderDocumentIds(documentIds) {
  const uniqueIds = documentIds.filter((documentId, index2) => documentIds.indexOf(documentId) === index2);
  if (!uniqueIds.length) throw new Error("S\xE9lectionnez au moins une facture \xE0 relancer.");
  if (uniqueIds.length > BATCH_REMINDER_LIMIT) throw new Error(`La pr\xE9paration group\xE9e est limit\xE9e \xE0 ${BATCH_REMINDER_LIMIT} factures \xE0 la fois.`);
  return uniqueIds;
}
function normalizeBatchReminderInstruction(value) {
  const instruction = value?.trim();
  return instruction ? instruction : void 0;
}

// server/_core/guestShareRateLimit.ts
var DEFAULTS = {
  windowMs: 15 * 6e4,
  maxAttempts: 40,
  blockMs: 15 * 6e4,
  maxTrackedKeys: 5e3
};
var buckets = /* @__PURE__ */ new Map();
function prune(now) {
  if (buckets.size <= DEFAULTS.maxTrackedKeys) return;
  for (const [key, bucket] of Array.from(buckets.entries())) {
    if (bucket.blockedUntil < now && bucket.windowStartedAt + DEFAULTS.windowMs < now) {
      buckets.delete(key);
    }
  }
  while (buckets.size > DEFAULTS.maxTrackedKeys) {
    const first = buckets.keys().next().value;
    if (first === void 0) break;
    buckets.delete(first);
  }
}
function assertGuestShareRateLimit(ip) {
  const key = (ip || "unknown").trim() || "unknown";
  const now = Date.now();
  prune(now);
  const existing = buckets.get(key);
  if (existing && existing.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.blockedUntil - now) / 1e3) };
  }
  if (!existing || existing.windowStartedAt + DEFAULTS.windowMs < now) {
    buckets.set(key, { count: 1, windowStartedAt: now, blockedUntil: 0 });
    return { allowed: true };
  }
  existing.count += 1;
  if (existing.count > DEFAULTS.maxAttempts) {
    existing.blockedUntil = now + DEFAULTS.blockMs;
    return { allowed: false, retryAfterSeconds: Math.ceil(DEFAULTS.blockMs / 1e3) };
  }
  return { allowed: true };
}

// server/documentSharePdf.ts
import { jsPDF } from "jspdf";
function fmtDate(value) {
  if (!value) return "\u2014";
  return new Date(value).toLocaleDateString("fr-GN");
}
function buildDocumentSharePdfBuffer(document, company = {}) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const kindLabel = document.kind === "facture" ? "Facture" : "Devis";
  let y = 18;
  const left = 16;
  const width = 178;
  const line = (text2, size = 10, style = "normal") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    const rows = pdf.splitTextToSize(text2, width);
    for (const row of rows) {
      if (y > 280) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(row, left, y);
      y += size * 0.45 + 2;
    }
  };
  line(company.legalName || "Lucepres", 16, "bold");
  if (company.legalAddress) line(company.legalAddress, 9);
  if (company.phone || company.email) line([company.phone, company.email].filter(Boolean).join(" \xB7 "), 9);
  y += 4;
  line(`${kindLabel} ${document.number}`, 14, "bold");
  line(`\xC9mis le ${fmtDate(document.issueDate)}`, 10);
  if (document.kind === "devis" && document.validUntil) line(`Valable jusqu\u2019au ${fmtDate(document.validUntil)}`, 10);
  if (document.kind === "facture" && document.dueDate) line(`\xC9ch\xE9ance ${fmtDate(document.dueDate)}`, 10);
  y += 3;
  line("Destinataire", 11, "bold");
  line(document.clientName, 10, "bold");
  if (document.contactName) line(document.contactName, 10);
  if (document.clientAddress) line(document.clientAddress, 9);
  y += 3;
  line("D\xE9signation", 11, "bold");
  for (const item of document.lines) {
    line(`${item.description} (${item.unit}) \xB7 qt\xE9 ${Number(item.quantity)} \xB7 ${formatGnf(item.lineTotal)}`, 9);
  }
  y += 3;
  line(`Sous-total : ${formatGnf(document.subtotal)}`, 10);
  line(`Taxes : ${formatGnf(document.taxTotal)}`, 10);
  line(`Total TTC : ${formatGnf(document.total)}`, 12, "bold");
  if (document.notes) {
    y += 3;
    line("Notes", 11, "bold");
    line(document.notes, 9);
  }
  y += 6;
  line("Document g\xE9n\xE9r\xE9 par Lucepres Gestion.", 8);
  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// server/routers.ts
function getRequestOrigin(req) {
  const configured = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.get?.("x-forwarded-proto") || req.protocol || "https";
  const host2 = req.get?.("x-forwarded-host") || req.get?.("host");
  if (!host2 || host2.includes("localhost") || host2.startsWith("127.")) {
    return "https://lucepress.213.156.135.139.sslip.io";
  }
  return `${proto}://${host2}`;
}
var reminderEmailInputSchema = z2.object({
  documentId: z2.number().int().positive(),
  subject: z2.string().trim().min(3).max(255),
  greeting: z2.string().trim().min(1).max(500),
  body: z2.string().trim().min(3).max(8e3),
  closing: z2.string().trim().min(1).max(1e3),
  to: z2.string().email().max(320).optional()
});
async function dispatchReminderEmail(input, actorId) {
  const document = await getDocumentById(input.documentId);
  if (!document || document.kind !== "facture" || document.balanceDue <= 0) {
    throw new TRPCError4({ code: "BAD_REQUEST", message: "La relance doit concerner une facture avec un solde impay\xE9." });
  }
  const to = (input.to ?? document.clientEmail ?? "").trim();
  if (!to) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: "Aucune adresse e-mail client. Renseignez l\u2019e-mail sur la fiche client."
    });
  }
  const text2 = `${input.greeting}

${input.body}

${input.closing}`;
  const html = `<p>${input.greeting.replace(/\n/g, "<br/>")}</p><p>${input.body.replace(/\n/g, "<br/>")}</p><p>${input.closing.replace(/\n/g, "<br/>")}</p>`;
  try {
    await sendMail({ to, subject: input.subject, text: text2, html });
  } catch (error) {
    throw new TRPCError4({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "\xC9chec d\u2019envoi de la relance."
    });
  }
  await createClientActivity({
    clientId: document.clientId,
    documentId: document.id,
    type: "email_envoye",
    title: "Relance envoy\xE9e par e-mail",
    description: `${document.number} \u2192 ${to} \xB7 ${input.subject}`,
    createdById: actorId
  });
  return { success: true, emailed: true, to, documentId: document.id };
}
async function issueInvitation(opts) {
  const existant = await getUserByEmail(opts.email);
  if (existant) {
    throw new TRPCError4({ code: "CONFLICT", message: "Un compte existe d\xE9j\xE0 avec cet e-mail." });
  }
  const enAttente = await listInvitations();
  for (const inv of enAttente) {
    if (inv.email === opts.email && inv.status === "pending") {
      await revokeInvitation(inv.id);
    }
  }
  const { createInvitationToken: createInvitationToken2, hashInvitationToken: hashInvitationToken2 } = await Promise.resolve().then(() => (init_invitationToken(), invitationToken_exports));
  const token = createInvitationToken2();
  const tokenHash = hashInvitationToken2(token);
  await createInvitation({
    tokenHash,
    email: opts.email,
    role: opts.role,
    invitedBy: opts.invitedById,
    tenantId: opts.tenantId
  });
  const origin = getRequestOrigin(opts.req);
  const inviteLink = `${origin}/invitation?token=${token}`;
  let emailed = false;
  let emailError;
  if (!isMailConfigured()) {
    emailError = "SMTP non configur\xE9.";
  } else {
    try {
      const rendered = await renderEmailTemplate2("invitation", {
        inviterName: opts.invitedByName ?? "Lucepres",
        inviteLink,
        organization: LUCEPRES_PUBLIC_PROFILE.legalName,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toLocaleString("fr-FR")
      });
      await sendMail({
        to: opts.email,
        bcc: (() => {
          const smtpUser = getSmtpUser();
          if (!smtpUser) return void 0;
          if (smtpUser.toLowerCase() === opts.email.trim().toLowerCase()) return void 0;
          return smtpUser;
        })(),
        subject: rendered?.subject ?? `Invitation \xE0 rejoindre ${LUCEPRES_PUBLIC_PROFILE.legalName}`,
        html: rendered?.html ?? "",
        text: rendered?.text ?? `${opts.invitedByName ?? "Lucepres"} vous invite \xE0 rejoindre Lucepress.

Accepter l'invitation : ${inviteLink}

Ce lien expirera dans 72 heures.`
      });
      emailed = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "\xC9chec d'envoi d'e-mail";
      console.error("[invite] \xC9chec d'envoi d'e-mail:", err);
    }
  }
  return {
    success: true,
    invitationLink: inviteLink,
    email: opts.email,
    role: opts.role,
    emailed,
    emailError,
    smtpConfigured: isMailConfigured()
  };
}
var optionalText = z2.string().trim().max(2e3).optional();
var dateText = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var quotePaymentScheduleSchema = z2.object({
  depositPercent: z2.number().int().min(1).max(99).optional(),
  depositDueDate: dateText.optional(),
  balanceDueDate: dateText.optional()
}).superRefine((input, context) => {
  const errors = validateQuotePaymentSchedule(input);
  for (const [field, message] of Object.entries(errors)) context.addIssue({ code: z2.ZodIssueCode.custom, path: [field], message });
});
var quoteDiscountSchema = z2.object({ discountPercent: z2.number().int().min(0).max(99).optional() });
var documentLineSchema = z2.object({
  description: z2.string().trim().min(2).max(1e3),
  quantity: z2.number().positive().max(999999),
  unit: z2.string().trim().min(1).max(30),
  unitPrice: z2.number().int().min(0).max(9e9),
  taxRate: z2.number().int().min(0).max(100),
  serviceId: z2.number().int().positive().optional()
});
var identityKindSchema = z2.enum(IDENTITY_KINDS);
var clientInputSchema = z2.object({
  companyName: z2.string().trim().min(2).max(180),
  contactName: optionalText,
  email: z2.string().email().optional().or(z2.literal("")),
  phone: z2.string().trim().max(64).optional(),
  address: optionalText,
  identityKind: identityKindSchema.optional(),
  taxId: z2.string().trim().max(100).optional(),
  registrationNumber: z2.string().trim().max(100).optional(),
  notes: optionalText,
  defaultDiscountPercent: z2.number().int().min(0).max(99).optional()
});
var companySettingsInputSchema = z2.object({
  legalName: z2.string().trim().min(2).max(180),
  legalAddress: optionalText,
  phone: z2.string().trim().max(64).optional(),
  email: z2.string().email().optional().or(z2.literal("")),
  website: z2.string().trim().max(255).optional(),
  identityKind: identityKindSchema.optional(),
  taxId: z2.string().trim().max(100).optional(),
  registrationNumber: z2.string().trim().max(100).optional(),
  bankName: z2.string().trim().max(180).optional(),
  accountName: z2.string().trim().max(180).optional(),
  accountNumber: z2.string().trim().max(120).optional(),
  iban: z2.string().trim().max(120).optional(),
  swift: z2.string().trim().max(32).optional(),
  paymentInstructions: optionalText,
  documentFooter: optionalText
}).superRefine((input, context) => {
  const errors = validateCompanyFinancialDetails(input);
  for (const [field, message] of Object.entries(errors)) context.addIssue({ code: z2.ZodIssueCode.custom, path: [field], message });
});
var extractedClientSchema = z2.object({
  companyName: z2.string().trim().min(2).max(180),
  contactName: z2.string().trim().max(180).optional().default(""),
  email: z2.string().trim().max(320).optional().default(""),
  phone: z2.string().trim().max(64).optional().default(""),
  address: z2.string().trim().max(2e3).optional().default(""),
  taxId: z2.string().trim().max(100).optional().default(""),
  registrationNumber: z2.string().trim().max(100).optional().default(""),
  identityKind: identityKindSchema.optional().default("immatriculee"),
  notes: z2.string().trim().max(2e3).optional().default(""),
  missingFields: z2.array(z2.string().trim().max(100)).max(8).optional().default([])
});
var clientExtractionResponseSchema = {
  name: "lucepress_client_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      companyName: { type: "string" },
      contactName: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      address: { type: "string" },
      taxId: { type: "string" },
      notes: { type: "string" },
      missingFields: { type: "array", items: { type: "string" } }
    },
    required: ["companyName", "contactName", "email", "phone", "address", "taxId", "notes", "missingFields"],
    additionalProperties: false
  }
};
var reminderResponseSchema = {
  name: "lucepress_overdue_reminder",
  strict: true,
  schema: {
    type: "object",
    properties: {
      subject: { type: "string" },
      greeting: { type: "string" },
      body: { type: "string" },
      closing: { type: "string" },
      tone: { type: "string" }
    },
    required: ["subject", "greeting", "body", "closing", "tone"],
    additionalProperties: false
  }
};
var batchReminderResponseSchema = {
  name: "lucepress_batch_overdue_reminders",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reminders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            subject: { type: "string" },
            greeting: { type: "string" },
            body: { type: "string" },
            closing: { type: "string" },
            tone: { type: "string" }
          },
          required: ["documentId", "subject", "greeting", "body", "closing", "tone"],
          additionalProperties: false
        }
      }
    },
    required: ["reminders"],
    additionalProperties: false
  }
};
var agentCopilotResponseSchema = {
  name: "lucepress_margin_collection_copilot",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      marginAlerts: { type: "array", items: { type: "string" } },
      collectionPriorities: { type: "array", items: { type: "string" } },
      suggestedActions: { type: "array", items: { type: "string" } },
      dataToVerify: { type: "array", items: { type: "string" } },
      sourceReferences: { type: "array", items: { type: "string" } }
    },
    required: ["summary", "marginAlerts", "collectionPriorities", "suggestedActions", "dataToVerify", "sourceReferences"],
    additionalProperties: false
  }
};
var agentOperatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const access = await getAgentOperatorAccess(ctx.user.id, ctx.user.role);
  if (!access) throw new TRPCError4({ code: "FORBIDDEN", message: "Votre compte ne poss\xE8de pas d\u2019habilitation active pour administrer l\u2019agent." });
  return next({ ctx: { ...ctx, agentAccess: access } });
});
function requireAgentApproval(access) {
  if (!access.canApprove) throw new TRPCError4({ code: "FORBIDDEN", message: "Votre habilitation ne permet pas d\u2019approuver cette action de l\u2019agent." });
}
function requireAgentActivation(access) {
  if (!access.canActivate) throw new TRPCError4({ code: "FORBIDDEN", message: "Votre habilitation ne permet pas d\u2019activer cette simulation." });
}
function agentMutationError(error, fallback) {
  return new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : fallback });
}
function readSessionToken(cookieHeader) {
  return parseCookieHeader(cookieHeader ?? "")[COOKIE_NAME] ?? "";
}
var clientHistorySummarySchema = {
  name: "lucepress_client_history_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      attentionPoints: { type: "array", items: { type: "string" } },
      nextSteps: { type: "array", items: { type: "string" } }
    },
    required: ["summary", "attentionPoints", "nextSteps"],
    additionalProperties: false
  }
};
var proposalSchema = {
  name: "lucepress_quote_proposal",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      projectName: { type: "string" },
      summary: { type: "string" },
      scope: { type: "array", items: { type: "string" } },
      executionTimeline: { type: "string" },
      paymentTerms: { type: "string" },
      validityDays: { type: "integer" },
      technicalNotes: { type: "array", items: { type: "string" } },
      assumptions: { type: "array", items: { type: "string" } },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            unitPrice: { type: "integer" },
            taxRate: { type: "integer" },
            note: { type: "string" }
          },
          required: ["description", "quantity", "unit", "unitPrice", "taxRate", "note"],
          additionalProperties: false
        }
      }
    },
    required: ["title", "projectName", "summary", "scope", "executionTimeline", "paymentTerms", "validityDays", "technicalNotes", "assumptions", "lines"],
    additionalProperties: false
  }
};
var appRouter = router({
  system: systemRouter,
  guest: router({
    getDocument: publicProcedure.input(z2.object({ token: z2.string().trim().min(32).max(128) })).query(async ({ ctx, input }) => {
      const { resolveClientIp: resolveClientIp2 } = await Promise.resolve().then(() => (init_clientIp(), clientIp_exports));
      const verdict = assertGuestShareRateLimit(resolveClientIp2(ctx.req));
      if (!verdict.allowed) {
        throw new TRPCError4({
          code: "TOO_MANY_REQUESTS",
          message: `Trop de tentatives. R\xE9essayez dans ${verdict.retryAfterSeconds} seconde(s).`
        });
      }
      try {
        return await getGuestDocumentByShareToken(input.token);
      } catch (error) {
        throw new TRPCError4({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : GUEST_DOCUMENT_INVALID_MESSAGE
        });
      }
    }),
    respondToQuote: publicProcedure.input(z2.object({
      token: z2.string().trim().min(32).max(128),
      decision: z2.enum(["accepte", "refuse"])
    })).mutation(async ({ ctx, input }) => {
      const { resolveClientIp: resolveClientIp2 } = await Promise.resolve().then(() => (init_clientIp(), clientIp_exports));
      const verdict = assertGuestShareRateLimit(resolveClientIp2(ctx.req));
      if (!verdict.allowed) {
        throw new TRPCError4({
          code: "TOO_MANY_REQUESTS",
          message: `Trop de tentatives. R\xE9essayez dans ${verdict.retryAfterSeconds} seconde(s).`
        });
      }
      try {
        return await respondToGuestQuoteByShareToken(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : GUEST_DOCUMENT_INVALID_MESSAGE;
        throw new TRPCError4({
          code: message.includes("expire") || message.includes("attente") ? "BAD_REQUEST" : "NOT_FOUND",
          message
        });
      }
    })
  }),
  auth: router({
    register: publicProcedure.input(z2.object({
      email: z2.string().email().max(320),
      password: z2.string().min(8).max(128),
      name: z2.string().trim().min(2).max(180).optional()
    })).mutation(async ({ ctx, input }) => {
      const { registerRateLimiter: registerRateLimiter2 } = await Promise.resolve().then(() => (init_loginRateLimit(), loginRateLimit_exports));
      const { resolveClientIp: resolveClientIp2 } = await Promise.resolve().then(() => (init_clientIp(), clientIp_exports));
      const ip = resolveClientIp2(ctx.req);
      const verdict = registerRateLimiter2.check({ email: input.email, ip });
      if (!verdict.allowed) {
        throw new TRPCError4({
          code: "TOO_MANY_REQUESTS",
          message: `Trop de tentatives d'inscription. R\xE9essayez dans ${verdict.retryAfterSeconds} seconde(s).`
        });
      }
      const existingCount = await countUsersWithPassword();
      if (existingCount > 0) {
        registerRateLimiter2.recordFailure({ email: input.email, ip });
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "L'inscription libre est ferm\xE9e. Demandez \xE0 un administrateur de cr\xE9er votre compte."
        });
      }
      const existing = await getUserByEmail(input.email);
      if (existing) {
        registerRateLimiter2.recordFailure({ email: input.email, ip });
        throw new TRPCError4({ code: "CONFLICT", message: "Un compte existe d\xE9j\xE0 avec cet e-mail." });
      }
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const passwordHash = await hashPassword2(input.password);
      const user2 = await createLocalUser({
        email: input.email,
        passwordHash,
        name: input.name ?? null,
        // Premier compte de l'instance : il doit être administrateur pour
        // pouvoir ensuite gérer les autres.
        role: "admin"
      });
      registerRateLimiter2.recordSuccess({ email: input.email });
      return { success: true, openId: user2.openId };
    }),
    login: publicProcedure.input(z2.object({
      email: z2.string().email().max(320),
      password: z2.string().min(1).max(128)
    })).mutation(async ({ ctx, input }) => {
      const { loginRateLimiter: loginRateLimiter2 } = await Promise.resolve().then(() => (init_loginRateLimit(), loginRateLimit_exports));
      const { resolveClientIp: resolveClientIp2 } = await Promise.resolve().then(() => (init_clientIp(), clientIp_exports));
      const ip = resolveClientIp2(ctx.req);
      const verdict = loginRateLimiter2.check({ email: input.email, ip });
      if (!verdict.allowed) {
        throw new TRPCError4({
          code: "TOO_MANY_REQUESTS",
          message: `Trop de tentatives de connexion. R\xE9essayez dans ${verdict.retryAfterSeconds} seconde(s).`
        });
      }
      const user2 = await getUserByEmail(input.email);
      if (!user2 || !user2.passwordHash) {
        loginRateLimiter2.recordFailure({ email: input.email, ip });
        throw new TRPCError4({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });
      }
      const { verifyPassword: verifyPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const ok = await verifyPassword2(input.password, user2.passwordHash);
      if (!ok) {
        loginRateLimiter2.recordFailure({ email: input.email, ip });
        throw new TRPCError4({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });
      }
      loginRateLimiter2.recordSuccess({ email: input.email });
      await upsertUser({ openId: user2.openId, lastSignedIn: /* @__PURE__ */ new Date() });
      const { signLocalSession: signLocalSession2 } = await Promise.resolve().then(() => (init_localAuth(), localAuth_exports));
      const token = await signLocalSession2({
        openId: user2.openId,
        email: user2.email ?? "",
        name: user2.name ?? "",
        tenantId: user2.tenantId ?? 1
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1e3 });
      return { success: true };
    }),
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { passwordHash: _passwordHash, ...safeUser } = ctx.user;
      return safeUser;
    }),
    /**
     * Changement de mot de passe par l'utilisateur connecté.
     *
     * Procédure PROTÉGÉE : on impose de connaître l'ancien mot de passe. Cela
     * empêche qu'un attaquant ayant momentanément accès à la session (cookie
     * volé non encore expiré) ne la verrouille pas en silence. Le nouveau mot de
     * passe doit être suffisamment robuste.
     */
    changePassword: protectedProcedure.input(z2.object({
      currentPassword: z2.string().min(1).max(128),
      newPassword: z2.string().min(8).max(128)
    })).mutation(async ({ ctx, input }) => {
      const user2 = ctx.user;
      if (!user2) {
        throw new TRPCError4({ code: "UNAUTHORIZED", message: "Session introuvable." });
      }
      const db_user = await getUserByOpenId(user2.openId);
      if (!db_user || !db_user.passwordHash) {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Ce compte n'utilise pas l'authentification par mot de passe."
        });
      }
      const { verifyPassword: verifyPassword2, hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const ok = await verifyPassword2(input.currentPassword, db_user.passwordHash);
      if (!ok) {
        throw new TRPCError4({ code: "UNAUTHORIZED", message: "Mot de passe actuel incorrect." });
      }
      if (input.currentPassword === input.newPassword) {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Le nouveau mot de passe doit \xEAtre diff\xE9rent de l'actuel."
        });
      }
      const passwordHash = await hashPassword2(input.newPassword);
      await setUserPasswordHash(db_user.id, passwordHash);
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
      return { success: true, redirectTo: "/login" };
    }),
    /**
     * Demande de réinitialisation du mot de passe (flux "Mot de passe oublié").
     * Toujours retourner {success: true} pour éviter de révéler si l'email existe.
     */
    forgotPassword: publicProcedure.input(z2.object({ email: z2.string().email().max(320) })).mutation(async ({ ctx, input }) => {
      const user2 = await getUserByEmail(input.email);
      if (!user2) {
        return { success: true };
      }
      if (!user2.passwordHash) {
        return { success: true };
      }
      const crypto2 = await import("node:crypto");
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const token = crypto2.randomBytes(32).toString("hex");
      const tokenHash = await hashPassword2(token);
      await createPasswordReset({
        userId: user2.id,
        tokenHash,
        tenantId: user2.tenantId ?? void 0
      });
      const origin = getRequestOrigin(ctx.req);
      const resetLink = `${origin}/reset-password?token=${token}`;
      const rendered = await renderEmailTemplate2("password-reset", { resetLink });
      await sendMail({
        to: input.email,
        subject: rendered?.subject ?? "R\xE9initialisation de votre mot de passe Lucepress",
        html: rendered?.html ?? "",
        text: rendered?.text ?? `R\xE9initialisation de votre mot de passe Lucepress

Cliquez sur ce lien pour cr\xE9er un nouveau mot de passe : ${resetLink}

Ce lien expirera dans 1 heure.

Si vous n'avez pas demand\xE9 cette r\xE9initialisation, ignorez cet e-mail.`
      }).catch(() => {
        console.warn(`[auth] \xC9chec envoi email reset \xE0 ${input.email}`);
      });
      return { success: true };
    }),
    /**
     * Réinitialisation effective : vérifie le token et définit un nouveau mot de passe.
     * Publique (l'utilisateur n'est pas connecté). Le token est à usage unique.
     */
    resetPassword: publicProcedure.input(z2.object({
      token: z2.string().min(8).max(128),
      newPassword: z2.string().min(8).max(128)
    })).mutation(async ({ input }) => {
      const reset = await findPasswordResetByToken(input.token);
      if (!reset) {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Ce lien de r\xE9initialisation est invalide ou a expir\xE9. Demandez un nouveau lien."
        });
      }
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const passwordHash = await hashPassword2(input.newPassword);
      await resetUserPassword(reset.userId, passwordHash);
      await markPasswordResetUsed(reset.id);
      return { success: true };
    })
  }),
  /**
   * Gestion des collaborateurs (réservée aux administrateurs).
   * Dans l'architecture mono-tenant actuelle, un « collaborateur » est un compte
   * `users` avec un rôle `admin`, `directeur` ou `cadre`. Les procédures ci-dessous permettent à un admin
   * de lister, créer, promouvoir/rétrograder, réinitialiser le mot de passe et
   * révoquer ces comptes — sans jamais exposer le hash des mots de passe.
   */
  users: router({
    list: adminProcedure.query(() => listUsers()),
    create: adminProcedure.input(z2.object({
      email: z2.string().email().max(320),
      name: z2.string().trim().min(2).max(180).optional(),
      password: z2.string().min(8).max(128),
      role: z2.enum(APP_ROLES).default("cadre")
    })).mutation(async ({ input }) => {
      if (input.role === "client") {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Les acc\xE8s portail client s\u2019invitent depuis la fiche client."
        });
      }
      const existant = await getUserByEmail(input.email);
      if (existant) {
        throw new TRPCError4({ code: "CONFLICT", message: "Un compte existe d\xE9j\xE0 avec cet e-mail." });
      }
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const passwordHash = await hashPassword2(input.password);
      const user2 = await createLocalUser({
        email: input.email,
        passwordHash,
        name: input.name ?? null,
        role: input.role
      });
      return { success: true, openId: user2.openId, id: user2.id };
    }),
    setRole: adminProcedure.input(z2.object({ userId: z2.number().int().positive(), role: z2.enum(STAFF_ROLES) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId && input.role !== "admin") {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Vous ne pouvez pas retirer votre propre r\xF4le d'administrateur."
        });
      }
      await setUserRole(input.userId, input.role);
      return { success: true };
    }),
    resetPassword: adminProcedure.input(z2.object({ userId: z2.number().int().positive(), newPassword: z2.string().min(8).max(128) })).mutation(async ({ input }) => {
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const passwordHash = await hashPassword2(input.newPassword);
      await resetUserPassword(input.userId, passwordHash);
      return { success: true };
    }),
    remove: adminProcedure.input(z2.object({ userId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId) {
        throw new TRPCError4({ code: "BAD_REQUEST", message: "Vous ne pouvez pas supprimer votre propre compte." });
      }
      const result = await deleteUser(input.userId);
      if (!result.deleted) {
        const msg = result.reason === "dernier_admin" ? "Impossible de supprimer le dernier administrateur de l'instance." : result.reason === "compte_introuvable" ? "Compte introuvable." : "Suppression impossible.";
        throw new TRPCError4({ code: "BAD_REQUEST", message: msg });
      }
      return { success: true };
    }),
    /**
     * Invitation par e-mail : génère un token sécurisé (jamais stocké en clair),
     * renvoie le lien complet à l'admin qui le transmet lui-même à l'invité.
     * L'admin ne saisit PAS le mot de passe du collaborateur — l'invité le définit
     * à l'acceptation (procédure `acceptInvitation`, publique).
     */
    invite: adminProcedure.input(z2.object({
      email: z2.string().email().max(320),
      name: z2.string().trim().min(2).max(180).optional(),
      role: z2.enum(APP_ROLES).default("cadre")
    })).mutation(async ({ ctx, input }) => {
      if (input.role === "client") {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Les acc\xE8s portail client s\u2019invitent depuis la fiche client, pas depuis les comptes internes."
        });
      }
      return issueInvitation({
        email: input.email,
        role: input.role,
        invitedById: ctx.user.id,
        invitedByName: ctx.user.name,
        tenantId: ctx.tenantId,
        req: ctx.req
      });
    }),
    listInvitations: adminProcedure.query(() => listInvitations()),
    resendInvitation: adminProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!isMailConfigured()) {
        throw new TRPCError4({
          code: "PRECONDITION_FAILED",
          message: "SMTP non configur\xE9. Impossible de renvoyer l\u2019invitation par e-mail."
        });
      }
      const rotated = await rotateInvitationToken(input.id);
      if (!rotated) {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Invitation introuvable, d\xE9j\xE0 utilis\xE9e, r\xE9voqu\xE9e ou expir\xE9e."
        });
      }
      const origin = getRequestOrigin(ctx.req);
      const inviteLink = `${origin}/invitation?token=${rotated.token}`;
      try {
        const rendered = await renderEmailTemplate2("invitation", {
          inviterName: ctx.user.name ?? "Lucepres",
          inviteLink,
          organization: LUCEPRES_PUBLIC_PROFILE.legalName,
          expiresAt: rotated.expiresAt.toLocaleString("fr-FR")
        });
        await sendMail({
          to: rotated.email,
          bcc: (() => {
            const smtpUser = getSmtpUser();
            if (!smtpUser) return void 0;
            if (smtpUser.toLowerCase() === rotated.email.trim().toLowerCase()) return void 0;
            return smtpUser;
          })(),
          subject: rendered?.subject ?? `Invitation \xE0 rejoindre ${LUCEPRES_PUBLIC_PROFILE.legalName}`,
          html: rendered?.html ?? "",
          text: rendered?.text ?? `Invitation Lucepress : ${inviteLink}`
        });
      } catch (error) {
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "\xC9chec d\u2019envoi de l\u2019e-mail d\u2019invitation."
        });
      }
      return {
        success: true,
        emailed: true,
        email: rotated.email,
        invitationLink: inviteLink
      };
    }),
    revokeInvitation: adminProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await revokeInvitation(input.id);
      return { success: true };
    }),
    deleteInvitation: adminProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await deleteInvitation(input.id);
      return { success: true };
    })
  }),
  /**
   * Aperçu public d’un lien d’invitation (sans créer le compte).
   * Permet d’afficher immédiatement si le lien est périmé / déjà utilisé.
   */
  previewInvitation: publicProcedure.input(z2.object({ token: z2.string().min(8).max(128) })).query(async ({ input }) => {
    const result = await findInvitationByToken(input.token);
    if (result.reason !== "pending" || !result.invitation) {
      return {
        valid: false,
        reason: result.reason
      };
    }
    const email = result.invitation.email;
    const at = email.indexOf("@");
    const emailHint = at > 1 ? `${email[0]}***${email.slice(at)}` : "***";
    return {
      valid: true,
      reason: "pending",
      emailHint,
      role: result.invitation.role,
      expiresAt: result.invitation.expiresAt
    };
  }),
  /**
   * Acceptation d'une invitation (publique : l'invité n'est pas encore connecté).
   * Le collaborateur définit son nom + mot de passe ; le compte est créé à ce
   * moment-là. Le token est vérifié (empreinte SHA-256) et à usage unique.
   */
  acceptInvitation: publicProcedure.input(z2.object({
    token: z2.string().min(8).max(128),
    name: z2.string().trim().min(2).max(180),
    password: z2.string().min(8).max(128)
  })).mutation(async ({ input }) => {
    const __dbg = (hypothesisId, location, message, data) => {
      const payload = { sessionId: "9c0039", runId: "pre-fix", hypothesisId, location, message, data, timestamp: Date.now() };
      console.log("DEBUG_ACCEPT_9c0039", JSON.stringify(payload));
      fetch("http://127.0.0.1:7581/ingest/cbc96c89-ed00-4715-9c49-6a3427fcaddd", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9c0039" }, body: JSON.stringify(payload) }).catch(() => {
      });
    };
    __dbg("A", "routers.ts:acceptInvitation:entry", "acceptInvitation called", { tokenLen: input.token?.length ?? 0, tokenPrefix: String(input.token || "").slice(0, 8), nameLen: input.name?.trim()?.length ?? 0, passwordLen: input.password?.length ?? 0 });
    const result = await findInvitationByToken(input.token);
    __dbg("A", "routers.ts:acceptInvitation:lookup", "findInvitationByToken result", { reason: result.reason, inviteId: result.invitation?.id ?? null, inviteStatus: result.invitation?.status ?? null, inviteEmailDomain: result.invitation?.email?.split("@")[1] ?? null, tenantId: result.invitation?.tenantId ?? null, role: result.invitation?.role ?? null });
    if (result.reason === "not_found") {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Ce lien d\u2019invitation n\u2019est plus valide (d\xE9j\xE0 renvoy\xE9, r\xE9voqu\xE9 ou incorrect). Demandez un nouvel envoi \xE0 un administrateur, puis utilisez uniquement le dernier lien." });
    }
    if (result.reason === "already_accepted") {
      throw new TRPCError4({ code: "CONFLICT", message: "Cette invitation a d\xE9j\xE0 \xE9t\xE9 utilis\xE9e. Demandez une nouvelle invitation." });
    }
    if (result.reason === "revoked") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "Cette invitation a \xE9t\xE9 r\xE9voqu\xE9e par un administrateur." });
    }
    if (result.reason === "expired") {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Cette invitation a expir\xE9. Demandez une nouvelle invitation." });
    }
    const cible = result.invitation;
    const existant = await getUserByEmail(cible.email);
    __dbg("B", "routers.ts:acceptInvitation:emailCheck", "existing user check", { exists: Boolean(existant), existingUserId: existant?.id ?? null });
    if (existant) {
      try {
        const { runWithTenant: runWithTenant2 } = await Promise.resolve().then(() => (init_tenantContext(), tenantContext_exports));
        await runWithTenant2(cible.tenantId, () => revokeInvitation(cible.id));
      } catch {
      }
      throw new TRPCError4({ code: "CONFLICT", message: "Un compte existe d\xE9j\xE0 avec cet e-mail." });
    }
    try {
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
      const passwordHash = await hashPassword2(input.password);
      const user2 = await createLocalUser({
        email: cible.email,
        passwordHash,
        name: input.name,
        role: cible.role,
        tenantId: cible.tenantId
      });
      await markInvitationAccepted(cible.tokenHash, user2.id);
      __dbg("C", "routers.ts:acceptInvitation:success", "account created", { userId: user2.id, role: cible.role, tenantId: cible.tenantId });
      return { success: true, openId: user2.openId, id: user2.id };
    } catch (error) {
      __dbg("C", "routers.ts:acceptInvitation:createError", "create/mark failed", { errorName: error instanceof Error ? error.name : "unknown", errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) });
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Impossible de cr\xE9er le compte."
      });
    }
  }),
  /**
   * Gestion des templates d'e-mail (admin).
   * Permet de lister, créer, mettre à jour et supprimer les templates.
   * Les templates globaux (tenantId NULL) sont visibles par tous,
   * les templates tenant-spécifiques sont prioritaires.
   */
  emailTemplates: router({
    list: adminProcedure.query(() => listEmailTemplates()),
    create: adminProcedure.input(z2.object({
      slug: z2.string().trim().min(1).max(100),
      name: z2.string().trim().min(1).max(255),
      subject: z2.string().trim().min(1).max(500),
      html: z2.string().min(1),
      text: z2.string().optional(),
      tenantId: z2.number().int().positive().nullable().optional()
    })).mutation(({ input }) => createEmailTemplate(input)),
    update: adminProcedure.input(z2.object({
      id: z2.number().int().positive(),
      name: z2.string().trim().min(1).max(255).optional(),
      subject: z2.string().trim().min(1).max(500).optional(),
      html: z2.string().min(1).optional(),
      text: z2.string().optional(),
      enabled: z2.enum(["oui", "non"]).optional()
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateEmailTemplate(id, data);
    }),
    delete: adminProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(({ input }) => deleteEmailTemplate(input.id)),
    preview: adminProcedure.input(z2.object({
      slug: z2.string(),
      variables: z2.record(z2.string(), z2.string())
    })).query(({ input }) => renderEmailTemplate2(input.slug, input.variables))
  }),
  billing: router({
    dashboard: staffProcedure.query(() => getDashboardData()),
    mailStatus: staffProcedure.query(() => ({ smtpConfigured: isMailConfigured() })),
    audit: router({
      list: directionProcedure.input(z2.object({
        type: z2.enum(CLIENT_ACTIVITY_TYPES).optional(),
        limit: z2.number().int().min(1).max(500).optional()
      }).optional()).query(({ input }) => listStaffAuditJournal(input))
    }),
    clients: router({
      list: staffProcedure.query(() => listClients()),
      duplicates: staffProcedure.input(z2.object({ companyName: z2.string().trim().min(2).max(180), email: z2.string().email().optional().or(z2.literal("")), phone: z2.string().trim().max(64).optional(), excludedId: z2.number().int().positive().optional() })).query(({ input }) => findClientDuplicates(input, input.excludedId)),
      create: staffProcedure.input(clientInputSchema).mutation(({ input }) => createClient(input)),
      update: staffProcedure.input(clientInputSchema.extend({ id: z2.number().int().positive() })).mutation(({ input }) => updateClient(input.id, input)),
      invitePortal: staffProcedure.input(z2.object({ clientId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const client = await getClientById(input.clientId);
        if (!client) throw new TRPCError4({ code: "NOT_FOUND", message: "Client introuvable." });
        const email = client.email?.trim();
        if (!email) {
          throw new TRPCError4({
            code: "BAD_REQUEST",
            message: "Renseignez l\u2019e-mail sur la fiche client avant d\u2019inviter au portail."
          });
        }
        const existant = await getUserByEmail(email);
        if (existant && isStaffRole(existant.role)) {
          throw new TRPCError4({
            code: "CONFLICT",
            message: "Cet e-mail appartient d\xE9j\xE0 \xE0 un compte interne Lucepres. Utilisez une autre adresse sur la fiche client."
          });
        }
        if (existant?.role === "client") {
          return {
            success: true,
            alreadyHasAccess: true,
            email,
            invitationLink: null,
            emailed: false,
            smtpConfigured: isMailConfigured()
          };
        }
        const issued = await issueInvitation({
          email,
          role: "client",
          invitedById: ctx.user.id,
          invitedByName: ctx.user.name,
          tenantId: ctx.tenantId,
          req: ctx.req
        });
        await createClientActivity({
          clientId: client.id,
          type: "email_envoye",
          title: "Invitation portail client",
          description: `${email}${issued.emailed ? " \u2014 e-mail envoy\xE9" : " \u2014 lien \xE0 transmettre"}`,
          createdById: ctx.user.id
        });
        return { ...issued, alreadyHasAccess: false, invitationLink: issued.invitationLink };
      }),
      attachments: router({
        list: staffProcedure.input(z2.object({ clientId: z2.number().int().positive() })).query(({ input }) => listClientAttachments(input.clientId))
      }),
      activities: router({
        list: staffProcedure.input(z2.object({ clientId: z2.number().int().positive() })).query(({ input }) => listClientActivities(input.clientId)),
        createNote: staffProcedure.input(z2.object({ clientId: z2.number().int().positive(), title: z2.string().trim().min(2).max(255).default("Note d\u2019appel"), description: z2.string().trim().min(3).max(2e3) })).mutation(({ ctx, input }) => createClientActivity({ ...input, type: "note", createdById: ctx.user.id }))
      })
    }),
    settings: router({
      get: staffProcedure.query(() => getCompanySettings()),
      save: adminProcedure.input(companySettingsInputSchema).mutation(({ input }) => saveCompanySettings(input))
    }),
    projects: router({
      list: staffProcedure.query(() => listProjects()),
      create: staffProcedure.input(z2.object({ clientId: z2.number().int().positive(), name: z2.string().trim().min(2).max(180), reference: z2.string().trim().max(80).optional(), type: z2.enum(["btp", "forage", "mixte"]), location: z2.string().trim().max(255).optional(), description: optionalText })).mutation(({ input }) => createProject(input)),
      updatePlannedBudget: staffProcedure.input(z2.object({ id: z2.number().int().positive(), plannedBudget: z2.number().int().min(0).max(9e9) })).mutation(({ input }) => updateProjectPlannedBudget(input)),
      updateFinancialTargets: staffProcedure.input(z2.object({ id: z2.number().int().positive(), plannedBudget: z2.number().int().min(0).max(9e9), minimumMarginRate: z2.number().int().min(0).max(100).nullable() })).mutation(({ input }) => updateProjectFinancialTargets(input)),
      costs: router({
        list: staffProcedure.input(z2.object({ projectId: z2.number().int().positive().optional() }).optional()).query(({ input }) => listProjectCosts(input?.projectId)),
        create: staffProcedure.input(z2.object({ projectId: z2.number().int().positive(), category: z2.enum(["materiaux", "main_oeuvre", "transport", "equipement", "sous_traitance", "autre"]), description: z2.string().trim().min(3).max(500), amount: z2.number().int().positive().max(9e9), incurredAt: dateText })).mutation(({ ctx, input }) => createProjectCost({ ...input, createdById: ctx.user.id })),
        delete: staffProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(({ input }) => deleteProjectCost(input.id)),
        attachments: router({
          list: staffProcedure.input(z2.object({ projectCostId: z2.number().int().positive() })).query(({ input }) => listProjectCostAttachments(input.projectCostId)),
          delete: staffProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(({ input }) => deleteProjectCostAttachment(input.id))
        }),
        profitability: staffProcedure.query(() => listProjectProfitability())
      })
    }),
    receivables: staffProcedure.query(() => getReceivablesDashboard()),
    workspaceSearch: staffProcedure.input(z2.object({
      query: z2.string().trim().max(80),
      filters: z2.object({
        kind: z2.enum(["client", "devis", "facture", "creance"]).optional(),
        dateFrom: z2.string().regex(/^\\d{4}-(0[1-9]|1[0-2])-([0-2]\\d|3[01])$/).optional(),
        dateTo: z2.string().regex(/^\\d{4}-(0[1-9]|1[0-2])-([0-2]\\d|3[01])$/).optional(),
        status: z2.string().trim().max(40).optional(),
        amountMin: z2.number().int().nonnegative().max(1e15).optional(),
        amountMax: z2.number().int().nonnegative().max(1e15).optional(),
        sortBy: z2.enum(["relevance", "date", "status", "amount"]).optional(),
        sortDirection: z2.enum(["asc", "desc"]).optional()
      }).optional()
    })).query(({ input }) => searchWorkspace({ query: input.query, filters: input.filters })),
    collection: router({
      assignees: staffProcedure.query(() => listCollectionAssignees()),
      updateFollowUp: staffProcedure.input(z2.object({ documentId: z2.number().int().positive(), collectionStatus: z2.enum(["a_traiter", "contacte", "a_rappeler"]).optional(), collectionReminderDate: z2.string().regex(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/, "La date de rappel doit respecter le format AAAA-MM-JJ.").nullable().optional(), collectionOwnerId: z2.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
        try {
          return await updateCollectionFollowUp({ ...input, updatedById: ctx.user.id });
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le suivi de recouvrement ne peut pas \xEAtre mis \xE0 jour." });
        }
      }),
      reassign: directionProcedure.input(z2.object({ documentIds: z2.array(z2.number().int().positive()).min(1).max(20).refine((ids) => new Set(ids).size === ids.length, "Une cr\xE9ance ne peut \xEAtre s\xE9lectionn\xE9e qu\u2019une fois."), collectionOwnerId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await reassignCollectionFollowUps({ ...input, updatedById: ctx.user.id });
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Les cr\xE9ances ne peuvent pas \xEAtre r\xE9attribu\xE9es." });
        }
      }),
      monthlyReport: directionProcedure.input(z2.object({ month: z2.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Le mois doit respecter le format AAAA-MM.") })).query(async ({ input }) => {
        try {
          return await getCollectionMonthlyReport(input.month);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le rapport mensuel est indisponible." });
        }
      })
    }),
    clientPortal: router({
      overview: protectedProcedure.query(({ ctx }) => getClientPortalOverview(ctx.user.email)),
      invoice: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).query(({ ctx, input }) => getClientPortalInvoice(ctx.user.email, input.id)),
      quote: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).query(({ ctx, input }) => getClientPortalQuote(ctx.user.email, input.id)),
      respondToQuote: protectedProcedure.input(z2.object({
        documentId: z2.number().int().positive(),
        decision: z2.enum(["accepte", "refuse"])
      })).mutation(async ({ ctx, input }) => {
        try {
          return await respondToClientPortalQuote({
            email: ctx.user.email,
            documentId: input.documentId,
            decision: input.decision,
            createdById: ctx.user.id
          });
        } catch (error) {
          throw new TRPCError4({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "La d\xE9cision sur le devis n\u2019a pas pu \xEAtre enregistr\xE9e."
          });
        }
      }),
      createPaymentPromise: protectedProcedure.input(z2.object({ documentId: z2.number().int().positive(), promisedDate: dateText, note: z2.string().trim().max(500).optional() })).mutation(({ ctx, input }) => createClientPaymentPromise({ ...input, email: ctx.user.email, createdById: ctx.user.id }))
    }),
    agent: router({
      center: agentOperatorProcedure.query(() => listAgentDelegationCenter()),
      operators: adminProcedure.query(() => listAgentOperators()),
      upsertOperatorGrant: adminProcedure.input(z2.object({ userId: z2.number().int().positive(), role: z2.enum(["directeur_general", "responsable_commercial"]), canApprove: z2.boolean().default(true), canActivate: z2.boolean().default(false), scope: z2.enum(["global", "commercial"]).default("commercial"), status: z2.enum(["active", "suspendue", "revoquee"]).default("active"), expiresAt: z2.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
        try {
          return await upsertAgentOperatorGrant({ ...input, grantedById: ctx.user.id });
        } catch (error) {
          throw agentMutationError(error, "L\u2019habilitation de l\u2019op\xE9rateur ne peut pas \xEAtre enregistr\xE9e.");
        }
      }),
      createDelegation: agentOperatorProcedure.input(z2.object({ name: z2.string().trim().min(3).max(180), purpose: z2.enum(["relance_facture", "suivi_devis"]), channel: z2.enum(["email", "whatsapp"]), tone: z2.enum(["courtois", "professionnel", "ferme", "commercial"]).default("professionnel"), startsAt: z2.coerce.date(), expiresAt: z2.coerce.date(), dailyLimit: z2.number().int().min(1).max(60).default(60), contactCooldownDays: z2.number().int().min(1).max(30).default(7) })).mutation(async ({ ctx, input }) => {
        try {
          return await createAgentDelegation({ ...input, ownerId: ctx.user.id });
        } catch (error) {
          throw agentMutationError(error, "La d\xE9l\xE9gation de l\u2019agent ne peut pas \xEAtre cr\xE9\xE9e.");
        }
      }),
      submitDelegation: agentOperatorProcedure.input(z2.object({ delegationId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        requireAgentApproval(ctx.agentAccess);
        try {
          return await submitAgentDelegationForApproval(input.delegationId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "La d\xE9l\xE9gation ne peut pas \xEAtre soumise \xE0 approbation.");
        }
      }),
      approveDelegation: agentOperatorProcedure.input(z2.object({ delegationId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        requireAgentApproval(ctx.agentAccess);
        try {
          return await approveAgentDelegation(input.delegationId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "La d\xE9l\xE9gation ne peut pas \xEAtre approuv\xE9e.");
        }
      }),
      suspendDelegation: agentOperatorProcedure.input(z2.object({ delegationId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await suspendAgentDelegation(input.delegationId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "La d\xE9l\xE9gation ne peut pas \xEAtre suspendue.");
        }
      }),
      simulateCampaign: agentOperatorProcedure.input(z2.object({ delegationId: z2.number().int().positive(), name: z2.string().trim().min(3).max(180), scheduledFor: z2.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
        try {
          return await createAgentCampaignSimulation({ ...input, preparedById: ctx.user.id });
        } catch (error) {
          throw agentMutationError(error, "La campagne ne peut pas \xEAtre simul\xE9e.");
        }
      }),
      submitCampaign: agentOperatorProcedure.input(z2.object({ campaignId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        requireAgentApproval(ctx.agentAccess);
        try {
          return await submitAgentCampaignForApproval(input.campaignId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "La campagne ne peut pas \xEAtre soumise \xE0 approbation.");
        }
      }),
      approveCampaign: agentOperatorProcedure.input(z2.object({ campaignId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        requireAgentApproval(ctx.agentAccess);
        try {
          return await approveAgentCampaign(input.campaignId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "La campagne ne peut pas \xEAtre approuv\xE9e.");
        }
      }),
      activateCampaignSimulation: agentOperatorProcedure.input(z2.object({ campaignId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        requireAgentActivation(ctx.agentAccess);
        try {
          return await activateAgentCampaignSimulation(input.campaignId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "La campagne simul\xE9e ne peut pas \xEAtre activ\xE9e.");
        }
      }),
      suspendCampaign: agentOperatorProcedure.input(z2.object({ campaignId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await suspendAgentCampaign(input.campaignId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "La campagne ne peut pas \xEAtre suspendue.");
        }
      }),
      scheduleCampaign: agentOperatorProcedure.input(z2.object({ campaignId: z2.number().int().positive(), frequency: z2.enum(["daily", "weekly"]), time: z2.string().regex(/^\d{2}:\d{2}$/), weekday: z2.number().int().min(0).max(6).optional() })).mutation(async ({ ctx, input }) => {
        requireAgentActivation(ctx.agentAccess);
        try {
          if (process.env.NODE_ENV !== "production") throw new Error("La programmation durable sera disponible apr\xE8s la publication de cette version.");
          await assertAgentCampaignCanBeScheduled(input.campaignId);
          const schedule = buildCampaignSchedule(input);
          const job = await createHeartbeatJob({ name: `agent-test-email-${input.campaignId}`, cron: schedule.cron, path: "/api/scheduled/agent-test-email", payload: { campaignId: input.campaignId }, description: `Simulation e-mail Lucepress : campagne ${input.campaignId}` }, readSessionToken(ctx.req.headers.cookie));
          return await setAgentCampaignSchedule({ campaignId: input.campaignId, scheduleCronTaskUid: job.taskUid, scheduleCronExpression: schedule.cron, nextExecutionAt: job.nextExecutionAt ? new Date(job.nextExecutionAt) : null, actorId: ctx.user.id });
        } catch (error) {
          throw agentMutationError(error, "La programmation de la campagne ne peut pas \xEAtre enregistr\xE9e.");
        }
      }),
      runTestEmailNow: agentOperatorProcedure.input(z2.object({ campaignId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        requireAgentActivation(ctx.agentAccess);
        try {
          return await deliverAgentCampaignToTestInboxNow(input.campaignId, ctx.user.id);
        } catch (error) {
          throw agentMutationError(error, "Le test e-mail interne ne peut pas \xEAtre ex\xE9cut\xE9.");
        }
      }),
      copilotBriefing: agentOperatorProcedure.mutation(async () => {
        const context = await getAgentCopilotContext();
        const models = await listLLMModels();
        const model = models.data.find((entry) => entry.id === "nvidia/nemotron-3-ultra-550b-a55b")?.id ?? models.data.find((entry) => entry.id === "mistralai/mistral-nemotron")?.id ?? models.data[0]?.id;
        if (!model) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Aucun mod\xE8le IA n'est actuellement disponible." });
        const result = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "Tu es le Copilote de marge et recouvrement de Lucepress, entreprise guineenne de BTP, forage et services durables. Analyse seulement les faits du contexte JSON fourni. Redige en francais une aide interne claire, breve et structuree. Ne fabrique aucun montant, client, echeance, statut, promesse, regle ou action realisee. Les chiffres restent des references a verifier dans l'application. Priorise les promesses echues, les retards, puis les marges realisees sous seuil. Propose uniquement des controles ou des brouillons de relance a faire approuver. Ne pretends jamais qu'un message a ete envoye, qu'un paiement a ete recu ou qu'une modification a ete appliquee. Signale explicitement les donnees insuffisantes." },
            { role: "user", content: JSON.stringify(context) }
          ],
          response_format: { type: "json_schema", json_schema: agentCopilotResponseSchema }
        });
        const content = result.choices[0]?.message.content;
        if (typeof content !== "string") throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Le briefing IA est indisponible. Reessayez dans un instant." });
        try {
          return { briefing: JSON.parse(content), requiresReview: true, model };
        } catch {
          throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Le briefing IA ne peut pas etre lu. Reessayez dans un instant." });
        }
      })
    }),
    integrations: router({
      list: adminProcedure.query(() => listIntegrations()),
      audit: adminProcedure.query(() => listIntegrationAuditLogs()),
      runtimeReadiness: adminProcedure.query(() => getIntegrationRuntimeReadiness()),
      operationsDashboard: adminProcedure.query(() => getIntegrationOperationsDashboard()),
      googleOauthSessions: adminProcedure.query(() => listGoogleWorkspaceOauthSessions()),
      prepareConnection: adminProcedure.input(z2.object({ providerSlug: z2.string().trim().min(2).max(80) })).mutation(async ({ ctx, input }) => {
        try {
          return await prepareIntegrationConnection(input.providerSlug, ctx.user.id);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La pr\xE9paration de la connexion est impossible." });
        }
      }),
      startGoogleOauth: adminProcedure.input(z2.object({ clientId: z2.string().trim().min(10).max(255), redirectUri: z2.string().url().max(512), scopes: z2.array(z2.string().trim().max(200)).min(1).max(3) })).mutation(async ({ ctx, input }) => {
        try {
          return await startGoogleWorkspaceOAuth({ ...input, userId: ctx.user.id });
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le parcours OAuth Google ne peut pas d\xE9marrer." });
        }
      }),
      pendingApprovals: adminProcedure.query(() => listPendingIntegrationApprovals()),
      decideApproval: adminProcedure.input(z2.object({ jobId: z2.number().int().positive(), decision: z2.enum(["approve", "reject"]), note: z2.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
        try {
          return await decideIntegrationApproval({ ...input, userId: ctx.user.id });
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La d\xE9cision d\u2019approbation est impossible." });
        }
      }),
      disableConnection: adminProcedure.input(z2.object({ connectionId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await disableIntegrationConnection(input.connectionId, ctx.user.id);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La d\xE9sactivation de la connexion est impossible." });
        }
      })
    }),
    services: router({
      list: staffProcedure.query(() => listServices()),
      create: staffProcedure.input(z2.object({ code: z2.string().trim().min(2).max(50), name: z2.string().trim().min(2).max(180), category: z2.enum(SERVICE_CATEGORIES), description: optionalText, unit: z2.string().trim().min(1).max(30), defaultUnitPrice: z2.number().int().min(0).max(9e9), defaultTaxRate: z2.number().int().min(0).max(100) })).mutation(({ input }) => createService(input)),
      updateTariff: staffProcedure.input(z2.object({ id: z2.number().int().positive(), defaultUnitPrice: z2.number().int().min(0).max(9e9), defaultTaxRate: z2.number().int().min(0).max(100) })).mutation(({ ctx, input }) => updateServiceTariff({ ...input, changedById: ctx.user.id })),
      priceHistory: staffProcedure.input(z2.object({ serviceId: z2.number().int().positive() })).query(({ input }) => listServicePriceRevisions(input.serviceId)),
      priceHistoryExport: staffProcedure.query(() => listAllServicePriceRevisions())
    }),
    documents: router({
      list: staffProcedure.input(z2.object({ kind: z2.enum(["devis", "facture"]).optional() }).optional()).query(({ input }) => listDocuments(input?.kind)),
      get: staffProcedure.input(z2.object({ id: z2.number().int().positive() })).query(({ input }) => getDocumentById(input.id)),
      create: staffProcedure.input(z2.object({ kind: z2.enum(["devis", "facture"]), clientId: z2.number().int().positive(), projectId: z2.number().int().positive().optional(), relatedDocumentId: z2.number().int().positive().optional(), status: z2.enum(DOCUMENT_STATUSES).optional(), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, isAiDraft: z2.boolean().optional(), lines: z2.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema).and(quoteDiscountSchema)).mutation(({ ctx, input }) => createDocument({ ...input, createdById: ctx.user.id, lines: input.lines })),
      update: staffProcedure.input(z2.object({ id: z2.number().int().positive(), clientId: z2.number().int().positive(), projectId: z2.number().int().positive().optional(), status: z2.enum(DOCUMENT_STATUSES), issueDate: dateText, dueDate: dateText.optional(), validUntil: dateText.optional(), notes: optionalText, expectedUpdatedAt: z2.string().min(10).max(40).optional(), lines: z2.array(documentLineSchema).min(1).max(100) }).and(quotePaymentScheduleSchema).and(quoteDiscountSchema)).mutation(async ({ ctx, input }) => {
        try {
          return await updateDocument({ ...input, updatedById: ctx.user.id, lines: input.lines });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Le document n\u2019a pas pu \xEAtre enregistr\xE9.";
          throw new TRPCError4({ code: message.includes("modifi\xE9 ailleurs") ? "CONFLICT" : "BAD_REQUEST", message });
        }
      }),
      updateStatus: staffProcedure.input(z2.object({ id: z2.number().int().positive(), status: z2.enum(DOCUMENT_STATUSES) })).mutation(async ({ ctx, input }) => {
        try {
          return await updateDocumentStatus(input.id, input.status, ctx.user.id);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le statut n\u2019a pas pu \xEAtre mis \xE0 jour." });
        }
      }),
      createDepositInvoice: staffProcedure.input(z2.object({ quoteId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await createDepositInvoiceFromQuote(input.quoteId, ctx.user.id);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture d\u2019acompte ne peut pas \xEAtre g\xE9n\xE9r\xE9e." });
        }
      }),
      createBalanceInvoice: staffProcedure.input(z2.object({ depositInvoiceId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await createBalanceInvoiceFromDeposit(input.depositInvoiceId, ctx.user.id);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture de solde ne peut pas \xEAtre g\xE9n\xE9r\xE9e." });
        }
      }),
      createInvoiceFromQuote: staffProcedure.input(z2.object({ quoteId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await createInvoiceFromQuote(input.quoteId, ctx.user.id);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La facture ne peut pas \xEAtre g\xE9n\xE9r\xE9e depuis ce devis." });
        }
      }),
      /**
       * Envoie le devis/facture au client par SMTP (templates quote-sent / invoice-sent).
       * Passe le statut à « envoye » si l’envoi réussit.
       */
      sendByEmail: staffProcedure.input(z2.object({
        id: z2.number().int().positive(),
        to: z2.string().email().max(320).optional(),
        attachPdf: z2.boolean().optional()
      })).mutation(async ({ ctx, input }) => {
        if (!isMailConfigured()) {
          throw new TRPCError4({
            code: "PRECONDITION_FAILED",
            message: "SMTP non configur\xE9. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS."
          });
        }
        const document = await getDocumentById(input.id);
        if (!document) {
          throw new TRPCError4({ code: "NOT_FOUND", message: "Document introuvable." });
        }
        const to = (input.to ?? document.clientEmail ?? "").trim();
        if (!to) {
          throw new TRPCError4({
            code: "BAD_REQUEST",
            message: "Aucune adresse e-mail client. Renseignez l\u2019e-mail sur la fiche client ou indiquez un destinataire."
          });
        }
        const company = await getCompanySettings();
        const origin = getRequestOrigin(ctx.req);
        const share = await issueDocumentShareLink({
          documentId: document.id,
          recipientEmail: to,
          createdById: ctx.user.id,
          validUntil: document.validUntil,
          dueDate: document.dueDate
        });
        const documentLink = `${origin}/d/${share.token}`;
        const pdfDownloadLink = `${documentLink}?download=1`;
        const amount = new Intl.NumberFormat("fr-GN").format(document.total);
        const dueDate = document.dueDate ? new Date(document.dueDate).toLocaleDateString("fr-FR") : "\u2014";
        const validUntil = document.validUntil ? new Date(document.validUntil).toLocaleDateString("fr-FR") : "\u2014";
        const slug = document.kind === "facture" ? "invoice-sent" : "quote-sent";
        const variables = {
          clientName: document.contactName || document.clientName || "Client",
          documentNumber: document.number,
          amount,
          dueDate,
          validUntil,
          documentLink,
          pdfDownloadLink,
          companyEmail: company?.email || LUCEPRES_PUBLIC_PROFILE.email,
          organization: company?.legalName || LUCEPRES_PUBLIC_PROFILE.legalName,
          paymentMethod: "selon les modalit\xE9s indiqu\xE9es sur le document",
          linkExpiresAt: share.expiresAt.toLocaleDateString("fr-FR")
        };
        const rendered = await renderEmailTemplate2(slug, variables);
        if (!rendered?.html && !rendered?.text) {
          throw new TRPCError4({
            code: "INTERNAL_SERVER_ERROR",
            message: `Mod\xE8le e-mail \xAB ${slug} \xBB introuvable.`
          });
        }
        const attachments = input.attachPdf === false ? void 0 : [{
          filename: `${document.number}.pdf`,
          content: buildDocumentSharePdfBuffer({
            kind: document.kind,
            number: document.number,
            issueDate: document.issueDate,
            validUntil: document.validUntil,
            dueDate: document.dueDate,
            clientName: document.clientName,
            contactName: document.contactName,
            clientAddress: document.clientAddress,
            notes: document.notes,
            subtotal: document.subtotal,
            taxTotal: document.taxTotal,
            total: document.total,
            lines: document.lines
          }, company),
          contentType: "application/pdf"
        }];
        if (document.status === "brouillon" || document.status === "a_envoyer") {
          await updateDocumentStatus(document.id, "envoye", ctx.user.id);
        }
        try {
          await sendMail({
            to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            attachments
          });
        } catch (error) {
          throw new TRPCError4({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "\xC9chec d\u2019envoi de l\u2019e-mail."
          });
        }
        await createClientActivity({
          clientId: document.clientId,
          documentId: document.id,
          type: "email_envoye",
          title: `${document.kind === "facture" ? "Facture" : "Devis"} envoy\xE9 par e-mail`,
          description: `${document.number} \u2192 ${to} \xB7 lien guest`,
          createdById: ctx.user.id
        });
        return {
          success: true,
          emailed: true,
          to,
          documentLink,
          attachPdf: Boolean(attachments?.length),
          status: "envoye"
        };
      })
    }),
    payments: router({
      create: staffProcedure.input(z2.object({ documentId: z2.number().int().positive(), amount: z2.number().int().positive().max(9e9), paidAt: dateText, method: z2.enum(["especes", "virement", "cheque", "mobile_money", "autre"]), reference: z2.string().trim().max(120).optional(), notes: optionalText })).mutation(async ({ ctx, input }) => {
        try {
          return await recordPayment({ ...input, createdById: ctx.user.id });
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Le paiement ne peut pas \xEAtre enregistr\xE9." });
        }
      })
    }),
    assistant: router({
      summarizeClientHistory: staffProcedure.input(z2.object({ clientId: z2.number().int().positive() })).mutation(async ({ input }) => {
        const client = await getClientById(input.clientId);
        if (!client) throw new TRPCError4({ code: "NOT_FOUND", message: "Client introuvable." });
        const history = await listClientActivities(input.clientId);
        const models = await listLLMModels();
        const model = models.data.find((entry) => entry.id === "nvidia/nemotron-3-ultra-550b-a55b")?.id ?? models.data.find((entry) => entry.id === "mistralai/mistral-nemotron")?.id ?? models.data[0]?.id;
        if (!model) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Aucun mod\xE8le IA n\u2019est actuellement disponible." });
        const result = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "Tu es l\u2019assistant de suivi commercial de Lucepress, entreprise BTP et forage. \xC0 partir de l\u2019historique fourni, r\xE9dige en fran\xE7ais une synth\xE8se br\xE8ve et factuelle pour pr\xE9parer le prochain \xE9change avec le client. Ne fabrique aucun fait. Signale les \xE9l\xE9ments financiers ou commerciaux \xE0 v\xE9rifier et propose des prochaines \xE9tapes pragmatiques. Le r\xE9sultat est une aide interne \xE0 relire, jamais un message envoy\xE9 au client." },
            { role: "user", content: JSON.stringify({ client: { nom: client.companyName, contact: client.contactName }, historique: history.slice(0, 50).map((event) => ({ date: event.createdAt, type: event.type, titre: event.title, detail: event.description })) }) }
          ],
          response_format: { type: "json_schema", json_schema: clientHistorySummarySchema }
        });
        const content = result.choices[0]?.message.content;
        if (typeof content !== "string") throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Le r\xE9sum\xE9 IA est indisponible. R\xE9essayez dans un instant." });
        try {
          return { summary: JSON.parse(content), requiresReview: true };
        } catch {
          throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Le r\xE9sum\xE9 IA ne peut pas \xEAtre lu. R\xE9essayez dans un instant." });
        }
      }),
      generateReminder: staffProcedure.input(z2.object({ documentId: z2.number().int().positive(), tone: z2.enum(["courtois", "ferme"]).default("courtois") })).mutation(async ({ ctx, input }) => {
        const document = await getDocumentById(input.documentId);
        if (!document || document.kind !== "facture" || document.balanceDue <= 0) throw new TRPCError4({ code: "BAD_REQUEST", message: "La relance doit concerner une facture avec un solde impay\xE9." });
        const models = await listLLMModels();
        const model = models.data.find((entry) => entry.id === "nvidia/nemotron-3-ultra-550b-a55b")?.id ?? models.data.find((entry) => entry.id === "mistralai/mistral-nemotron")?.id ?? models.data[0]?.id;
        if (!model) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Aucun mod\xE8le IA n\u2019est actuellement disponible." });
        const result = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "Tu es l\u2019assistant de recouvrement de Lucepress, entreprise guin\xE9enne BTP et forage. R\xE9dige en fran\xE7ais un mod\xE8le d\u2019e-mail de relance professionnel, factuel et pr\xEAt \xE0 relire, sans menaces ni affirmation juridique. Mentionne le num\xE9ro de facture, le montant du solde en GNF et l\u2019\xE9ch\xE9ance connue. Le r\xE9sultat est un brouillon : ne pr\xE9tends jamais que l\u2019e-mail a \xE9t\xE9 envoy\xE9." },
            { role: "user", content: JSON.stringify({ ton: input.tone, facture: document.number, client: document.clientName, contact: document.contactName, email: document.clientEmail, echeance: document.dueDate, soldeGNF: document.balanceDue, dateEmission: document.issueDate }) }
          ],
          response_format: { type: "json_schema", json_schema: reminderResponseSchema }
        });
        const content = result.choices[0]?.message.content;
        if (typeof content !== "string") throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Le mod\xE8le de relance est indisponible. R\xE9essayez dans un instant." });
        try {
          const reminder = JSON.parse(content);
          await createClientActivity({ clientId: document.clientId, documentId: document.id, type: "relance_preparee", title: `Relance ${reminder.tone || input.tone} pr\xE9par\xE9e`, description: reminder.subject, createdById: ctx.user.id });
          return { reminder, requiresReview: true };
        } catch {
          throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Le mod\xE8le de relance ne peut pas \xEAtre lu. R\xE9essayez dans un instant." });
        }
      }),
      /**
       * Envoie une relance par SMTP (après relecture humaine).
       * WhatsApp volontairement non branché (sourdine démo).
       */
      sendReminderEmail: staffProcedure.input(reminderEmailInputSchema).mutation(async ({ ctx, input }) => {
        if (!isMailConfigured()) {
          throw new TRPCError4({
            code: "PRECONDITION_FAILED",
            message: "SMTP non configur\xE9. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS."
          });
        }
        return dispatchReminderEmail(input, ctx.user.id);
      }),
      /**
       * Envoie un lot de relances déjà relu (Créances). Continue en cas d’échec partiel.
       */
      sendBatchReminderEmails: staffProcedure.input(z2.object({
        reminders: z2.array(reminderEmailInputSchema.omit({ to: true })).min(1).max(BATCH_REMINDER_LIMIT)
      })).mutation(async ({ ctx, input }) => {
        if (!isMailConfigured()) {
          throw new TRPCError4({
            code: "PRECONDITION_FAILED",
            message: "SMTP non configur\xE9. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS."
          });
        }
        const sent = [];
        const failed = [];
        for (const reminder of input.reminders) {
          try {
            const result = await dispatchReminderEmail(reminder, ctx.user.id);
            sent.push({ documentId: result.documentId, to: result.to });
          } catch (error) {
            failed.push({
              documentId: reminder.documentId,
              error: error instanceof TRPCError4 ? error.message : error instanceof Error ? error.message : "\xC9chec d\u2019envoi."
            });
          }
        }
        return {
          sent,
          failed,
          sentCount: sent.length,
          failedCount: failed.length
        };
      }),
      prepareBatchReminders: staffProcedure.input(z2.object({ documentIds: z2.array(z2.number().int().positive()).min(1).max(BATCH_REMINDER_LIMIT), tone: z2.enum(["courtois", "ferme"]).default("courtois"), instruction: z2.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
        let documentIds;
        try {
          documentIds = normalizeBatchReminderDocumentIds(input.documentIds);
        } catch (error) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "La s\xE9lection de relance est invalide." });
        }
        const instruction = normalizeBatchReminderInstruction(input.instruction);
        const documents2 = await Promise.all(documentIds.map((documentId) => getDocumentById(documentId)));
        if (documents2.some((document) => !document || document.kind !== "facture" || document.balanceDue <= 0)) throw new TRPCError4({ code: "BAD_REQUEST", message: "Chaque relance doit concerner une facture avec un solde impay\xE9." });
        const invoices = documents2;
        const models = await listLLMModels();
        const model = models.data.find((entry) => entry.id === "nvidia/nemotron-3-ultra-550b-a55b")?.id ?? models.data.find((entry) => entry.id === "mistralai/mistral-nemotron")?.id ?? models.data[0]?.id;
        if (!model) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Aucun mod\xE8le IA n\u2019est actuellement disponible." });
        const result = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "Tu es l\u2019assistant de recouvrement de Lucepress, entreprise guin\xE9enne BTP et forage. Pr\xE9pare un brouillon d\u2019e-mail distinct et personnalis\xE9 pour chaque facture fournie. Chaque texte doit \xEAtre professionnel, factuel, sans menace ni affirmation juridique, et mentionner exactement le num\xE9ro de facture, le solde en GNF et l\u2019\xE9ch\xE9ance connue. Respecte l\u2019instruction interne facultative seulement si elle est compatible avec ces faits. Ces contenus sont des brouillons internes : ne pr\xE9tends jamais qu\u2019un e-mail a \xE9t\xE9 envoy\xE9 ou programm\xE9. Retourne strictement une entr\xE9e par documentId fourni, sans en ajouter ni en omettre." },
            { role: "user", content: JSON.stringify({ ton: input.tone, instructionInterne: instruction ?? null, factures: invoices.map((invoice) => ({ documentId: invoice.id, facture: invoice.number, client: invoice.clientName, contact: invoice.contactName, echeance: invoice.dueDate, soldeGNF: invoice.balanceDue, dateEmission: invoice.issueDate })) }) }
          ],
          response_format: { type: "json_schema", json_schema: batchReminderResponseSchema }
        });
        const content = result.choices[0]?.message.content;
        if (typeof content !== "string") throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Les mod\xE8les de relance sont indisponibles. R\xE9essayez dans un instant." });
        try {
          const parsed = JSON.parse(content);
          const remindersByDocumentId = new Map(parsed.reminders.map((reminder) => [reminder.documentId, reminder]));
          if (parsed.reminders.length !== documentIds.length || documentIds.some((documentId) => !remindersByDocumentId.has(documentId))) throw new Error("Le mod\xE8le n\u2019a pas pr\xE9par\xE9 tous les brouillons demand\xE9s.");
          const reminders = documentIds.map((documentId) => remindersByDocumentId.get(documentId));
          if (reminders.some((reminder) => !reminder.subject.trim() || !reminder.greeting.trim() || !reminder.body.trim() || !reminder.closing.trim())) throw new Error("Le mod\xE8le a retourn\xE9 un brouillon incomplet.");
          await Promise.all(reminders.map((reminder) => {
            const invoice = invoices.find((document) => document.id === reminder.documentId);
            return createClientActivity({ clientId: invoice.clientId, documentId: invoice.id, type: "relance_preparee", title: `Relance group\xE9e ${reminder.tone || input.tone} pr\xE9par\xE9e`, description: reminder.subject, createdById: ctx.user.id });
          }));
          return { reminders, requiresReview: true, delivery: "brouillons_uniquement" };
        } catch (error) {
          throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Les mod\xE8les de relance ne peuvent pas \xEAtre lus. R\xE9essayez dans un instant." });
        }
      }),
      extractClient: staffProcedure.input(z2.object({ text: z2.string().trim().min(10).max(6e3) })).mutation(async ({ input }) => {
        const models = await listLLMModels();
        const model = models.data.find((entry) => entry.id === "nvidia/nemotron-3-ultra-550b-a55b")?.id ?? models.data.find((entry) => entry.id === "mistralai/mistral-nemotron")?.id ?? models.data[0]?.id;
        if (!model) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Aucun mod\xE8le IA n\u2019est actuellement disponible." });
        const result = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "Tu es l\u2019assistant administratif de Lucepress. Extrais uniquement les coordonn\xE9es d\u2019un prospect ou client contenues dans le texte fourni. Ne fabrique jamais une donn\xE9e absente : utilise une cha\xEEne vide. companyName doit \xEAtre le nom de l\u2019entreprise, du particulier ou du client ; si aucun nom exploitable n\u2019est mentionn\xE9, utilise 'Client \xE0 confirmer' et signale-le dans missingFields. NIF, RCCM et identifiants fiscaux sont facultatifs : ne les mets jamais dans missingFields. missingFields ne concerne que les coordonn\xE9es de contact vraiment utiles (e-mail, t\xE9l\xE9phone, adresse) si elles manquent. notes doit contenir seulement les pr\xE9cisions utiles au r\xE9pertoire. La sortie est un brouillon \xE0 faire relire avant enregistrement." },
            { role: "user", content: input.text }
          ],
          response_format: { type: "json_schema", json_schema: clientExtractionResponseSchema }
        });
        const content = result.choices[0]?.message.content;
        if (typeof content !== "string") throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "L\u2019extraction IA est indisponible. R\xE9essayez dans un instant." });
        try {
          const client = extractedClientSchema.parse(JSON.parse(content));
          return { client: { ...client, missingFields: omitOptionalPaperworkMissingFields(client.missingFields) }, requiresReview: true };
        } catch {
          throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Les coordonn\xE9es extraites ne peuvent pas \xEAtre lues. R\xE9essayez dans un instant." });
        }
      }),
      proposeQuote: staffProcedure.input(z2.object({ description: z2.string().trim().min(20).max(6e3), projectType: z2.enum(["btp", "forage", "mixte"]).optional(), taxRate: z2.number().int().min(0).max(100).default(0) })).mutation(async ({ input }) => {
        const catalog = await listServices();
        const models = await listLLMModels();
        const model = models.data.find((entry) => entry.id === "nvidia/nemotron-3-ultra-550b-a55b")?.id ?? models.data.find((entry) => entry.id === "mistralai/mistral-nemotron")?.id ?? models.data[0]?.id;
        if (!model) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Aucun mod\xE8le IA n\u2019est actuellement disponible." });
        const serviceContext = catalog.map((service) => ({ code: service.code, name: service.name, unit: service.unit, unitPrice: service.defaultUnitPrice, taxRate: service.defaultTaxRate })).slice(0, 80);
        const result = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "Tu es l\u2019assistant commercial de Lucepress, entreprise guin\xE9enne BTP et forage. \xC0 partir d\u2019une simple description de chantier, pr\xE9pare un devis complet, structur\xE9 et pr\xEAt \xE0 relire en fran\xE7ais. D\xE9duis le domaine, le p\xE9rim\xE8tre, les \xE9tapes, les prestations, les hypoth\xE8ses, la dur\xE9e d\u2019ex\xE9cution, les conditions de paiement et une dur\xE9e de validit\xE9 raisonnable. Il s\u2019agit toujours d\u2019un brouillon \xE0 faire relire : ne pr\xE9tends jamais qu\u2019il est valid\xE9. R\xE9utilise le catalogue fourni quand il correspond. Si un prix fiable n\u2019est pas pr\xE9sent dans le catalogue, utilise 0 comme prix unitaire et mentionne explicitement la v\xE9rification requise dans note, technicalNotes et assumptions. Tous les montants sont des entiers en francs guin\xE9ens (GNF). Les lignes doivent \xEAtre exhaustives mais ne dois pas inventer de prix." },
            { role: "user", content: JSON.stringify({ besoin: input.description, domaine: input.projectType ?? "non pr\xE9cis\xE9", tauxTaxeParDefaut: input.taxRate, cataloguePrestations: serviceContext }) }
          ],
          response_format: { type: "json_schema", json_schema: proposalSchema }
        });
        const content = result.choices[0]?.message.content;
        if (typeof content !== "string") throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "La proposition IA est indisponible. R\xE9essayez dans un instant." });
        try {
          return { proposal: JSON.parse(content), requiresReview: true };
        } catch {
          throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "La proposition IA ne peut pas \xEAtre lue. R\xE9essayez dans un instant." });
        }
      })
    })
  })
});

// server/clientAttachments.ts
import express from "express";

// server/storage.ts
init_env();
import fs2 from "node:fs";
import path2 from "node:path";
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    return null;
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function getLocalStorageDir() {
  const dir = path2.resolve(import.meta.dirname, "../storage");
  if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
  return dir;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const forgeConfig = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  if (forgeConfig) {
    const { forgeUrl, forgeKey } = forgeConfig;
    const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
    presignUrl.searchParams.set("path", key);
    const presignResp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` }
    });
    if (!presignResp.ok) {
      const msg = await presignResp.text().catch(() => presignResp.statusText);
      throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
    }
    const { url: s3Url } = await presignResp.json();
    if (!s3Url) throw new Error("Forge returned empty presign URL");
    const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
    const uploadResp = await fetch(s3Url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob
    });
    if (!uploadResp.ok) {
      throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
    }
    return { key, url: `/manus-storage/${key}` };
  }
  const dir = getLocalStorageDir();
  const filePath = path2.join(dir, key);
  const subDir = path2.dirname(filePath);
  if (!fs2.existsSync(subDir)) fs2.mkdirSync(subDir, { recursive: true });
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  fs2.writeFileSync(filePath, buffer);
  return { key, url: `/manus-storage/${key}` };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader2 } from "cookie";
import { SignJWT as SignJWT2, jwtVerify as jwtVerify2 } from "jose";
init_env();
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader2(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT2({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify2(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user2 = await getUserByOpenId(sessionUserId);
    if (!user2) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user2 = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user2) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user2.openId,
      lastSignedIn: signedInAt
    });
    return user2;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "cadre",
    tenantId: 1,
    passwordHash: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/clientAttachments.ts
init_tenantContext();

// shared/clientAttachments.ts
var MAX_CLIENT_ATTACHMENT_SIZE = 20 * 1024 * 1024;
var ALLOWED_CLIENT_ATTACHMENT_TYPES = /* @__PURE__ */ new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
]);
function sanitizeClientAttachmentName(value) {
  const name = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return (name || "piece-jointe").slice(0, 180);
}
function validateClientAttachmentMetadata(contentType, size) {
  if (!Number.isInteger(size) || size <= 0) return "Aucun fichier re\xE7u.";
  if (size > MAX_CLIENT_ATTACHMENT_SIZE) return "Le fichier d\xE9passe la limite de 20 Mo.";
  if (!ALLOWED_CLIENT_ATTACHMENT_TYPES.has(contentType)) return "Type de fichier non autoris\xE9.";
  return null;
}

// server/clientAttachments.ts
function registerClientAttachmentRoutes(app) {
  app.post("/api/client-attachments", express.raw({ type: "*/*", limit: "20mb" }), async (req, res) => {
    try {
      let user2;
      try {
        user2 = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Session expir\xE9e ou invalide." });
      }
      if (!user2 || user2.role !== "admin") return res.status(401).json({ error: "Acc\xE8s non autoris\xE9." });
      if (user2.tenantId == null) return res.status(401).json({ error: "Aucun tenant associ\xE9." });
      return await runWithTenant(user2.tenantId, async () => {
        const clientId = Number(req.header("x-client-id"));
        const fileName = sanitizeClientAttachmentName(req.header("x-file-name") || "");
        const contentType = (req.header("content-type") || "application/octet-stream").split(";")[0];
        const data = req.body;
        if (!Number.isInteger(clientId) || clientId <= 0) return res.status(400).json({ error: "Client invalide." });
        if (!await getClientById(clientId)) return res.status(400).json({ error: "Le client s\xE9lectionn\xE9 est introuvable." });
        const metadataError = validateClientAttachmentMetadata(contentType, Buffer.isBuffer(data) ? data.length : 0);
        if (metadataError) return res.status(400).json({ error: metadataError });
        const stored = await storagePut(`client-attachments/${clientId}/${fileName}`, data, contentType);
        const attachment = await createClientAttachment({ clientId, fileName, contentType, size: data.length, storageKey: stored.key, storageUrl: stored.url, createdById: user2.id });
        return res.status(201).json({ ...attachment, fileName, contentType, size: data.length, storageUrl: stored.url });
      });
    } catch (error) {
      console.error("[Client attachments] Upload failed:", error);
      return res.status(500).json({ error: "La pi\xE8ce jointe n\u2019a pas pu \xEAtre enregistr\xE9e." });
    }
  });
}

// server/projectCostAttachments.ts
import express2 from "express";
init_tenantContext();

// shared/projectCostAttachments.ts
var MAX_PROJECT_COST_ATTACHMENT_SIZE = 10 * 1024 * 1024;
var ALLOWED_PROJECT_COST_ATTACHMENT_TYPES = /* @__PURE__ */ new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
function sanitizeProjectCostAttachmentName(value) {
  return sanitizeClientAttachmentName(value);
}
function validateProjectCostAttachmentMetadata(contentType, size) {
  if (!Number.isInteger(size) || size <= 0) return "Aucun fichier re\xE7u.";
  if (size > MAX_PROJECT_COST_ATTACHMENT_SIZE) return "Le justificatif d\xE9passe la limite de 10 Mo.";
  if (!ALLOWED_PROJECT_COST_ATTACHMENT_TYPES.has(contentType)) return "Seuls les fichiers PDF, JPEG, PNG et WebP sont autoris\xE9s.";
  return null;
}

// server/projectCostAttachments.ts
function registerProjectCostAttachmentRoutes(app) {
  app.post("/api/project-cost-attachments", express2.raw({ type: "*/*", limit: "10mb" }), async (req, res) => {
    try {
      let user2;
      try {
        user2 = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Session expir\xE9e ou invalide." });
      }
      if (!user2 || user2.role !== "admin") return res.status(401).json({ error: "Acc\xE8s non autoris\xE9." });
      if (user2.tenantId == null) return res.status(401).json({ error: "Aucun tenant associ\xE9." });
      return await runWithTenant(user2.tenantId, async () => {
        const projectCostId = Number(req.header("x-project-cost-id"));
        const fileName = sanitizeProjectCostAttachmentName(decodeURIComponent(req.header("x-file-name") || ""));
        const contentType = (req.header("content-type") || "application/octet-stream").split(";")[0];
        const data = req.body;
        if (!Number.isInteger(projectCostId) || projectCostId <= 0) return res.status(400).json({ error: "Co\xFBt invalide." });
        const cost = await getProjectCostById(projectCostId);
        if (!cost) return res.status(400).json({ error: "Le co\xFBt s\xE9lectionn\xE9 est introuvable." });
        const metadataError = validateProjectCostAttachmentMetadata(contentType, Buffer.isBuffer(data) ? data.length : 0);
        if (metadataError) return res.status(400).json({ error: metadataError });
        const stored = await storagePut(`project-cost-attachments/${cost.projectId}/${projectCostId}/${fileName}`, data, contentType);
        const attachment = await createProjectCostAttachment({ projectCostId, fileName, contentType, size: data.length, storageKey: stored.key, storageUrl: stored.url, createdById: user2.id });
        return res.status(201).json({ ...attachment, fileName, contentType, size: data.length, storageUrl: stored.url });
      });
    } catch (error) {
      console.error("[Project cost attachments] Upload failed:", error);
      return res.status(500).json({ error: "Le justificatif n\u2019a pas pu \xEAtre enregistr\xE9." });
    }
  });
}

// server/integrations/externalRoutes.ts
function unavailable(res, provider) {
  return res.status(503).json({ error: "integration_not_configured", message: `L\u2019int\xE9gration ${provider} est en mode pr\xE9paratoire et reste d\xE9sactiv\xE9e tant que ses secrets serveur ne sont pas configur\xE9s.` });
}
function registerIntegrationExternalRoutes(app) {
  app.get("/api/integrations/google/callback", async (req, res) => {
    const readiness = getIntegrationSecretConfiguration();
    if (!readiness.googleOAuthConfigured) return unavailable(res, "Google Workspace");
    const code = typeof req.query.code === "string" ? req.query.code : void 0;
    const state = typeof req.query.state === "string" ? req.query.state : void 0;
    const error = typeof req.query.error === "string" ? req.query.error : void 0;
    if (error) return res.status(400).json({ error: "google_authorization_denied", message: "L\u2019autorisation Google a \xE9t\xE9 refus\xE9e ou annul\xE9e." });
    if (!code || !state) return res.status(400).json({ error: "missing_oauth_parameters", message: "Le code et le state OAuth sont requis." });
    return res.status(501).json({ error: "activation_pending", message: "Le callback Google est enregistr\xE9 ; son \xE9change s\xE9curis\xE9 sera activ\xE9 apr\xE8s la configuration du coffre de jetons." });
  });
  app.get("/api/integrations/whatsapp/webhook", (req, res) => {
    const readiness = getIntegrationSecretConfiguration();
    if (!readiness.whatsappWebhookConfigured) return unavailable(res, "WhatsApp Business");
    const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : void 0;
    const verifyToken = typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : void 0;
    const challenge = typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : void 0;
    if (!mode || !verifyToken || !challenge) return res.status(400).json({ error: "missing_webhook_verification_parameters" });
    return res.status(501).json({ error: "activation_pending", message: "Le webhook WhatsApp est enregistr\xE9 ; sa v\xE9rification HMAC sera activ\xE9e apr\xE8s la configuration des secrets Meta." });
  });
  app.post("/api/integrations/whatsapp/webhook", (req, res) => {
    const readiness = getIntegrationSecretConfiguration();
    if (!readiness.whatsappWebhookConfigured) return unavailable(res, "WhatsApp Business");
    return res.status(501).json({ error: "activation_pending", message: "Le webhook WhatsApp est enregistr\xE9 mais l\u2019ingestion est d\xE9sactiv\xE9e tant que le coffre de secrets n\u2019est pas configur\xE9." });
  });
}

// server/agentCampaignScheduleRoutes.ts
function registerAgentCampaignScheduleRoutes(app) {
  app.post("/api/scheduled/agent-test-email", async (req, res) => {
    try {
      const taskUid = req.body?.taskUid ?? req.query?.taskUid;
      if (!taskUid) return res.status(400).json({ error: "taskUid requis" });
      const record = await getAgentCampaignByScheduleTaskUid(taskUid);
      if (!record) return res.status(404).json({ error: "Campagne introuvable" });
      const tenantId = record.campaign?.tenantId ?? null;
      const result = await deliverScheduledAgentCampaignToTestInbox(taskUid, tenantId);
      return res.json({ ok: true, ...result, externalDispatch: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue du traitement e-mail de test.";
      return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
  });
}

// server/_core/context.ts
init_localAuth();
function parseCookies(cookieHeader) {
  const map = /* @__PURE__ */ new Map();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) map.set(key, decodeURIComponent(value));
  }
  return map;
}
async function createContext(opts) {
  let user2 = null;
  const cookies = parseCookies(opts.req.headers.cookie);
  const token = cookies.get(COOKIE_NAME) ?? null;
  const session = await verifyLocalSession(token);
  if (session) {
    user2 = await getUserByOpenId(session.openId) ?? null;
  }
  const tenantId = session?.tenantId ?? user2?.tenantId ?? null;
  return { req: opts.req, res: opts.res, user: user2, tenantId };
}

// server/_core/serveStatic.ts
import express3 from "express";

// server/_core/index.ts
async function createApp() {
  const app = express4();
  const server = createServer(app);
  const helmet = (await import("helmet")).default;
  const cors = (await import("cors")).default;
  const rateLimit = (await import("express-rate-limit")).default;
  const trustProxyRaw = (process.env.TRUST_PROXY ?? "").trim();
  if (trustProxyRaw && trustProxyRaw !== "0" && trustProxyRaw.toLowerCase() !== "false") {
    const hops = Number.parseInt(trustProxyRaw, 10);
    app.set("trust proxy", Number.isFinite(hops) && hops > 0 ? hops : 1);
  }
  app.use(express4.json({ limit: "1mb" }));
  app.use(express4.urlencoded({ limit: "1mb", extended: true }));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? true, credentials: true }));
  const apiRateMax = Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? "2000", 10);
  if (Number.isFinite(apiRateMax) && apiRateMax > 0) {
    app.use("/api/", rateLimit({
      windowMs: 6e4,
      max: apiRateMax,
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
      skip: (req) => req.path === "/health" || req.originalUrl?.startsWith("/api/health")
    }));
  }
  registerStorageProxy(app);
  registerClientAttachmentRoutes(app);
  registerProjectCostAttachmentRoutes(app);
  registerIntegrationExternalRoutes(app);
  registerAgentCampaignScheduleRoutes(app);
  app.get("/api/health", async (_req, res) => {
    const dbOk = await pingDatabase();
    res.status(200).json({ ...buildHealthPayload({ dbOk }), dbError: dbOk ? null : getLastDbError() });
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return { app, server };
}

// netlify/functions/api.ts
if (!globalThis.crypto) {
  globalThis.crypto = nodeWebCrypto;
}
var handlerPromise = null;
async function getHandler() {
  if (!handlerPromise) {
    const { app } = await createApp();
    handlerPromise = serverlessHttp(app);
  }
  return handlerPromise;
}
async function requestToEvent(req) {
  const url = new URL(req.url);
  const headers = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = req.method === "GET" || req.method === "HEAD" ? null : await req.text();
  return {
    path: url.pathname,
    httpMethod: req.method,
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: body ?? null,
    isBase64Encoded: false
  };
}
function v1ToWebResponse(result) {
  if (result instanceof Response) return result;
  const status = result?.statusCode ?? 200;
  const headers = result?.headers ?? {};
  const isBase64 = result?.isBase64Encoded === true;
  const body = result?.body ?? "";
  const init = {
    status,
    headers: new Headers(headers)
  };
  if (isBase64) {
    const bin = Buffer.from(String(body), "base64");
    return new Response(new Uint8Array(bin), init);
  }
  return new Response(body == null ? "" : String(body), init);
}
var api_default = async (event, context) => {
  try {
    const handler = await getHandler();
    if (event instanceof Request) {
      const gwEvent = await requestToEvent(event);
      const result2 = await handler(gwEvent, context);
      return v1ToWebResponse(result2);
    }
    const out = { ...event };
    if (!out.path && out.rawPath) out.path = out.rawPath;
    if (!out.httpMethod) {
      out.httpMethod = out.requestContext?.http?.method || out.requestContext?.httpMethod || "GET";
    }
    if (out.body && typeof out.body === "object") out.body = JSON.stringify(out.body);
    const result = await handler(out, context);
    return v1ToWebResponse(result);
  } catch (err) {
    const message = err && err.stack ? err.stack : String(err);
    return v1ToWebResponse({
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ diag: "api-handler-throw", message })
    });
  }
};
export {
  api_default as default
};
