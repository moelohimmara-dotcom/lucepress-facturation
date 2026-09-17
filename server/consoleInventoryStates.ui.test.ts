/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SystemDataPanel, type ConsoleDemoCandidates } from "../client/src/components/SystemData";

/**
 * P0-1 — UN INVENTAIRE NON LU N’EST PAS UN INVENTAIRE VIDE.
 *
 * Quand `system.data.demoCandidates` échoue, `candidates` reste `undefined`. Or
 * l’écran enchaînait :
 *
 *     candidates?.unavailable.length ? … : liste.length === 0 ? "…rien à purger"
 *
 * `undefined` n’est pas vrai, `liste` vaut `[]` : la seconde branche était donc
 * prise, et l’écran affirmait en toutes lettres qu’« il n’y a rien à purger ».
 * C’est une AFFIRMATION FAUSSE — l’inventaire n’a pas été lu, on ne sait rien de
 * ce qu’il contient — et l’opérateur en conclut qu’aucune donnée de recette ne
 * subsiste.
 *
 * Trois états, donc, et pas deux :
 *   - CHARGEMENT : la lecture est en cours, rien n’est conclu ;
 *   - SUCCÈS VIDE : l’inventaire A ÉTÉ LU et il est vide — là, et seulement là,
 *     « rien à purger » est vrai ;
 *   - ÉCHEC / NON LU : l’inventaire est INDÉTERMINÉ — on le dit, et on ne
 *     propose rien : ni sélection, ni export, ni suppression.
 *
 * Le dernier point compte : après une lecture réussie, une sélection peut
 * survivre en mémoire. Si l’inventaire redevient illisible, les identifiants
 * sélectionnés ne sont plus vérifiables à l’écran — aucune action ne doit
 * pouvoir partir avec eux.
 */

const candidats: ConsoleDemoCandidates = {
  generatedAt: "2026-09-17T09:00:00.000Z",
  scope: "tenant",
  rules: [
    {
      key: "mot_de_test",
      label: "Mot « test » (mot entier)",
      pattern: "(^|[^a-z0-9])tests?([^a-z0-9]|$)",
      fields: ["companyName"],
      explanation: "Le nom contient « test » comme mot séparé.",
    },
  ],
  candidates: [
    {
      clientId: 1,
      companyName: "Test SARL",
      contactName: null,
      email: "facturation@example.com",
      motifs: [
        {
          matcher: "mot_de_test",
          field: "companyName",
          label: "Mot « test » (mot entier)",
          pattern: "(^|[^a-z0-9])tests?([^a-z0-9]|$)",
          value: "Test SARL",
          matched: "Mot « test » (mot entier)",
        },
      ],
      counts: { documents: 2, documentLines: 5, payments: 1, paymentPromises: 1, shareLinks: 1, activities: 3, attachments: 0 },
      totalRecords: 14,
      blockedReason: null,
    },
  ],
  excluded: [],
  totalRecords: 14,
  unavailable: [],
};

const overview = {
  generatedAt: "2026-09-17T09:00:00.000Z",
  scope: "instance" as const,
  database: { sizeBytes: 2_097_152 },
  volumes: [],
  documentsByStatus: [],
  unavailable: [],
};

function renderPanel(overrides: Partial<Parameters<typeof SystemDataPanel>[0]> = {}) {
  return render(
    createElement(SystemDataPanel, {
      overview,
      isLoadingOverview: false,
      candidates: candidats,
      isLoadingCandidates: false,
      failed: false,
      onExport: () => undefined,
      isExporting: false,
      lastExport: null,
      onPurge: () => undefined,
      isPurging: false,
      notice: null,
      ...overrides,
    }),
  );
}

afterEach(() => {
  cleanup();
});

describe("P0-1 — l’inventaire non lu ne se lit pas comme un inventaire vide", () => {
  it("annonce un état INDÉTERMINÉ quand la lecture de l’inventaire a échoué", () => {
    renderPanel({ candidates: undefined, failed: true });

    const etat = screen.getByTestId("data-inventory-unreadable");
    expect(etat.textContent).toContain("Impossible de conclure");
    expect(etat.textContent).toContain("n’a pas été lu");
    // Et surtout : l’écran ne prétend JAMAIS qu’il n’y a rien à purger.
    expect(screen.queryByText(/rien à purger/i)).toBeNull();
    expect(screen.queryByText(/Aucun client ne porte de motif/)).toBeNull();
  });

  it("ne propose AUCUNE action quand l’inventaire est indéterminé", () => {
    renderPanel({ candidates: undefined, failed: true });

    // Le bouton de suppression est inerte, et l’écran dit pourquoi.
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("data-export-blocked").textContent).toContain("inventaire");
    // Aucune case à cocher : rien ne peut être désigné.
    expect(screen.queryByTestId("data-candidate-check-1")).toBeNull();
  });

  it("ne peut pas exporter une sélection devenue invérifiable", () => {
    // Une lecture réussie a permis de sélectionner, puis l’inventaire redevient
    // illisible : les identifiants en mémoire ne sont plus à l’écran.
    const onExport = () => {
      throw new Error("l’export ne doit pas partir sur une sélection invérifiable");
    };
    const { rerender } = renderPanel({ onExport });

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    expect((screen.getByTestId("data-export") as HTMLButtonElement).disabled).toBe(false);

    rerender(
      createElement(SystemDataPanel, {
        overview,
        isLoadingOverview: false,
        candidates: undefined,
        isLoadingCandidates: false,
        failed: true,
        onExport,
        isExporting: false,
        lastExport: null,
        onPurge: () => undefined,
        isPurging: false,
        notice: null,
      }),
    );

    expect((screen.getByTestId("data-export") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(true);
    // Le geste ne part même pas si le bouton était forcé.
    expect(() => fireEvent.click(screen.getByTestId("data-export"))).not.toThrow();
  });

  it("distingue le CHARGEMENT de l’échec — et ne conclut ni l’un ni l’autre", () => {
    renderPanel({ candidates: undefined, isLoadingCandidates: true, failed: false });

    expect(screen.getByText(/Inventaire en cours/)).toBeTruthy();
    expect(screen.queryByTestId("data-inventory-unreadable")).toBeNull();
    expect(screen.queryByText(/rien à purger/i)).toBeNull();
  });

  it("dit « rien à purger » UNIQUEMENT quand l’inventaire a été lu et qu’il est vide", () => {
    renderPanel({ candidates: { ...candidats, candidates: [], excluded: [], totalRecords: 0, unavailable: [] } });

    expect(screen.getByText(/Aucun client ne porte de motif de donnée de recette/)).toBeTruthy();
    expect(screen.queryByTestId("data-inventory-unreadable")).toBeNull();
  });

  it("garde l’inventaire à l’écran quand seule la lecture des VOLUMES a échoué", () => {
    // `failed` est global à l’écran : une mesure de volume manquante ne rend pas
    // la liste des candidats inconnue. On ne conclut pas à tort.
    renderPanel({ failed: true });

    expect(screen.getByTestId("data-candidate-1")).toBeTruthy();
    expect(screen.queryByTestId("data-inventory-unreadable")).toBeNull();
  });

  it("conserve le cas « inventaire lu mais illisible » avec son message d’origine", () => {
    renderPanel({ candidates: { ...candidats, candidates: [], excluded: [], totalRecords: null, unavailable: ["candidates"] } });

    expect(screen.getByText(/Inventaire indisponible/)).toBeTruthy();
    expect(screen.queryByTestId("data-inventory-unreadable")).toBeNull();
    expect(screen.queryByText(/rien à purger/i)).toBeNull();
  });
});
