import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("centre de délégations de l’agent", () => {
  const source = readFileSync(new URL("../client/src/pages/AgentDelegationsPage.tsx", import.meta.url), "utf8");

  it("présente explicitement le mode simulation et l’absence d’envoi externe", () => {
    expect(source).toContain("Mode simulation sécurisé");
    expect(source).toContain("Aucun message ne peut quitter Lucepress depuis cet écran.");
    expect(source).toContain("Brouillons préparés, jamais envoyés.");
    expect(source).toContain("/relances");
  });

  it("expose les garde-fous de durée, volume et seconde validation", () => {
    expect(source).toContain("60 messages par jour");
    expect(source).toContain("90 jours");
    expect(source).toContain("Deux validateurs distincts");
    expect(source).toContain("Délai minimum par contact");
  });

  it("expose le Copilote en tant que brouillon IA relisible", () => {
    expect(source).toContain("Briefing marge & recouvrement");
    expect(source).toContain("Brouillon IA — relecture obligatoire");
    expect(source).toContain("copilotBriefing");
  });
});
