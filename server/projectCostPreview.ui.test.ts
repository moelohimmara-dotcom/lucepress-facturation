import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("prévisualisation des justificatifs de coûts", () => {
  it("propose une modale locale pour les PDF et les images sans imposer de téléchargement", () => {
    const source = readFileSync(new URL("../client/src/pages/ProjectCostsPage.tsx", import.meta.url), "utf8");
    expect(source).toContain("Prévisualisation sécurisée du justificatif associé à ce coût.");
    expect(source).toContain("<iframe");
    expect(source).toContain("<img src={preview.storageUrl}");
    expect(source).toContain("Prévisualiser ${attachment.fileName}");
  });
});
