import { test, expect } from "@playwright/test";

test("login et logout Lucepress", async ({ page }) => {
  // 1. Aller sur la page de login
  await page.goto("https://lucepress.213.156.135.139.sslip.io/login", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await expect(page).toHaveTitle(/Lucepres/);

  // 2. Remplir les champs
  await page.fill("#email", "dg@lucepress.com");
  await page.fill("#password", "Yeo?KVK74%b%?@OfVx");

  // 3. Soumettre
  await page.click("button:has-text('Se connecter')");

  // 4. Attendre la navigation (n'importe quelle page sauf login)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
  console.log("Login OK - URL:", page.url());

  // 5. Vérifier le contenu
  await expect(page.getByText("Directeur General")).toBeVisible({
    timeout: 5000,
  });
  console.log("Nom visible");

  // 6. Chercher et cliquer sur "Se déconnecter"
  const logoutBtn = page
    .getByRole("button", { name: /déconnecter/i })
    .or(page.getByText(/déconnecter/i));
  await logoutBtn.click();

  // 7. Vérifier la redirection vers /login
  await page.waitForURL(/login/, { timeout: 10000 });
  console.log("Logout OK - retour à la page de login");

  // 8. Vérifier qu'on ne peut plus accéder au dashboard
  await page.goto("https://lucepress.213.156.135.139.sslip.io/tableau-de-bord");
  await page.waitForURL(/login/, { timeout: 10000 });
  console.log("Protection dashboard OK - redirigé vers login");
});
