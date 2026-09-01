import { createPool } from "mysql2/promise";
import { config } from "dotenv";

config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL manquant dans .env");
    process.exit(1);
  }
  
  const pool = createPool(connectionString);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      userId INT NOT NULL,
      tokenHash VARCHAR(255) NOT NULL UNIQUE,
      expiresAt TIMESTAMP NOT NULL,
      usedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      INDEX password_resets_user_idx (userId),
      INDEX password_resets_status_idx (expiresAt)
    );
  `);
  
  console.log("Table password_resets créée avec succès.");
  await pool.end();
}

main().catch(console.error);
