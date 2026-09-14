import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = join(process.cwd(), "client", "src");

describe("aperçu et impression multi-pages", () => {
  it("DocumentPreviewPage expose des guides de pagination A4 visibles à l'écran, masqués à l'impression", () => {
    const preview = readFileSync(join(clientRoot, "pages", "DocumentPreviewPage.tsx"), "utf8");
    expect(preview).toContain("PageBreakGuides");
    expect(preview).toContain("articleRef");
    expect(preview).toContain("print:hidden");
    expect(preview).toContain("Page ");
  });

  it("le pied de page de l'aperçu reste dans le flux pour la capture PDF", () => {
    const preview = readFileSync(join(clientRoot, "pages", "DocumentPreviewPage.tsx"), "utf8");
    expect(preview).toContain('id="lucepress-print-document"');
    expect(preview).toContain("formatCompanyDocumentFooter");
  });

  it("printDocument.ts renforce la pagination (thead répété, break-inside avoid sur les blocs)", () => {
    const print = readFileSync(join(clientRoot, "lib", "printDocument.ts"), "utf8");
    expect(print).toContain("display: table-header-group");
    expect(print).toContain("break-inside: avoid");
    expect(print).toContain("page-break-inside: avoid");
    expect(print).toContain("@page");
  });
});
