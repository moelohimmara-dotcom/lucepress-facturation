import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/ReceivablesPage.tsx"), "utf8");

describe("interface de recouvrement Lucepress", () => {
  it("met en évidence la file de traitement, la supervision humaine et les promesses dépassées", () => {
    expect(source).toContain("Créances & priorités");
    expect(source).toContain("Supervision humaine");
    expect(source).toContain("Promesse de paiement dépassée");
    expect(source).toContain("File de traitement");
    expect(source).toContain("lucepress-panel");
  });

  it("propose l’export filtré, la chronologie client et les brouillons groupés à relire", () => {
    expect(source).toContain("Exporter la file filtrée");
    expect(source).toContain("Historique client");
    expect(source).toContain("Relances groupées");
    expect(source).toContain("Consigne de personnalisation");
    expect(source).toContain("Aucun e-mail, WhatsApp ou autre message n’est envoyé");
  });

  it("propose le rapport mensuel, les statuts de suivi et l’attribution d’un responsable", () => {
    expect(source).toContain("Rapport mensuel PDF");
    expect(source).toContain("Statut de relance");
    expect(source).toContain("Responsable de recouvrement");
    expect(source).toContain("À rappeler");
    expect(source).toContain("Rapport de pilotage interne");
  });
});
