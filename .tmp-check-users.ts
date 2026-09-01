import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
const raw = readFileSync(".env", "utf8");
const line = raw.split("\n").map(l => l.trim()).find(l => l.startsWith("DATABASE_URL="));
const url = line ? line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : "";
const c = await mysql.createConnection(url);

console.log("=== Users et tenantId ===");
const [users] = await c.query("SELECT id, email, tenantId FROM users");
users.forEach(u => console.log(`  #${u.id} ${u.email} -> tenantId: ${u.tenantId}`));

console.log("\n=== Tenants ===");
const [tenants] = await c.query("SELECT id, name FROM tenants");
tenants.forEach(t => console.log(`  #${t.id} ${t.name}`));

console.log("\n=== Memberships ===");
const [mem] = await c.query("SELECT m.userId, m.tenantId, m.role, u.email FROM tenant_memberships m JOIN users u ON u.id=m.userId");
mem.forEach(m => console.log(`  user ${m.userId} (${m.email}) -> tenant ${m.tenantId} [${m.role}]`));

await c.end();
