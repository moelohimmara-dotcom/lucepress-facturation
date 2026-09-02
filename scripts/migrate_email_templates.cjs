// Script de migration email_templates
// Exécuter: node migrate_email_templates.js

const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  console.log("Création table email_templates...");
  await connection.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("Table créée.");

  // Vérifier si templates existent
  const [rows] = await connection.execute("SELECT COUNT(*) as c FROM email_templates");
  if (rows[0].c > 0) {
    console.log(`Templates déjà présents (${rows[0].c}). Skip seed.`);
  } else {
    console.log("Seed templates par défaut...");
    await connection.execute(`
      INSERT INTO email_templates (tenant_id, slug, name, subject, html, text) VALUES
      (NULL, 'invitation', 'Invitation collaborateur', 'Invitation à rejoindre {{organization}}',
        '<!DOCTYPE html><html><body><h1>Invitation</h1><p>{{inviterName}} vous invite à rejoindre {{organization}}.</p><a href="{{inviteLink}}">Accepter</a></body></html>',
        'Bonjour, {{inviterName}} vous invite. Lien: {{inviteLink}}'),
      (NULL, 'password-reset', 'Réinitialisation mot de passe', 'Réinitialisez votre mot de passe',
        '<!DOCTYPE html><html><body><h1>Réinitialisation</h1><a href="{{resetLink}}">Réinitialiser</a></body></html>',
        'Cliquez ici: {{resetLink}}')
    `);
    console.log("Seed OK.");
  }

  const [result] = await connection.execute("SELECT id, slug, name FROM email_templates");
  console.log("Templates:", result);

  await connection.end();
  console.log("Migration terminée.");
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
