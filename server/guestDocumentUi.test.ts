import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "client", "src");

describe("guest document UI", () => {
  it("expose la route publique /d/:token et la page guest", () => {
    const app = readFileSync(join(root, "App.tsx"), "utf8");
    const page = readFileSync(join(root, "pages", "GuestDocumentPage.tsx"), "utf8");
    const main = readFileSync(join(root, "main.tsx"), "utf8");
    expect(app).toContain('path="/d/:token"');
    expect(app).toContain("GuestDocumentPage");
    expect(page).toContain("trpc.guest.getDocument");
    expect(page).toContain("trpc.guest.respondToQuote");
    expect(page).toContain("Espace invité");
    expect(main).toContain('pathname.startsWith("/d/")');
  });

  it("propose l’option Joindre le PDF à l’envoi staff", () => {
    const preview = readFileSync(join(root, "pages", "DocumentPreviewPage.tsx"), "utf8");
    expect(preview).toContain("Joindre le PDF");
    expect(preview).toContain("attachPdf");
    expect(preview).toContain("sendByEmail.mutate({ id: document.id, attachPdf })");
  });
});
