import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
const raw = readFileSync(".env", "utf8");
const line = raw.split("\n").map(l => l.trim()).find(l => l.startsWith("DATABASE_URL="));
const url = line ? line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : "";
const c = await mysql.createConnection(url);

// Corriger l'utilisateur orphelin
const [orphans] = await c.query("SELECT id, email FROM users WHERE tenantId IS NULL");
console.log("Utilisateurs orphelins:", orphans.length);
for (const u of orphans) {
  await c.query("UPDATE users SET tenantId = 1 WHERE id = ?", [u.id]);
  console.log(`  user ${u.id} (${u.email}) -> tenant 1`);
}

// Vérifier les utilisateurs sans membership
const [noMember] = await c.query(`
  SELECT u.id, u.email, u.tenantId 
  FROM users u 
  LEFT JOIN tenant_memberships m ON m.userId = u.id 
  WHERE m.id IS NULL
`);
console.log("Utilisateurs sans membership:", noMember.length);
for (const u of noMember) {
  await c.query("INSERT INTO tenant_memberships (userId, tenantId, role) VALUES (?, ?, 'admin')", [u.id, u.tenantId]);
  console.log(`  user ${u.id} (${u.email}) -> membership tenant ${u.tenantId}`);
}

await c.end();
console.log("Corrigé");
