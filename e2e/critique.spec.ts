import { test, expect } from "@playwright/test";

test.describe("Parcours critique Lucepres", () => {
  test.beforeEach(async ({ page }) => {
    // Active le mode démo local avant chaque test
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("lucepress-dev-bypass", "true"));
    await page.reload();
  });

  test("affiche le cockpit et navigue vers devis", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Bonjour, pilotons l’essentiel")).toBeVisible();
    await page.goto("/devis/nouveau");
    await expect(page).toHaveURL(/\/devis\/nouveau/);
  });

  test("navigation sidebar + recherche", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sidebar-shell").getByRole("button", { name: "Clients" }).click();
    await expect(page).toHaveURL(/\/clients/);
    await page.getByTestId("sidebar-shell").getByRole("button", { name: "Chantiers" }).click();
    await expect(page).toHaveURL(/\/chantiers/);
    await page.keyboard.press("Control+K");
    await expect(page.getByPlaceholder("Client, numéro de devis")).toBeVisible();
  });

  test("mode démo reste actif après reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Cockpit commercial")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Cockpit commercial")).toBeVisible();
  });
});
