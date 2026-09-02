const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Corriger l'enregistrement existant (tenantId NULL → 1)
  await connection.execute("UPDATE agent_operator_grants SET tenantId = 1 WHERE tenantId IS NULL");
  console.log("Enregistrement corrigé (tenantId = 1)");

  // Modifier la colonne pour avoir une valeur par défaut
  await connection.execute("ALTER TABLE agent_operator_grants MODIFY COLUMN tenantId INT NOT NULL DEFAULT 1");
  console.log("Colonne tenantId modifiée (DEFAULT 1)");

  // Vérification
  const [rows] = await connection.execute("SELECT * FROM agent_operator_grants");
  console.log("Lignes:", rows);

  await connection.end();
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
