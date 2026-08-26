import { describe, expect, it } from "vitest";
import { findPotentialClientDuplicates } from "../shared/clientDuplicates";

describe("findPotentialClientDuplicates", () => {
  const clients = [
    { id: 1, companyName: "Bâti Guinée", email: "contact@bati.example", phone: "+224 600 11 22 33" },
    { id: 2, companyName: "Forage Kankan", email: "contact@forage.example", phone: "+224 611 22 33 44" },
  ];

  it("détecte les correspondances de raison sociale, e-mail et téléphone", () => {
    const matches = findPotentialClientDuplicates(clients, { companyName: "Bati Guinee", email: "contact@bati.example", phone: "600112233" });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.reasons).toEqual(expect.arrayContaining(["raison sociale identique", "e-mail identique", "téléphone identique"]));
  });

  it("exclut la fiche en cours de modification", () => {
    expect(findPotentialClientDuplicates(clients, { companyName: "Bati Guinee", email: "", phone: "" }, 1)).toEqual([]);
  });
});
