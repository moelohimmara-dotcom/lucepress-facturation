import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientPrefillCard } from "../client/src/components/ClientPrefillCard";

describe("ClientPrefillCard", () => {
  it("affiche les coordonnées sauvegardées reprises dans le devis", () => {
    const html = renderToStaticMarkup(createElement(ClientPrefillCard, { client: { id: 7, companyName: "Luce Construction", contactName: "Fatou Diallo", email: "fatou@example.com", phone: "+224 611 22 33 44", address: "Conakry, Kaloum" } }));
    expect(html).toContain("Informations client préremplies");
    expect(html).toContain("Luce Construction");
    expect(html).toContain("Fatou Diallo");
    expect(html).toContain("Conakry, Kaloum");
    expect(html).toContain("aperçu et le PDF");
  });
});
