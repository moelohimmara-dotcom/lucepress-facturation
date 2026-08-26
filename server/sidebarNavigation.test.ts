import { describe, expect, it } from "vitest";
import { getEffectiveSidebarWidth, getRestorableRoute, hasSidebarOverflow, isCompactSidebar } from "../shared/sidebarNavigation";

describe("préférences de navigation latérale", () => {
  it("restaure uniquement une rubrique mémorisée et autorisée depuis la page d’accueil", () => {
    expect(getRestorableRoute("/", "/clients", ["/", "/clients"])).toBe("/clients");
    expect(getRestorableRoute("/factures", "/clients", ["/", "/clients", "/factures"])).toBeNull();
    expect(getRestorableRoute("/", "/inconnue", ["/", "/clients"])).toBeNull();
  });

  it("active le mode compact sur largeur intermédiaire ou à la demande", () => {
    expect(isCompactSidebar(false, 1024)).toBe(true);
    expect(isCompactSidebar(false, 1280)).toBe(false);
    expect(isCompactSidebar(true, 1280)).toBe(true);
  });

  it("réduit la largeur effective sans l’augmenter au-delà de la préférence utilisateur", () => {
    expect(getEffectiveSidebarWidth(276, true)).toBe(240);
    expect(getEffectiveSidebarWidth(224, true)).toBe(224);
    expect(getEffectiveSidebarWidth(276, false)).toBe(276);
  });

  it("signale uniquement une navigation encore défilable vers le bas", () => {
    expect(hasSidebarOverflow(800, 500, 0)).toBe(true);
    expect(hasSidebarOverflow(800, 500, 300)).toBe(false);
    expect(hasSidebarOverflow(500, 500, 0)).toBe(false);
  });
});
