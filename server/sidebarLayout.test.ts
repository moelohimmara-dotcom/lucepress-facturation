import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutPath = new URL("../client/src/components/DashboardLayout.tsx", import.meta.url);

describe("barre latérale Lucepress", () => {
  it("place l’Assistant IA dans un pied de barre fixe et garde les rubriques dans une zone défilante", () => {
    const source = readFileSync(layoutPath, "utf8");
    const contentStart = source.indexOf("<SidebarContent");
    const contentEnd = source.indexOf("</SidebarContent>");
    const footerStart = source.indexOf("<SidebarFooter");
    const assistantPosition = source.indexOf("Assistant IA");

    expect(source).toContain("overflow-y-auto");
    expect(contentStart).toBeGreaterThan(-1);
    expect(contentEnd).toBeGreaterThan(contentStart);
    expect(footerStart).toBeGreaterThan(contentEnd);
    expect(assistantPosition).toBeGreaterThan(footerStart);
  });
});
