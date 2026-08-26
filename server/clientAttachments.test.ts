import { describe, expect, it } from "vitest";
import { sanitizeClientAttachmentName, validateClientAttachmentMetadata } from "../shared/clientAttachments";

describe("métadonnées de pièces jointes client", () => {
  it("accepte un PDF dans la limite de taille et normalise son nom", () => {
    expect(validateClientAttachmentMetadata("application/pdf", 1024)).toBeNull();
    expect(sanitizeClientAttachmentName("Contrat signé – Kankan.pdf")).toBe("Contrat_signe_Kankan.pdf");
  });

  it("bloque les formats non autorisés et les fichiers trop lourds", () => {
    expect(validateClientAttachmentMetadata("application/x-msdownload", 1024)).toBe("Type de fichier non autorisé.");
    expect(validateClientAttachmentMetadata("application/pdf", 21 * 1024 * 1024)).toBe("Le fichier dépasse la limite de 20 Mo.");
  });
});
