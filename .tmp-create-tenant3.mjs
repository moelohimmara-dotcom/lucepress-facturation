import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { hashSync } from "node:crypto";

const raw = readFileSync(".env", "utf8");
const line = raw.split("\n").map(l => l.trim()).find(l => l.startsWith("DATABASE_URL="));
const url = line ? line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : "";
const c = await mysql.createConnection(url);

// Créer tenant de test (id=2 existe déjà, on crée id=3)
const [t3] = await c.query("INSERT INTO tenants (id, name, plan, status, currency) VALUES (3, 'Tenant Test Auto', 'trial', 'trial', 'GNF') ON DUPLICATE KEY UPDATE name='Tenant Test Auto'");
console.log("Tenant #3 créé/mis à jour");

// Créer utilisateur admin pour tenant 3
const openId = "tenant3-admin";
const email = "admin@tenant3.com";
const passwordHash = hashSync("MotDePasse123", 10); // faux hash, on utilise scrypt en prod — on remplacera via reset
const [u] = await c.query(
  "INSERT INTO users (openId, email, name, passwordHash, role, tenantId, loginMethod) VALUES (?, ?, 'Admin Tenant 3', ?, 'admin', 3, 'email') ON DUPLICATE KEY UPDATE tenantId=3",
  [openId, email, passwordHash]
);
console.log("User admin tenant 3 créé/mis à jour");

// Membership
await c.query("INSERT INTO tenant_memberships (userId, tenantId, role) VALUES (LAST_INSERT_ID(), 3, 'admin') ON DUPLICATE KEY UPDATE role='admin'");
console.log("Membership créé");

// Créer un client dans le tenant 3
await c.query("INSERT INTO clients (companyName, tenantId) VALUES ('Client Tenant 3', 3)");
print("Client tenant 3 créé");

// Vérifier
const [users] = await c.query("SELECT id, email, tenantId FROM users WHERE tenantId=3");
console.log("Users tenant 3:", users.length);

const [clients] = await c.query("SELECT id, companyName, tenantId FROM clients WHERE tenantId=3");
console.log("Clients tenant 3:", clients.length);

await c.end();
console.log("OK");
