import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["server/agentCampaignAdministration.ui.test.ts", "node"],
      ["server/agentDelegationsPage.ui.test.ts", "node"],
      ["server/calendarPage.ui.test.ts", "node"],
      ["server/dashboardUpcomingPromises.ui.test.ts", "node"],
      ["server/homePage.ui.test.ts", "node"],
      ["server/projectCostPreview.ui.test.ts", "node"],
      ["server/receivablesPage.ui.test.ts", "node"],
      ["server/**/*.ui.test.ts", "jsdom"],
      ["client/**/*.test.ts", "jsdom"],
      ["client/**/*.test.tsx", "jsdom"],
    ],
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    setupFiles: ["./vitest.setup.ts"],
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    exclude: ["server/*.example.test.ts", "server/**/*.example.test.ts", "node_modules/**"],
  },
});
