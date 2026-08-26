import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ClientActivityTimeline from "../client/src/components/ClientActivityTimeline";

describe("ClientActivityTimeline", () => {
  it("affiche l’activité et l’action d’ouverture du document", () => {
    const html = renderToStaticMarkup(createElement(ClientActivityTimeline, { loading: false, onOpenDocument: vi.fn(), activities: [{ id: "document-7", type: "document_genere", title: "Facture FAC-2026-0007 généré", description: "Document envoyé", documentId: 7, createdAt: new Date("2026-08-26") }] }));
    expect(html).toContain("Historique d’activités");
    expect(html).toContain("Facture FAC-2026-0007 généré");
    expect(html).toContain("Ouvrir le document");
  });
});
