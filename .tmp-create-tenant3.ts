import "dotenv/config";
import mysql from "mysql2/promise";
import { hashPassword } from "./server/_core/password";

async function main() {
  const c = await mysql.createConnection(process.env.DATABASE_URL!);

  // Créer tenant de test (id=3)
  await c.query("INSERT INTO tenants (id, name, plan, status, currency) VALUES (3, 'Tenant Test Auto', 'trial', 'trial', 'GNF') ON DUPLICATE KEY UPDATE name='Tenant Test Auto'");
  console.log("Tenant #3 créé/mis à jour");

  // Créer utilisateur admin pour tenant 3 avec vrai hash scrypt
  const openId = "tenant3-admin";
  const email = "admin@tenant3.com";
  const passwordHash = await hashPassword("MotDePasse123");
  const [u] = await c.query(
    "INSERT INTO users (openId, email, name, passwordHash, role, tenantId, loginMethod) VALUES (?, ?, 'Admin Tenant 3', ?, 'admin', 3, 'email') ON DUPLICATE KEY UPDATE tenantId=3, passwordHash=VALUES(passwordHash)",
    [openId, email, passwordHash]
  );
  console.log("User admin tenant 3 créé/mis à jour (id: ", (u as any).insertId, ")");

  // Membership
  await c.query("INSERT INTO tenant_memberships (userId, tenantId, role) VALUES (LAST_INSERT_ID(), 3, 'admin') ON DUPLICATE KEY UPDATE role='admin'");
  console.log("Membership créé");

  // Créer un client dans le tenant 3
  await c.query("INSERT INTO clients (companyName, tenantId) VALUES ('Client Tenant 3', 3)");
  console.log("Client tenant 3 créé");

  // Vérifier
  const [users] = await c.query("SELECT id, email, tenantId FROM users WHERE tenantId=3");
  console.log("Users tenant 3:", users.length);

  const [clients] = await c.query("SELECT id, companyName, tenantId FROM clients WHERE tenantId=3");
  console.log("Clients tenant 3:", clients.length);

  await c.end();
  console.log("OK");
}
main().catch((e) => { console.error("ERREUR:", e.message); process.exit(1); });
