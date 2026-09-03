import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("cockpit Aujourd’hui", () => {
  it("expose une file de validation fondée sur buildTodayInbox", () => {
    expect(source).toContain("buildTodayInbox");
    expect(source).toContain("À valider");
    expect(source).toContain("Votre file à traiter");
    expect(source).toContain("mailStatus");
  });

  it("conserve le démarrage guidé court pour le test 48 h", () => {
    expect(source).toContain("gettingStartedTasks");
    expect(source).toContain("isGettingStartedTaskComplete");
    expect(source).toContain("Trois gestes pour démarrer");
    expect(source).toContain("Guide de démarrage");
  });

  it("renomme l’entrée de navigation en Aujourd’hui", () => {
    expect(layout).toContain('label: "Aujourd’hui"');
    expect(layout).toContain('path: "/"');
  });
});
