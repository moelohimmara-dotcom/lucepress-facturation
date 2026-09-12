import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cockpit des promesses à venir", () => {
  it("met en avant les promesses des sept prochains jours et oriente vers les créances", () => {
    const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const inboxSource = readFileSync(new URL("../shared/todayInbox.ts", import.meta.url), "utf8");

    // La section promesses à venir est désormais factorisée dans buildTodayInbox (shared/todayInbox.ts)
    // et l'accueil oriente vers les créances via la file d'actions.
    expect(inboxSource).toContain("paymentPromise");
    expect(homeSource).toContain('setLocation("/creances")');
    expect(homeSource).toContain("buildTodayInbox");
  });
});
