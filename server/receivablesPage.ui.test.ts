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
});
