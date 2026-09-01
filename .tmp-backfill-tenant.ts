import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
const raw = readFileSync(".env", "utf8");
const line = raw.split("\n").map(l => l.trim()).find(l => l.startsWith("DATABASE_URL="));
const url = line ? line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : "";
const c = await mysql.createConnection(url);

// 1. S'assurer que le tenant 1 existe
await c.query("INSERT INTO tenants (id, name, plan, status, currency) VALUES (1, 'Lucepress', 'pro', 'active', 'GNF') ON DUPLICATE KEY UPDATE name='Lucepress'");
console.log("Tenant #1 OK");

// 2. Backfill tenantId = 1 pour toutes les lignes orphelines
const tables = [
  "users", "clients", "projects", "project_costs", "project_cost_attachments",
  "services", "service_price_revisions", "documents", "document_lines",
  "payments", "payment_promises", "company_settings", "client_attachments",
  "client_activities", "integration_connections", "agent_delegations",
  "agent_campaigns", "agent_message_jobs", "agent_test_email_deliveries",
  "agent_audit_logs", "document_sequences"
];

for (const t of tables) {
  const [r] = await c.query(`UPDATE ${t} SET tenantId = 1 WHERE tenantId IS NULL`);
  console.log(`  ${t}: ${(r as any).affectedRows} lignes mises à jour`);
}

// 3. Créer les memberships manquants pour les users tenant 1
await c.query(`
  INSERT INTO tenant_memberships (userId, tenantId, role)
  SELECT id, 1, 'admin' FROM users WHERE tenantId = 1
  ON DUPLICATE KEY UPDATE role = 'admin'
`);
console.log("Memberships tenant 1 OK");

// 4. Vérifier
const [u] = await c.query("SELECT COUNT(*) as n FROM users WHERE tenantId IS NULL");
const [cl] = await c.query("SELECT COUNT(*) as n FROM clients WHERE tenantId IS NULL");
console.log(`\nUsers orphelins: ${(u as any)[0].n}`);
console.log(`Clients orphelins: ${(cl as any)[0].n}`);

await c.end();
console.log("Backfill termine");
