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
  
  // Mettre à jour les rôles "user" existants en "cadre"
  const [result] = await pool.query(`
    UPDATE users SET role = 'cadre' WHERE role = 'user';
  `);
  
  console.log(`Rôles mis à jour : ${(result as any).affectedRows} utilisateur(s) converti(s) en 'cadre'.`);
  
  // Vérifier les rôles actuels
  const [rows] = await pool.query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`);
  console.log("\nRépartition actuelle des rôles :");
  console.table(rows);
  
  await pool.end();
}

main().catch(console.error);
