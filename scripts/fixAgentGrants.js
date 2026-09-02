const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Vérifier la table agent_operator_grants
  const [columns] = await connection.execute("DESCRIBE agent_operator_grants");
  console.log("Colonnes existantes:", columns.map(c => c.Field));

  // Colonnes requises
  const required = ["id", "tenantId", "userId", "role", "canApprove", "canActivate", "scope", "status", "expiresAt", "grantedById", "createdAt", "updatedAt"];
  const existing = columns.map(c => c.Field);
  const missing = required.filter(r => !existing.includes(r));

  if (missing.length > 0) {
    console.log("Colonnes manquantes:", missing);
    // Ajouter les colonnes manquantes
    for (const col of missing) {
      let type = "INT";
      if (col.includes("At")) type = "TIMESTAMP NULL";
      if (col === "role" || col === "scope" || col === "status") type = "VARCHAR(50)";
      if (col.startsWith("can")) type = "TINYINT(1) DEFAULT 0";
      
      try {
        await connection.execute(`ALTER TABLE agent_operator_grants ADD COLUMN ${col} ${type}`);
        console.log(`Ajouté: ${col} (${type})`);
      } catch (e) {
        console.log(`Erreur pour ${col}:`, e.message);
      }
    }
  } else {
    console.log("Toutes les colonnes sont présentes.");
  }

  // Vérification finale
  const [final] = await connection.execute("DESCRIBE agent_operator_grants");
  console.log("\nColonnes finales:", final.map(c => c.Field));

  await connection.end();
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
