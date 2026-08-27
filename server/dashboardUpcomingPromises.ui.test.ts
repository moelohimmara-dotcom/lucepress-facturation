import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cockpit des promesses à venir", () => {
  it("met en avant les promesses des sept prochains jours et oriente vers les créances", () => {
    const source = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    expect(source).toContain("Promesses à venir");
    expect(source).toContain("Échéances des 7 prochains jours.");
    expect(source).toContain("upcomingPromises");
    expect(source).toContain('setLocation("/creances")');
  });
});
