const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Vérifier le role de l'admin
  const [users] = await connection.execute("SELECT id, email, role FROM users WHERE email = 'dg@lucepress.com'");
  console.log("Admin user:", users);

  // Si le role n'est pas 'admin', le corriger
  if (users.length > 0 && users[0].role !== 'admin') {
    console.log(`Correction du role: ${users[0].role} → admin`);
    await connection.execute("UPDATE users SET role = 'admin' WHERE id = ?", [users[0].id]);
    console.log("Role corrigé.");
  }

  // Vérification
  const [final] = await connection.execute("SELECT id, email, role FROM users WHERE email = 'dg@lucepress.com'");
  console.log("Final:", final);

  await connection.end();
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
