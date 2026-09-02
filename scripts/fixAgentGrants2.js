const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Vérifier le contenu de agent_operator_grants
  const [rows] = await connection.execute("SELECT * FROM agent_operator_grants");
  console.log("Lignes dans agent_operator_grants:", rows.length);
  if (rows.length > 0) {
    console.log("Exemple:", rows[0]);
  }

  // Vérifier l'utilisateur admin
  const [users] = await connection.execute("SELECT id, email, role FROM users WHERE email = 'dg@lucepress.com'");
  console.log("\nUtilisateur admin:", users);

  // Si pas de grant pour l'admin, en créer un
  if (users.length > 0 && rows.length === 0) {
    const adminId = users[0].id;
    console.log("\nCréation grant pour admin (userId:", adminId, ")...");
    await connection.execute(
      "INSERT INTO agent_operator_grants (userId, role, canApprove, canActivate, scope, status, createdAt, updatedAt) VALUES (?, 'admin', 1, 1, 'all', 'active', NOW(), NOW())",
      [adminId]
    );
    console.log("Grant créé.");
  }

  // Vérification finale
  const [final] = await connection.execute("SELECT * FROM agent_operator_grants");
  console.log("\nLignes finales:", final.length);

  await connection.end();
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
