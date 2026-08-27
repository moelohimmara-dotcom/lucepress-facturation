import { describe, expect, it } from "vitest";
import { sanitizeProjectCostAttachmentName, validateProjectCostAttachmentMetadata } from "../shared/projectCostAttachments";

describe("justificatifs de coûts", () => {
  it("accepte les PDF et images de taille raisonnable", () => {
    expect(validateProjectCostAttachmentMetadata("application/pdf", 1024)).toBeNull();
    expect(validateProjectCostAttachmentMetadata("image/png", 1024)).toBeNull();
    expect(sanitizeProjectCostAttachmentName("Facture fournisseur été 2026.pdf")).toBe("Facture_fournisseur_ete_2026.pdf");
  });

  it("refuse les formats et tailles non autorisés", () => {
    expect(validateProjectCostAttachmentMetadata("text/plain", 1024)).toContain("PDF");
    expect(validateProjectCostAttachmentMetadata("image/jpeg", 11 * 1024 * 1024)).toContain("10 Mo");
  });
});
