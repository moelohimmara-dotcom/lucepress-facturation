/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LA PAGE `/console/acces`, RENDUE ET MANIPULÉE POUR DE VRAI.
 *
 * Ce que les autres fichiers ne peuvent pas prouver : le CÂBLAGE. Que le clic
 * sur « Réinitialiser le mot de passe » ouvre bien la boîte, que la
 * confirmation appelle la procédure, que le mot de passe rendu par le serveur
 * s’affiche une fois, et que la liste est RELUE après chaque écriture — refus
 * compris.
 *
 * tRPC est doublé : aucun réseau, aucune session, aucune base. Le double
 * reproduit exactement le contrat des procédures (voir
 * `server/_core/systemRouter.ts`) et, surtout, il n’est pas complaisant : il
 * rend ce que le vrai serveur rend, y compris un refus.
 */

const mocks = vi.hoisted(() => {
  const noop = () => undefined;
  return {
    noop,
    /** Le mot de passe que le serveur rendrait, une fois. */
    temporaryPassword: "Kt7mNpQrXbVzW2Yd",
    /** Écritures observées, dans l’ordre. */
    calls: [] as Array<{ procedure: string; input: unknown }>,
    refetchAccess: 0,
    refetchInvitations: 0,
    /** Erreur à rendre sur la prochaine réinitialisation, ou `null`. */
    resetError: null as string | null,
    accounts: [
      { id: 1, name: "Admin", email: "admin@lucepres.gn", role: "admin", mfaEnabled: false, lastSignedIn: null, createdAt: null },
      { id: 4, name: "Aïssatou Bah", email: "a.bah@lucepres.gn", role: "cadre", mfaEnabled: false, lastSignedIn: null, createdAt: null },
    ],
  };
});

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: unknown }) => createElement("div", null, children),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/console/acces", mocks.noop] }));

vi.mock("@/lib/trpc", () => {
  const mutation = (procedure: string, result: () => unknown) => (options: {
    onSuccess?: (value: never) => void;
    onError?: (error: { message: string }) => void;
    onSettled?: () => void;
  }) => ({
    isPending: false,
    mutate: (input: unknown) => {
      mocks.calls.push({ procedure, input });
      const erreur = procedure === "system.accounts.resetPassword" ? mocks.resetError : null;
      if (erreur) {
        options?.onError?.({ message: erreur });
      } else {
        options?.onSuccess?.(result() as never);
      }
      options?.onSettled?.();
    },
  });

  return {
    trpc: {
      useUtils: () => ({
        system: { access: { invalidate: mocks.noop }, invitations: { list: { invalidate: mocks.noop } } },
      }),
      system: {
        access: {
          useQuery: () => ({
            data: {
              generatedAt: "2026-09-16T10:00:00.000Z",
              scope: "tenant",
              accounts: mocks.accounts,
              accountsTotal: 2,
              roleCounts: [
                { role: "admin", label: "Administrateur", count: 1 },
                { role: "cadre", label: "Cadre", count: 1 },
              ],
              invitations: { total: 1, byRole: [{ role: "cadre", label: "Cadre", count: 1 }] },
              accessMeans: [],
              passwordPolicy: {
                minLength: 8,
                maxLength: 128,
                hashing: { algorithm: "scrypt", saltBytes: 16, keyBytes: 64, storedFormat: "salt:hash", comparison: "timingSafeEqual", implementation: "server/_core/password.ts" },
                complexity: null,
                resetLinkTtlMinutes: 60,
                protections: [],
                enforcedBy: [],
              },
              unavailable: [],
            },
            isLoading: false,
            error: null,
            refetch: () => {
              mocks.refetchAccess += 1;
            },
          }),
        },
        accounts: {
          create: { useMutation: mutation("system.accounts.create", () => ({ id: 99, openId: "local_neuf" })) },
          rename: { useMutation: mutation("system.accounts.rename", () => ({ userId: 4 })) },
          setRole: { useMutation: mutation("system.accounts.setRole", () => ({ userId: 4, role: "directeur" })) },
          resetPassword: {
            useMutation: mutation("system.accounts.resetPassword", () => ({
              userId: 4,
              role: "cadre",
              temporaryPassword: mocks.temporaryPassword,
            })),
          },
          remove: { useMutation: mutation("system.accounts.remove", () => ({ userId: 4 })) },
        },
        invitations: {
          list: {
            useQuery: () => ({
              data: [
                {
                  id: 7,
                  email: "invite@lucepres.gn",
                  role: "cadre",
                  roleLabel: "Cadre",
                  expiresAt: "2026-09-19T10:00:00.000Z",
                  createdAt: "2026-09-16T10:00:00.000Z",
                  expired: false,
                },
              ],
              isLoading: false,
              error: null,
              refetch: () => {
                mocks.refetchInvitations += 1;
              },
            }),
          },
          issue: { useMutation: mutation("system.invitations.issue", () => ({ email: "invite@lucepres.gn", invitationLink: "https://lucepres.gn/invitation?token=x", emailed: false, smtpConfigured: false })) },
          resend: { useMutation: mutation("system.invitations.resend", () => ({ email: "invite@lucepres.gn", invitationLink: "https://lucepres.gn/invitation?token=y" })) },
          revoke: { useMutation: mutation("system.invitations.revoke", () => ({ id: 7, email: "invite@lucepres.gn" })) },
        },
      },
    },
  };
});

/** La page est importée APRÈS les doubles : elle doit recevoir `@/lib/trpc` doublé. */
async function renderPage() {
  const { default: SystemAccessPage } = await import("../client/src/pages/SystemAccessPage");
  render(createElement(SystemAccessPage));
}

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.refetchAccess = 0;
  mocks.refetchInvitations = 0;
  mocks.resetError = null;
});

afterEach(() => {
  cleanup();
});

describe("Page /console/acces — le geste complet", () => {
  it("affiche les comptes, les commandes et les invitations en attente", async () => {
    await renderPage();

    expect(screen.getByText("Aïssatou Bah")).toBeTruthy();
    expect(screen.getByTestId("access-create-account")).toBeTruthy();
    expect(screen.getByTestId("access-invite")).toBeTruthy();
    expect(screen.getByTestId("reset-password-4")).toBeTruthy();
    expect(screen.getByTestId("remove-account-4")).toBeTruthy();
    expect(screen.getByTestId("access-invitation-7")).toBeTruthy();
  });

  it("n’appelle AUCUNE procédure tant que rien n’est cliqué", async () => {
    await renderPage();
    expect(mocks.calls).toEqual([]);
  });

  it("réinitialise un mot de passe et l’affiche UNE SEULE FOIS", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("reset-password-4"));
    fireEvent.click(screen.getByTestId("reset-password-submit"));

    await waitFor(() => expect(screen.getByTestId("temporary-password-value")).toBeTruthy());
    expect(screen.getByTestId("temporary-password-value").textContent).toBe(mocks.temporaryPassword);
    expect(screen.getByText(/affiché une seule fois/)).toBeTruthy();
    expect(screen.getByText(/canal sûr/)).toBeTruthy();

    expect(mocks.calls).toEqual([{ procedure: "system.accounts.resetPassword", input: { userId: 4 } }]);

    // La liste est relue après l’écriture : l’écran ne peut pas rester sur un
    // état d’avant le geste.
    expect(mocks.refetchAccess).toBeGreaterThan(0);
    expect(mocks.refetchInvitations).toBeGreaterThan(0);

    // Fermer la fenêtre efface le mot de passe : il n’est plus dans le document.
    fireEvent.click(screen.getByTestId("temporary-password-done"));
    await waitFor(() => expect(screen.queryByTestId("temporary-password-value")).toBeNull());
  });

  it("affiche le refus du serveur sans casser l’écran, et relit quand même", async () => {
    mocks.resetError = "Impossible de retirer le dernier compte d’administration système de l’instance.";
    await renderPage();

    fireEvent.click(screen.getByTestId("reset-password-4"));
    fireEvent.click(screen.getByTestId("reset-password-submit"));

    await waitFor(() => expect(screen.getByTestId("access-dialog-error")).toBeTruthy());
    expect(screen.getByTestId("access-dialog-error").textContent).toContain("dernier compte d’administration système");
    // Aucun mot de passe n’est affiché : le refus n’a rien produit.
    expect(screen.queryByTestId("temporary-password-value")).toBeNull();
    // L’écran est intact et relu.
    expect(screen.getByTestId("access-account-4")).toBeTruthy();
    expect(mocks.refetchAccess).toBeGreaterThan(0);
  });

  it("n’autorise une suppression qu’après recopie exacte de l’adresse", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("remove-account-4"));
    const bouton = screen.getByTestId("remove-account-submit") as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("remove-account-confirm-input"), { target: { value: "admin@lucepres.gn" } });
    expect(bouton.disabled).toBe(true);
    fireEvent.click(bouton);
    expect(mocks.calls).toEqual([]);

    fireEvent.change(screen.getByTestId("remove-account-confirm-input"), { target: { value: "a.bah@lucepres.gn" } });
    fireEvent.click(bouton);
    await waitFor(() => expect(mocks.calls).toEqual([{ procedure: "system.accounts.remove", input: { userId: 4 } }]));
  });

  it("émet une invitation et montre le lien, sans le journaliser dans l’écran", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("access-invite"));
    fireEvent.change(screen.getByLabelText(/E-mail de la personne/), { target: { value: "invite@lucepres.gn" } });
    fireEvent.click(screen.getByTestId("invite-submit"));

    await waitFor(() => expect(screen.getByTestId("invitation-link-value")).toBeTruthy());
    expect((screen.getByTestId("invitation-link-value") as HTMLInputElement).value).toContain("/invitation?token=");
    expect(screen.getByText(/SMTP non configuré/)).toBeTruthy();
  });

  it("renvoie une invitation directement depuis sa ligne, sans boîte intermédiaire", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("resend-invitation-7"));

    await waitFor(() => expect(mocks.calls).toEqual([{ procedure: "system.invitations.resend", input: { id: 7 } }]));
    await waitFor(() => expect(screen.getByTestId("invitation-link-value")).toBeTruthy());
  });

  it("révoque une invitation après confirmation explicite", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("revoke-invitation-7"));
    expect(mocks.calls).toEqual([]);
    fireEvent.click(screen.getByTestId("revoke-invitation-submit"));

    await waitFor(() => expect(mocks.calls).toEqual([{ procedure: "system.invitations.revoke", input: { id: 7 } }]));
    await waitFor(() => expect(screen.getByTestId("access-notice").textContent).toContain("révoquée"));
  });

  it("change un rôle après confirmation, et pas avant", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("change-role-4"));
    fireEvent.click(screen.getByTestId("role-choice-directeur"));
    expect(mocks.calls).toEqual([]);
    fireEvent.click(screen.getByTestId("change-role-submit"));

    await waitFor(() =>
      expect(mocks.calls).toEqual([{ procedure: "system.accounts.setRole", input: { userId: 4, role: "directeur" } }]),
    );
  });

  it("crée un compte et n’affiche jamais le mot de passe saisi ailleurs que dans le formulaire", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId("access-create-account"));
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "neuf@lucepres.gn" } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: "MotDePasse123" } });
    fireEvent.click(screen.getByTestId("create-account-submit"));

    await waitFor(() =>
      expect(mocks.calls).toEqual([
        { procedure: "system.accounts.create", input: { email: "neuf@lucepres.gn", password: "MotDePasse123", role: "cadre" } },
      ]),
    );
    // Ni le mot de passe, ni une empreinte n’apparaissent dans le rendu. Le mot
    // « scrypt » y figure en revanche légitimement : c’est le nom de l’algorithme
    // publié par la politique de mot de passe, pas un secret.
    expect(document.body.textContent).not.toContain("MotDePasse123");
    expect(document.body.textContent).not.toMatch(/[a-f0-9]{32}:[a-f0-9]{64}/);
    expect(document.body.textContent).toContain("scrypt");
  });
});
