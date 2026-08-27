import { describe, expect, it } from "vitest";
import { getEffectiveSidebarWidth, getRestorableRoute, getSidebarDensityPreference, getSidebarShortcutPath, hasSidebarOverflow, isCompactSidebar } from "../shared/sidebarNavigation";

describe("préférences de navigation latérale", () => {
  it("restaure uniquement une rubrique mémorisée et autorisée depuis la page d’accueil", () => {
    expect(getRestorableRoute("/", "/clients", ["/", "/clients"])).toBe("/clients");
    expect(getRestorableRoute("/factures", "/clients", ["/", "/clients", "/factures"])).toBeNull();
    expect(getRestorableRoute("/", "/inconnue", ["/", "/clients"])).toBeNull();
  });

  it("préserve le chemin dédié du cockpit lorsqu’il est choisi explicitement", () => {
    expect(getRestorableRoute("/tableau-de-bord", "/clients", ["/", "/tableau-de-bord", "/clients"])).toBeNull();
  });

  it("active le mode compact sur largeur intermédiaire ou à la demande", () => {
    expect(isCompactSidebar(null, 1024)).toBe(true);
    expect(isCompactSidebar(null, 1280)).toBe(false);
    expect(isCompactSidebar("compact", 1280)).toBe(true);
    expect(isCompactSidebar("normal", 1024)).toBe(false);
  });

  it("lit les préférences persistées en préservant le comportement automatique historique", () => {
    expect(getSidebarDensityPreference("compact")).toBe("compact");
    expect(getSidebarDensityPreference("normal")).toBe("normal");
    expect(getSidebarDensityPreference("true")).toBe("compact");
    expect(getSidebarDensityPreference("false")).toBeNull();
    expect(getSidebarDensityPreference("invalide")).toBeNull();
  });

  it("réduit la largeur effective sans l’augmenter au-delà de la préférence utilisateur", () => {
    expect(getEffectiveSidebarWidth(276, true)).toBe(240);
    expect(getEffectiveSidebarWidth(224, true)).toBe(224);
    expect(getEffectiveSidebarWidth(276, false)).toBe(276);
  });

  it("associe les raccourcis Alt aux trois destinations de navigation rapide", () => {
    expect(getSidebarShortcutPath("1", true)).toBe("/clients");
    expect(getSidebarShortcutPath("2", true)).toBe("/chantiers");
    expect(getSidebarShortcutPath("3", true)).toBe("/devis/nouveau?assistant=1");
    expect(getSidebarShortcutPath("1", false)).toBeNull();
    expect(getSidebarShortcutPath("1", true, true)).toBeNull();
  });

  it("signale uniquement une navigation encore défilable vers le bas", () => {
    expect(hasSidebarOverflow(800, 500, 0)).toBe(true);
    expect(hasSidebarOverflow(800, 500, 300)).toBe(false);
    expect(hasSidebarOverflow(500, 500, 0)).toBe(false);
  });
});
