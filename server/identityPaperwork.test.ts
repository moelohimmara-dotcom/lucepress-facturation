import { describe, expect, it } from "vitest";
import { formatIdentityRegistrationLine, omitOptionalPaperworkMissingFields } from "../shared/identityPaperwork";

describe("identité administrative souple", () => {
  it("affiche NIF et RCCM lorsqu’ils existent", () => {
    expect(formatIdentityRegistrationLine({ taxId: "NIF-1", registrationNumber: "RCCM-2" })).toBe("NIF : NIF-1 · RCCM : RCCM-2");
  });

  it("propose une mention de repli selon la situation, sans inventer d’identifiant", () => {
    expect(formatIdentityRegistrationLine({ identityKind: "en_immatriculation" })).toBe("Immatriculation en cours");
    expect(formatIdentityRegistrationLine({ identityKind: "personne_physique" })).toBe("Personne physique");
    expect(formatIdentityRegistrationLine({ identityKind: "sans_immatriculation" })).toBe("Activité non immatriculée");
    expect(formatIdentityRegistrationLine({ identityKind: "immatriculee" })).toBe("");
  });

  it("ne signale pas l’absence de NIF ou RCCM comme un champ manquant", () => {
    expect(omitOptionalPaperworkMissingFields(["taxId", "email", "NIF", "RCCM"])).toEqual(["email"]);
  });
});
