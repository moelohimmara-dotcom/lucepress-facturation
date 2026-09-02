-- Migration: Création de la table email_templates
-- Date: 2026-09-02

CREATE TABLE IF NOT EXISTS email_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NULL,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(180) NOT NULL,
  subject VARCHAR(300) NOT NULL,
  html LONGTEXT NOT NULL,
  text LONGTEXT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY email_templates_tenant_slug_unique (tenant_id, slug),
  INDEX email_templates_slug_idx (slug),
  INDEX email_templates_tenant_idx (tenant_id),
  CONSTRAINT fk_email_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed templates par défaut (globaux)
INSERT IGNORE INTO email_templates (tenant_id, slug, name, subject, html, text) VALUES
(
  NULL,
  'invitation',
  'Invitation collaborateur',
  'Invitation à rejoindre {{organization}}',
  '<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', sans-serif; margin: 0; padding: 0; background: #f6faf8; }\n    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }\n    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }\n    p { color: #444; line-height: 1.6; margin: 0 0 16px; }\n    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }\n    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <h1>Invitation à rejoindre {{organization}}</h1>\n    <p>Bonjour,</p>\n    <p>{{inviterName}} vous a invité(e) à rejoindre <strong>{{organization}}</strong> sur Lucepres.</p>\n    <p style="text-align: center;">\n      <a href="{{inviteLink}}" class="button">Accepter l''invitation</a>\n    </p>\n    <p>Ce lien expire le <strong>{{expiresAt}}</strong>.</p>\n    <div class="footer">\n      <p>Si vous n''attendez pas cette invitation, vous pouvez ignorer cet e-mail.</p>\n    </div>\n  </div>\n</body>\n</html>',
  'Bonjour,\n\n{{inviterName}} vous a invité(e) à rejoindre {{organization}} sur Lucepres.\n\nCliquez ici pour accepter : {{inviteLink}}\n\nCe lien expire le {{expiresAt}}.\n\nSi vous n''attendez pas cette invitation, ignorez cet e-mail.'
),
(
  NULL,
  'password-reset',
  'Réinitialisation du mot de passe',
  'Réinitialisez votre mot de passe Lucepres',
  '<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', sans-serif; margin: 0; padding: 0; background: #f6faf8; }\n    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }\n    h1 { color: #113b35; font-size: 24px; margin: 0 0 24px; }\n    p { color: #444; line-height: 1.6; margin: 0 0 16px; }\n    .button { display: inline-block; padding: 14px 32px; background: #113b35; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }\n    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 13px; color: #6b7280; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <h1>Réinitialisation du mot de passe</h1>\n    <p>Bonjour,</p>\n    <p>Vous avez demandé la réinitialisation de votre mot de passe Lucepres.</p>\n    <p style="text-align: center;">\n      <a href="{{resetLink}}" class="button">Réinitialiser mon mot de passe</a>\n    </p>\n    <p>Ce lien expire dans 1 heure.</p>\n    <div class="footer">\n      <p>Si vous n''êtes pas à l''origine de cette demande, ignorez cet e-mail.</p>\n    </div>\n  </div>\n</body>\n</html>',
  'Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe Lucepres.\n\nCliquez ici : {{resetLink}}\n\nCe lien expire dans 1 heure.\n\nSi vous n''êtes pas à l''origine de cette demande, ignorez cet e-mail.'
);
