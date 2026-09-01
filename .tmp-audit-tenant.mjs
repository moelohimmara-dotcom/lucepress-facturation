import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
const raw = readFileSync(".env", "utf8");
const line = raw.split("\n").map(l => l.trim()).find(l => l.startsWith("DATABASE_URL="));
const url = line ? line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : "";
const c = await mysql.createConnection(url);

// État des données
console.log("=== État des tenants ===");
const [tenants] = await c.query("SELECT id, name FROM tenants");
tenants.forEach((t: any) => console.log(`  #${t.id} ${t.name}`));

console.log("\n=== Users et leur tenantId ===");
const [users] = await c.query("SELECT id, email, tenantId FROM users");
users.forEach((u: any) => console.log(`  #${u.id} ${u.email} -> tenantId: ${u.tenantId}`));

console.log("\n=== Clients et leur tenantId ===");
const [clients] = await c.query("SELECT id, companyName, tenantId FROM clients LIMIT 10");
clients.forEach((cl: any) => console.log(`  #${cl.id} ${cl.companyName} -> tenantId: ${cl.tenantId}`));

console.log("\n=== Tenant memberships ===");
const [mem] = await c.query("SELECT m.userId, m.tenantId, m.role, u.email FROM tenant_memberships m JOIN users u ON u.id=m.userId");
mem.forEach((m: any) => console.log(`  user ${m.userId} (${m.email}) -> tenant ${m.tenantId} [${m.role}]`));

await c.end();
