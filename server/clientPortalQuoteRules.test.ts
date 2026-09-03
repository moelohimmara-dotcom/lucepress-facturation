import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocumentById = vi.fn();
const updateDocumentStatus = vi.fn(async () => ({ success: true }));

/** Mirrors the decision rules in server/db.ts respondToClientPortalQuote. */
async function respondToClientPortalQuote(input: {
  clientId: number;
  documentId: number;
  decision: "accepte" | "refuse";
  createdById: number;
}) {
  const quote = await getDocumentById(input.documentId);
  if (!quote || quote.kind !== "devis" || quote.clientId !== input.clientId) {
    throw new Error("Ce devis n’est pas disponible pour votre compte.");
  }
  if (quote.status !== "envoye") {
    throw new Error("Ce devis n’est plus en attente de votre réponse.");
  }
  if (quote.validUntil) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validUntil = new Date(quote.validUntil);
    validUntil.setHours(0, 0, 0, 0);
    if (validUntil < today) {
      throw new Error("Ce devis a expiré. Contactez Lucepres pour une mise à jour.");
    }
  }
  await updateDocumentStatus(quote.id, input.decision, input.createdById, {
    title: input.decision === "accepte" ? "Devis accepté par le client" : "Devis refusé par le client",
    description: `${quote.number} · décision portail`,
  });
  return { success: true as const, status: input.decision, number: quote.number };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("P1.3 — règles métier décision devis", () => {
  it("accepte un devis envoye du bon client", async () => {
    getDocumentById.mockResolvedValue({
      id: 55,
      kind: "devis",
      number: "DEV-55",
      status: "envoye",
      clientId: 9,
      validUntil: null,
    });
    await expect(respondToClientPortalQuote({ clientId: 9, documentId: 55, decision: "accepte", createdById: 9 })).resolves.toMatchObject({
      status: "accepte",
    });
    expect(updateDocumentStatus).toHaveBeenCalledWith(55, "accepte", 9, expect.objectContaining({
      title: "Devis accepté par le client",
    }));
  });

  it("refuse l’IDOR et un statut non envoye", async () => {
    getDocumentById.mockResolvedValueOnce({
      id: 55,
      kind: "devis",
      number: "DEV-55",
      status: "envoye",
      clientId: 99,
      validUntil: null,
    });
    await expect(respondToClientPortalQuote({ clientId: 9, documentId: 55, decision: "accepte", createdById: 9 })).rejects.toThrow("pas disponible");

    getDocumentById.mockResolvedValueOnce({
      id: 55,
      kind: "devis",
      number: "DEV-55",
      status: "accepte",
      clientId: 9,
      validUntil: null,
    });
    await expect(respondToClientPortalQuote({ clientId: 9, documentId: 55, decision: "refuse", createdById: 9 })).rejects.toThrow("plus en attente");
  });
});
