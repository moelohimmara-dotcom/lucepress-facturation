import { describe, expect, it } from "vitest";
import { createQuoteUrlForClient, findPrefilledClient, getPrefilledClientId } from "../shared/clientPrefill";

describe("préremplissage client des devis", () => {
  const clients = [{ id: 42, companyName: "Entreprise Kankan", contactName: "Aïssatou Camara", email: "contact@kankan.example", phone: "+224 600 00 00 00", address: "Kankan" }];

  it("construit et lit l’URL de création de devis associée à un client", () => {
    expect(createQuoteUrlForClient(42)).toBe("/devis/nouveau?clientId=42");
    expect(getPrefilledClientId("?clientId=42")).toBe("42");
  });

  it("retrouve les coordonnées du client à afficher dans le devis", () => {
    expect(findPrefilledClient(clients, "42")).toMatchObject({ companyName: "Entreprise Kankan", contactName: "Aïssatou Camara", address: "Kankan" });
  });

  it("ignore les paramètres de client invalides", () => {
    expect(getPrefilledClientId("?clientId=-1")).toBe("");
    expect(getPrefilledClientId("?clientId=42abc")).toBe("");
  });
});
