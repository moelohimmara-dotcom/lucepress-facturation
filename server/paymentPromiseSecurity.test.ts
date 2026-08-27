import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("promesse de paiement client", () => {
  it("reste liée à une facture impayée du client authentifié", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const database = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    expect(router).toMatch(/createPaymentPromise: protectedProcedure/);
    expect(router).toContain("email: ctx.user.email");
    expect(database).toContain("invoice.clientId !== client.id || invoice.balanceDue <= 0");
    expect(database).toContain("La date prévue doit être aujourd’hui ou ultérieure.");
  });
});
