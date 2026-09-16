import { describe, expect, it } from "vitest";
import { isDirectionRole, nextAssignableStaffRole } from "../shared/roles";

describe("P1.2 — distinction directeur", () => {
  it("reconnaît admin et directeur comme direction", () => {
    expect(isDirectionRole("admin")).toBe(true);
    expect(isDirectionRole("directeur")).toBe(true);
    expect(isDirectionRole("cadre")).toBe(false);
    expect(isDirectionRole("client")).toBe(false);
  });

  it("fait cycler les rôles assignables par un admin : cadre → directeur → admin → cadre", () => {
    expect(nextAssignableStaffRole("cadre")).toBe("directeur");
    expect(nextAssignableStaffRole("directeur")).toBe("admin");
    // RETOURNÉ — le cycle passait par `admin → systeme`. L’écran Utilisateurs est
    // réservé à l’admin, qui n’a plus l’habilitation d’attribuer le rôle système :
    // le raccourci ne doit donc plus le proposer.
    expect(nextAssignableStaffRole("admin")).toBe("cadre");
    expect(nextAssignableStaffRole("systeme")).toBe("cadre");
  });

  it("garde la distinction direction intacte pour le rôle système", () => {
    // Le rôle système administre le système, pas le commerce : il n’est pas
    // « direction » et n’hérite donc pas des écrans de pilotage.
    expect(isDirectionRole("systeme")).toBe(false);
    expect(isDirectionRole("directeur")).toBe(true);
  });
});
