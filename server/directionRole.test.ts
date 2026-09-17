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

  it("compte le rôle système dans la direction, comme directionProcedure", () => {
    // RETOURNÉ — le rôle système administrait le système sans le commerce : il
    // n’était donc pas « direction ». Il est devenu SUPER-ADMINISTRATEUR : il
    // ouvre les écrans de pilotage comme `admin`, et ce prédicat est le miroir
    // exact de `directionProcedure` (`server/_core/trpc.ts`), qui l’accepte.
    expect(isDirectionRole("systeme")).toBe(true);
    expect(isDirectionRole("directeur")).toBe(true);
    expect(isDirectionRole("admin")).toBe(true);
    // La distinction qui compte n’est pas desserrée : `cadre` et le portail
    // client restent hors de la direction.
    expect(isDirectionRole("cadre")).toBe(false);
    expect(isDirectionRole("client")).toBe(false);
    expect(isDirectionRole(undefined)).toBe(false);
  });
});
