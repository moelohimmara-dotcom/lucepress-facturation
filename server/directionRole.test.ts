import { describe, expect, it } from "vitest";
import { isDirectionRole, nextAssignableStaffRole } from "../shared/roles";

describe("P1.2 — distinction directeur", () => {
  it("reconnaît admin et directeur comme direction", () => {
    expect(isDirectionRole("admin")).toBe(true);
    expect(isDirectionRole("directeur")).toBe(true);
    expect(isDirectionRole("cadre")).toBe(false);
    expect(isDirectionRole("client")).toBe(false);
  });

  it("fait cycler les rôles assignables cadre → directeur → admin → systeme → cadre", () => {
    expect(nextAssignableStaffRole("cadre")).toBe("directeur");
    expect(nextAssignableStaffRole("directeur")).toBe("admin");
    expect(nextAssignableStaffRole("admin")).toBe("systeme");
    expect(nextAssignableStaffRole("systeme")).toBe("cadre");
  });

  it("garde la distinction direction intacte pour le rôle système", () => {
    // Le rôle système administre le système, pas le commerce : il n’est pas
    // « direction » et n’hérite donc pas des écrans de pilotage.
    expect(isDirectionRole("systeme")).toBe(false);
    expect(isDirectionRole("directeur")).toBe(true);
  });
});
