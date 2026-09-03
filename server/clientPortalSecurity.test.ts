import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("portail client", () => {
  it("utilise une procédure protégée et vérifie le client correspondant à l’e-mail authentifié", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const database = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    expect(router).toMatch(/clientPortal: router\(\{\s*overview: protectedProcedure/s);
    expect(router).toContain("db.getClientPortalOverview(ctx.user.email)");
    expect(router).toContain("db.getClientPortalInvoice(ctx.user.email, input.id)");
    expect(router).toContain("db.getClientPortalQuote(ctx.user.email, input.id)");
    expect(router).toContain("respondToClientPortalQuote");
    expect(database).toContain("lower(${clients.email}) = ${normalized}");
    expect(database).toContain("invoice.clientId !== client.id");
    expect(database).toContain("respondToClientPortalQuote");
    expect(database).toContain('decision === "accepte"');
  });
});
