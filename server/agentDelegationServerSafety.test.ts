import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sécurité serveur du centre de délégations", () => {
  const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
  const persistence = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

  it("réserve les actions de l’agent à un opérateur habilité", () => {
    expect(router).toContain("const agentOperatorProcedure = protectedProcedure.use");
    expect(router).toContain("getAgentOperatorAccess");
    expect(router).toContain("requireAgentApproval");
    expect(router).toContain("requireAgentActivation");
  });

  it("ne prépare que des tâches simulées et trace chaque décision", () => {
    expect(persistence).toContain('status: "simulation_prete"');
    expect(persistence).toContain('externalDispatch: false');
    expect(persistence).toContain("agentAuditLogs");
    expect(persistence).not.toContain("fetch(\"https://graph.facebook.com");
  });
});
