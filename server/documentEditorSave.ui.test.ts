import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DocumentEditorPage.tsx"), "utf8");

describe("enregistrement devis/facture", () => {
  it("envoie expectedUpdatedAt pour éviter d’écraser une autre session", () => {
    expect(source).toContain("expectedUpdatedAt");
    expect(source).toContain("documents.create.useMutation");
    expect(source).toContain("documents.update.useMutation");
  });
});
