import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
const raw = readFileSync(".env", "utf8");
const line = raw.split("\n").map(l => l.trim()).find(l => l.startsWith("DATABASE_URL="));
const url = line ? line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : "";
const c = await mysql.createConnection(url);

console.log("=== Tenants ===");
const [tenants] = await c.query("SELECT id, name, plan, status FROM tenants");
tenants.forEach(t => console.log(`  #${t.id} ${t.name} (${t.plan}, ${t.status})`));

console.log("=== Tenant memberships ===");
const [memberships] = await c.query("SELECT m.userId, m.tenantId, m.role, u.email FROM tenant_memberships m JOIN users u ON u.id = m.userId");
memberships.forEach(m => console.log(`  user ${m.userId} (${m.email}) -> tenant ${m.tenantId} [${m.role}]`));

console.log("=== Users sans tenantId ===");
const [orphans] = await c.query("SELECT id, email, tenantId FROM users WHERE tenantId IS NULL");
console.log("  count:", orphans.length);

console.log("=== Clients par tenantId ===");
const [clients] = await c.query("SELECT tenantId, COUNT(*) as n FROM clients GROUP BY tenantId");
clients.forEach(cl => console.log(`  tenant ${cl.tenantId}: ${cl.n} clients`));

console.log("=== Documents par tenantId ===");
const [docs] = await c.query("SELECT tenantId, COUNT(*) as n FROM documents GROUP BY tenantId");
docs.forEach(d => console.log(`  tenant ${d.tenantId}: ${d.n} documents`));

await c.end();
