import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("alerte préventive de rappel du cockpit", () => {
  it("signale les rappels attribués prévus le lendemain et nomme leur responsable", () => {
    expect(source).toContain("isCollectionReminderTomorrow");
    expect(source).toContain("Rappels de demain");
    expect(source).toContain("tomorrowReminderLoads");
    expect(source).toContain("Voir la file");
  });

  it("propose un démarrage guidé court, fondé sur les premiers jalons métier", () => {
    expect(source).toContain("Vos repères en trois minutes");
    expect(source).toContain("gettingStartedTasks");
    expect(source).toContain("isGettingStartedTaskComplete");
    expect(source).toContain("Guide de démarrage");
    expect(source).toContain("Ajouter le premier client");
    expect(source).toContain("Créer un devis avec l’IA");
  });
});
