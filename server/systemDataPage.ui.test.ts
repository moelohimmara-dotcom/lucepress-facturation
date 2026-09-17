/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemDataPanel, selectionSignature, type ConsoleDemoCandidates } from "@/components/SystemData";

/**
 * L’ÉCRAN `/console/donnees` — RENDU ET MANIPULÉ POUR DE VRAI.
 *
 * Deux séries de preuves, et elles ne se remplacent pas :
 *
 *  1. LE RENDU STATIQUE du panneau, monté seul, sans routeur et sans réseau. Ce
 *     que la console MONTRE : les volumes, les motifs de chaque candidat, les
 *     clients écartés et leur raison, la phrase à recopier, le bandeau « les
 *     suppressions sont journalisées ».
 *  2. LE CÂBLAGE DE LA PAGE, tRPC doublé : que « Exporter » appelle bien la
 *     procédure et produise un téléchargement, que « Supprimer la sélection »
 *     soit INERTE tant que l’export n’a pas eu lieu, qu’il exige la recopie
 *     exacte de la phrase, et qu’il redevienne inerte dès que la sélection
 *     change — parce que le jeton ne couvrirait plus le bon périmètre.
 *
 * Le double tRPC n’est pas complaisant : il rend exactement ce que le serveur
 * rend, y compris un refus.
 */

const mocks = vi.hoisted(() => {
  return {
    noop: () => undefined,
    calls: [] as Array<{ procedure: string; input: unknown }>,
    refetchOverview: 0,
    refetchCandidates: 0,
    exportError: null as string | null,
    purgeError: null as string | null,
    token: "v1.charge-utile.signature",
    overview: {
      generatedAt: "2026-09-17T09:00:00.000Z",
      scope: "instance" as const,
      database: { sizeBytes: 2_097_152 },
      volumes: [
        { key: "accounts", label: "Comptes", table: "users", count: 4 },
        { key: "clients", label: "Clients", table: "clients", count: 7 },
        { key: "documents", label: "Documents (devis et factures)", table: "documents", count: 23 },
        { key: "documentLines", label: "Lignes de document", table: "document_lines", count: 51 },
        { key: "payments", label: "Paiements", table: "payments", count: 9 },
        { key: "paymentPromises", label: "Promesses de paiement", table: "payment_promises", count: null },
        { key: "agentDelegations", label: "Délégations d’agent", table: "agent_delegations", count: 1 },
        { key: "agentMessageJobs", label: "Tâches d’agent préparées", table: "agent_message_jobs", count: 6 },
        { key: "clientActivities", label: "Activités client", table: "client_activities", count: 31 },
      ],
      documentsByStatus: [
        { status: "brouillon", label: "Brouillon", count: 4 },
        { status: "paye", label: "Payé", count: 3 },
      ],
      unavailable: ["databaseSize"],
    },
    candidates: {
      generatedAt: "2026-09-17T09:00:00.000Z",
      scope: "tenant" as const,
      rules: [
        {
          key: "mot_de_test",
          label: "Mot « test » (mot entier)",
          pattern: "(^|[^a-z0-9])tests?([^a-z0-9]|$)",
          fields: ["companyName", "contactName", "email"],
          explanation: "Le nom contient « test » comme mot séparé.",
        },
        {
          key: "domaine_example",
          label: "Domaine example.* (RFC 2606)",
          pattern: "(^|\\.)example\\.[a-z]{2,}$",
          fields: ["email"],
          explanation: "Ces domaines sont réservés à la documentation.",
        },
      ],
      candidates: [
        {
          clientId: 1,
          companyName: "Test SARL",
          contactName: "Service test",
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
            {
              matcher: "domaine_example",
              field: "email",
              label: "Domaine example.* (RFC 2606)",
              pattern: "(^|\\.)example\\.[a-z]{2,}$",
              value: "facturation@example.com",
              matched: "example.com",
            },
          ],
          counts: { documents: 2, documentLines: 5, payments: 1, paymentPromises: 1, shareLinks: 1, activities: 3, attachments: 0 },
          totalRecords: 14,
          blockedReason: null,
        },
        {
          clientId: 2,
          companyName: "Client démo",
          contactName: null,
          email: "contact@lucepress.test",
          motifs: [
            {
              matcher: "mot_de_demo",
              field: "companyName",
              label: "Mot « demo » ou « démo » (mot entier)",
              pattern: "(^|[^a-z0-9])demos?([^a-z0-9]|$)",
              value: "Client démo",
              matched: "Mot « demo » ou « démo » (mot entier)",
            },
          ],
          counts: { documents: 0, documentLines: 0, payments: 0, paymentPromises: 0, shareLinks: 0, activities: 0, attachments: 0 },
          totalRecords: 1,
          blockedReason: null,
        },
      ],
      excluded: [
        {
          clientId: 4,
          companyName: "Chantier test bloqué",
          motifs: [
            {
              matcher: "mot_de_test",
              field: "companyName",
              label: "Mot « test » (mot entier)",
              pattern: "(^|[^a-z0-9])tests?([^a-z0-9]|$)",
              value: "Chantier test bloqué",
              matched: "Mot « test » (mot entier)",
            },
          ],
          reason: "1 chantier(s) rattaché(s) à ce client : un chantier n’est pas une donnée de recette.",
        },
      ],
      totalRecords: 15,
      unavailable: [],
    },
  };
});

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: unknown }) => createElement("div", null, children),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/console/donnees", mocks.noop] }));

vi.mock("@/lib/trpc", () => {
  const mutation = (procedure: string, result: (input: unknown) => unknown) => (options: {
    onSuccess?: (value: never) => void;
    onError?: (error: { message: string }) => void;
    onSettled?: () => void;
  }) => ({
    isPending: false,
    mutate: (input: unknown) => {
      mocks.calls.push({ procedure, input });
      const erreur = procedure === "system.data.export" ? mocks.exportError : procedure === "system.data.purge" ? mocks.purgeError : null;
      if (erreur) {
        options?.onError?.({ message: erreur });
      } else {
        options?.onSuccess?.(result(input) as never);
      }
      options?.onSettled?.();
    },
  });

  return {
    trpc: {
      system: {
        data: {
          overview: {
            useQuery: () => ({
              data: mocks.overview,
              isLoading: false,
              error: null,
              refetch: () => {
                mocks.refetchOverview += 1;
              },
            }),
          },
          demoCandidates: {
            useQuery: () => ({
              data: mocks.candidates,
              isLoading: false,
              error: null,
              refetch: () => {
                mocks.refetchCandidates += 1;
              },
            }),
          },
          export: {
            // Le double RÉPOND à la demande au lieu de rendre une réponse fixe :
            // il compte comme le serveur compterait, pour les clients demandés.
            useMutation: mutation("system.data.export", (input: unknown) => {
              const clientIds = (input as { clientIds: number[] }).clientIds;
              const totalRecords = clientIds.reduce((total, id) => total + (id === 1 ? 14 : 1), 0);
              return {
                generatedAt: "2026-09-17T09:00:00.000Z",
                filename: "lucepress-donnees-demonstration-2026-09-17.json",
                contentType: "application/json; charset=utf-8",
                content: JSON.stringify({ version: 1, totals: { records: totalRecords } }),
                totalRecords,
                clientIds,
                counts: [{ label: "Documents", count: 2 }],
                token: mocks.token,
                tokenExpiresAt: "2026-09-17T09:10:00.000Z",
              };
            }),
          },
          purge: {
            useMutation: mutation("system.data.purge", () => ({
              clientIds: [1],
              totalRecords: 14,
              deleted: [{ table: "clients", label: "Clients", count: 1 }],
              purgedAt: "2026-09-17T09:05:00.000Z",
            })),
          },
        },
      },
    },
  };
});

async function renderPage() {
  const { default: SystemDataPage } = await import("../client/src/pages/SystemDataPage");
  render(createElement(SystemDataPage));
}

/** Téléchargements observés : le nom du fichier, et le contenu réellement remis. */
let downloads: Array<{ filename: string; blob: unknown }> = [];

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.refetchOverview = 0;
  mocks.refetchCandidates = 0;
  mocks.exportError = null;
  mocks.purgeError = null;
  downloads = [];
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: unknown) => {
      downloads.push({ filename: "", blob });
      return "blob:test";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: mocks.noop });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    // Le fichier est nommé par le serveur : on relève ce que le navigateur aurait reçu.
    if (downloads.length > 0) downloads[downloads.length - 1].filename = this.download;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* 1. Rendu statique du panneau — sans routeur, sans réseau            */
/* ------------------------------------------------------------------ */

describe("Panneau « Données » — ce que l’écran montre", () => {
  const candidats = mocks.candidates as unknown as ConsoleDemoCandidates;

  function renderPanel(overrides: Partial<Parameters<typeof SystemDataPanel>[0]> = {}) {
    return render(
      createElement(SystemDataPanel, {
        overview: mocks.overview,
        isLoadingOverview: false,
        candidates: candidats,
        isLoadingCandidates: false,
        failed: false,
        onExport: mocks.noop,
        isExporting: false,
        lastExport: null,
        onPurge: mocks.noop,
        isPurging: false,
        notice: null,
        ...overrides,
      }),
    );
  }

  it("affiche les volumes, la taille de la base et la répartition par statut", () => {
    renderPanel();

    expect(screen.getByTestId("system-data")).toBeTruthy();
    expect(screen.getByTestId("data-volume-clients").textContent).toContain("7");
    expect(screen.getByTestId("data-volume-documents").textContent).toContain("23");
    expect(screen.getByTestId("data-status-paye").textContent).toContain("3");
    // La taille de la base est formatée en français : 2 097 152 octets = 2 Mo.
    expect(screen.getByText("2 Mo")).toBeTruthy();
    // Une mesure indisponible le DIT, plutôt que d’afficher un zéro.
    expect(screen.getByTestId("data-volume-paymentPromises").textContent).toContain("indisponible");
  });

  it("affiche chaque candidat avec SON motif, sans exception", () => {
    renderPanel();

    const premier = screen.getByTestId("data-candidate-1");
    expect(premier.textContent).toContain("Test SARL");
    expect(premier.textContent).toContain("14");
    const motifs = screen.getByTestId("data-candidate-motifs-1");
    // Un motif par déclencheur, avec son libellé, son champ et son expression.
    expect(within(motifs).getByText("Mot « test » (mot entier)")).toBeTruthy();
    expect(within(motifs).getByText("Domaine example.* (RFC 2606)")).toBeTruthy();
    expect(within(motifs).getByText("Raison sociale")).toBeTruthy();
    expect(within(motifs).getByText("Adresse e-mail")).toBeTruthy();
    // Le détail de ce qui disparaîtrait est lisible sur la ligne.
    expect(premier.textContent).toContain("2 documents");
    expect(premier.textContent).toContain("5 lignes");

    expect(screen.getByTestId("data-candidate-motifs-2").textContent).toContain("Mot « demo »");
  });

  it("affiche les clients ÉCARTÉS avec la raison, sans les mêler aux candidats", () => {
    renderPanel();

    const ecartes = screen.getByTestId("data-excluded");
    expect(ecartes.textContent).toContain("Chantier test bloqué");
    expect(ecartes.textContent).toContain("chantier");
    // Le client écarté n’est pas une case à cocher : il ne peut pas être purgé.
    expect(screen.queryByTestId("data-candidate-4")).toBeNull();
  });

  it("publie la règle de sélection appliquée", () => {
    renderPanel();

    const regles = screen.getByTestId("data-rules");
    expect(regles.textContent).toContain("Mot « test » (mot entier)");
    expect(regles.textContent).toContain("(^|[^a-z0-9])tests?([^a-z0-9]|$)");
    expect(regles.textContent).toContain("example");
    expect(screen.getByText(/heuristique silencieuse/)).toBeTruthy();
  });

  it("porte le bandeau « les suppressions sont journalisées », en clair", () => {
    renderPanel();
    // Deux fois : l’avertissement en tête et le rappel au-dessus des boutons.
    expect(screen.getAllByText(/Les suppressions sont journalisées/).length).toBeGreaterThanOrEqual(2);
    // Et la promesse de périmètre : comptes, paramètres et intégrations intacts.
    expect(screen.getByText(/ne sont jamais/)).toBeTruthy();
  });

  it("laisse « Supprimer la sélection » INERTE tant qu’aucun export n’a eu lieu", () => {
    renderPanel();

    const supprimer = screen.getByTestId("data-purge") as HTMLButtonElement;
    expect(supprimer.disabled).toBe(true);
    expect(screen.getByText(/Inerte tant que l’export préalable/)).toBeTruthy();
    // Et « Exporter » l’est aussi tant que rien n’est sélectionné.
    expect((screen.getByTestId("data-export") as HTMLButtonElement).disabled).toBe(true);
  });

  it("sélectionne une ligne, calcule le total et n’ouvre la purge qu’après export", () => {
    const exports: number[][] = [];
    renderPanel({ onExport: clientIds => exports.push(clientIds) });

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    expect((screen.getByTestId("data-export") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByText(/14 enregistrement\(s\)/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("data-export"));
    expect(exports).toEqual([[1]]);
    // Sans export enregistré, la purge reste fermée même avec une sélection.
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(true);
  });

  it("n’ouvre la confirmation qu’après un export du périmètre COURANT", () => {
    const purgees: Array<{ clientIds: number[]; confirmation: string }> = [];
    renderPanel({
      lastExport: {
        generatedAt: "2026-09-17T09:00:00.000Z",
        filename: "export.json",
        contentType: "application/json",
        content: "{}",
        totalRecords: 14,
        clientIds: [1],
        counts: [{ label: "Documents", count: 2 }],
        token: mocks.token,
        tokenExpiresAt: "2026-09-17T09:10:00.000Z",
      },
      onPurge: input => purgees.push(input),
    });

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    fireEvent.click(screen.getByTestId("data-purge"));

    // La phrase affichée est celle que le serveur exige, au nombre près.
    expect(screen.getByTestId("data-purge-phrase").textContent).toBe("SUPPRIMER 14 ENREGISTREMENTS");
    const valider = screen.getByTestId("data-purge-submit") as HTMLButtonElement;
    expect(valider.disabled).toBe(true);

    // Phrase approchante : refusée.
    fireEvent.change(screen.getByTestId("data-purge-confirm-input"), { target: { value: "SUPPRIMER 15 ENREGISTREMENTS" } });
    expect((screen.getByTestId("data-purge-submit") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("data-purge-submit"));
    expect(purgees).toEqual([]);

    // Phrase exacte : le geste part, avec le jeton de l’export.
    fireEvent.change(screen.getByTestId("data-purge-confirm-input"), { target: { value: "SUPPRIMER 14 ENREGISTREMENTS" } });
    fireEvent.click(screen.getByTestId("data-purge-submit"));
    expect(purgees).toEqual([{ clientIds: [1], confirmation: "SUPPRIMER 14 ENREGISTREMENTS", exportToken: mocks.token }]);
  });

  it("referme la purge dès que la sélection change : le jeton ne couvre plus le périmètre", () => {
    renderPanel({
      lastExport: {
        generatedAt: "2026-09-17T09:00:00.000Z",
        filename: "export.json",
        contentType: "application/json",
        content: "{}",
        totalRecords: 14,
        clientIds: [1],
        counts: [],
        token: mocks.token,
        tokenExpiresAt: "2026-09-17T09:10:00.000Z",
      },
    });

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(false);

    // Une case de plus : l’export porte sur [1], la sélection sur [1, 2].
    fireEvent.click(screen.getByTestId("data-candidate-check-2"));
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Export caduc : la sélection a changé/)).toBeTruthy();
  });

  it("affiche le refus du serveur tel quel, sans casser l’écran", () => {
    renderPanel({ notice: { tone: "error", message: "Suppression refusée — Le jeton d’export a expiré (dix minutes)." } });
    expect(screen.getByTestId("data-notice").textContent).toContain("expiré");
    expect(screen.getByTestId("data-candidate-1")).toBeTruthy();
  });

  it("n’invente aucun candidat quand l’inventaire est illisible", () => {
    renderPanel({ candidates: { ...candidats, candidates: [], excluded: [], totalRecords: null, unavailable: ["candidates"] } });
    expect(screen.getByText(/Inventaire indisponible/)).toBeTruthy();
    expect(screen.queryByTestId("data-candidate-1")).toBeNull();
    expect(screen.getByText(/Candidats à la purge/)).toBeTruthy();
  });

  it("dit qu’il n’y a rien à purger quand aucun client ne porte de motif", () => {
    renderPanel({ candidates: { ...candidats, candidates: [], excluded: [], totalRecords: 0, unavailable: [] } });
    expect(screen.getByText(/Aucun client ne porte de motif de donnée de recette/)).toBeTruthy();
  });

  it("la signature de sélection ignore l’ordre et les doublons", () => {
    expect(selectionSignature([2, 1, 2])).toBe("1,2");
    expect(selectionSignature([1, 2])).toBe(selectionSignature([2, 1]));
    expect(selectionSignature([])).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Câblage de la page                                               */
/* ------------------------------------------------------------------ */

describe("Page /console/donnees — le geste complet", () => {
  it("affiche l’écran et n’appelle AUCUNE procédure tant que rien n’est cliqué", async () => {
    await renderPage();

    expect(screen.getByTestId("system-data")).toBeTruthy();
    // Le titre de l’écran (le rail de modules porte le même mot, d’où le rôle).
    expect(screen.getByRole("heading", { name: "Données", level: 2 })).toBeTruthy();
    expect(screen.getByTestId("data-candidate-1")).toBeTruthy();
    expect(mocks.calls).toEqual([]);
  });

  it("exporte la sélection, TÉLÉCHARGE le fichier et garde le jeton", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    fireEvent.click(screen.getByTestId("data-export"));

    await waitFor(() => expect(mocks.calls).toEqual([{ procedure: "system.data.export", input: { clientIds: [1] } }]));

    // Le fichier est écrit sous le nom rendu par le serveur, avec son contenu.
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].filename).toBe("lucepress-donnees-demonstration-2026-09-17.json");
    expect((downloads[0].blob as Blob).type).toBe("application/json; charset=utf-8");
    expect(await (downloads[0].blob as Blob).text()).toContain('"records":14');

    // L’export est CONSERVÉ à l’écran, et la purge est déverrouillée pour ce périmètre.
    await waitFor(() => expect(screen.getByTestId("data-export-summary")).toBeTruthy());
    expect(screen.getByTestId("data-export-summary").textContent).toContain("Export préalable enregistré");
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(false);

    // La liste est relue : l’écran ne reste pas sur un état d’avant le geste.
    expect(mocks.refetchCandidates).toBeGreaterThan(0);
  });

  it("purge la sélection après export ET recopie exacte de la phrase", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    fireEvent.click(screen.getByTestId("data-export"));
    await waitFor(() => expect(screen.getByTestId("data-export-summary")).toBeTruthy());

    fireEvent.click(screen.getByTestId("data-purge"));
    fireEvent.change(screen.getByTestId("data-purge-confirm-input"), { target: { value: "SUPPRIMER 14 ENREGISTREMENTS" } });
    fireEvent.click(screen.getByTestId("data-purge-submit"));

    await waitFor(() =>
      expect(mocks.calls).toEqual([
        { procedure: "system.data.export", input: { clientIds: [1] } },
        { procedure: "system.data.purge", input: { clientIds: [1], confirmation: "SUPPRIMER 14 ENREGISTREMENTS", exportToken: mocks.token } },
      ]),
    );
    await waitFor(() => expect(screen.getByTestId("data-notice").textContent).toContain("journalisées"));
    // Après une purge réussie, l’export est consommé : le filet ne resservira pas.
    await waitFor(() => expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(true));
  });

  it("n’appelle PAS la purge tant que l’export n’a pas eu lieu", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    fireEvent.click(screen.getByTestId("data-purge"));

    // Le bouton est inerte : aucune boîte, aucun appel.
    expect(screen.queryByTestId("data-purge-dialog")).toBeNull();
    expect(mocks.calls).toEqual([]);
  });

  it("affiche le refus d’export sans laisser croire que le filet existe", async () => {
    mocks.exportError = "L’inventaire des données n’a pas pu être lu : la base n’a pas répondu.";
    await renderPage();

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    fireEvent.click(screen.getByTestId("data-export"));

    await waitFor(() => expect(screen.getByTestId("data-notice").textContent).toContain("Export refusé"));
    expect(screen.getByTestId("data-notice").textContent).toContain("la base n’a pas répondu");
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(true);
    expect(downloads).toEqual([]);
  });

  it("affiche le refus de purge et relit l’inventaire", async () => {
    mocks.purgeError = "La phrase de confirmation ne correspond pas à la sélection : 14 enregistrement(s) sont concernés.";
    await renderPage();

    fireEvent.click(screen.getByTestId("data-candidate-check-1"));
    fireEvent.click(screen.getByTestId("data-export"));
    await waitFor(() => expect(screen.getByTestId("data-export-summary")).toBeTruthy());

    fireEvent.click(screen.getByTestId("data-purge"));
    fireEvent.change(screen.getByTestId("data-purge-confirm-input"), { target: { value: "SUPPRIMER 14 ENREGISTREMENTS" } });
    fireEvent.click(screen.getByTestId("data-purge-submit"));

    await waitFor(() => expect(screen.getByTestId("data-notice").textContent).toContain("Suppression refusée"));
    expect(screen.getByTestId("data-notice").textContent).toContain("14 enregistrement(s) sont concernés");
    // L’écran reste intact, et l’inventaire est relu.
    expect(screen.getByTestId("data-candidate-1")).toBeTruthy();
    expect(mocks.refetchCandidates).toBeGreaterThan(0);
  });

  it("« Tout sélectionner » porte la phrase sur le total des candidats", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("data-select-all"));
    expect(screen.getAllByText(/15 enregistrement\(s\)/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("data-export"));
    await waitFor(() => expect(screen.getByTestId("data-export-summary")).toBeTruthy());
    expect(mocks.calls[0]).toEqual({ procedure: "system.data.export", input: { clientIds: [1, 2] } });

    // Le périmètre exporté est celui de la sélection : la purge est ouverte, et
    // la phrase à recopier porte le total des DEUX clients (14 + 1).
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId("data-purge"));
    expect(screen.getByTestId("data-purge-phrase").textContent).toBe("SUPPRIMER 15 ENREGISTREMENTS");
  });

  it("« Tout désélectionner » referme le geste et efface la confirmation", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("data-select-all"));
    fireEvent.click(screen.getByTestId("data-export"));
    await waitFor(() => expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByTestId("data-select-none"));
    expect((screen.getByTestId("data-export") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("data-purge") as HTMLButtonElement).disabled).toBe(true);
    // Une sélection vide ne laisse pas de confirmation ouverte derrière elle.
    expect(screen.queryByTestId("data-purge-dialog")).toBeNull();
  });
});
