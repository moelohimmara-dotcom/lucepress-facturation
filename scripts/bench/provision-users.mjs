#!/usr/bin/env node
/**
 * Crée / met à jour 7 comptes cadre de bench (emails @lucepress.test).
 * Mot de passe unique généré, écrit uniquement dans --out (chmod 600).
 * Usage (VPS) : node --env-file=.env scripts/bench/provision-users.mjs --out ~/.lucepress-bench-users.csv
 */
import { createHash, randomBytes, scrypt } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { createConnection } from "mysql2/promise";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;
const COUNT = 7;
const TENANT_ID = 1;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(plain, salt, KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

function randomPassword() {
  return randomBytes(18).toString("base64url");
}

const outPath = arg("out", "");
if (!outPath) {
  console.error("Passez --out /chemin/vers/fichier.csv (ne pas committer).");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL manquant (utilisez node --env-file=.env).");
  process.exit(1);
}

const connection = await createConnection({ uri: process.env.DATABASE_URL });
const rows = [];

try {
  for (let index = 1; index <= COUNT; index += 1) {
    const email = `bench${String(index).padStart(2, "0")}@lucepress.test`;
    const name = `Bench ${String(index).padStart(2, "0")}`;
    const password = randomPassword();
    const passwordHash = await hashPassword(password);
    const openId = `local_bench_${createHash("sha256").update(email).digest("hex").slice(0, 24)}`;

    const [existing] = await connection.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing.length) {
      await connection.query(
        "UPDATE users SET passwordHash = ?, name = ?, role = 'cadre', loginMethod = 'email', tenantId = ? WHERE id = ?",
        [passwordHash, name, TENANT_ID, existing[0].id],
      );
    } else {
      await connection.query(
        "INSERT INTO users (tenantId, openId, name, email, passwordHash, loginMethod, role, lastSignedIn) VALUES (?, ?, ?, ?, ?, 'email', 'cadre', NOW())",
        [TENANT_ID, openId, name, email, passwordHash],
      );
    }
    rows.push(`${email},${password}`);
  }
} finally {
  await connection.end();
}

writeFileSync(outPath, `${rows.join("\n")}\n`, { encoding: "utf8" });
try {
  chmodSync(outPath, 0o600);
} catch {
  // Windows n’applique pas chmod unix.
}
console.log(`OK ${COUNT} comptes cadre écrits dans ${outPath}`);
