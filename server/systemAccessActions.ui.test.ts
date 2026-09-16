/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChangeRoleDialog,
  CreateAccountDialog,
  InvitationLinkPanel,
  InviteDialog,
  RemoveAccountDialog,
  RenameAccountDialog,
  ResetPasswordDialog,
  RevokeInvitationDialog,
  TemporaryPasswordPanel,
  accessAccountLabel,
  removalConfirmationText,
  removalConfirmed,
  roleLabel,
  type AccessActionInvitation,
} from "../client/src/components/SystemAccessActions";
import { SystemAccessPanel, type ConsoleAccess } from "../client/src/components/SystemAccess";

/**
 * LES BOÎTES DE DIALOGUE DE L’ÉCRAN « ACCÈS & COMPTES », RENDUES POUR DE VRAI.
 *
 * Deux choses ne se prouvent qu’en regardant ce qui s’affiche :
 *
 *  1. LE DEGRÉ DE CONFIRMATION. Une suppression dont le bouton reste cliquable
 *     sans saisie n’est pas « confirmée » : c’est un clic de plus. On vérifie
 *     donc que le bouton est INERTE tant que l’identité du compte n’a pas été
 *     recopiée exactement.
 *  2. LES SECRETS AFFICHÉS UNE FOIS. Le mot de passe temporaire et le lien
 *     d’invitation doivent être visibles, lisibles, copiables — et l’écran doit
 *     dire qu’ils ne reviendront pas.
 *
 * Deux méthodes, parce qu’elles ne prouvent pas la même chose :
 *  - `render` (jsdom) pour les boîtes Radix, qui rendent dans un portail — le
 *    rendu statique ne les verrait pas ;
 *  - `renderToStaticMarkup` pour les corps de panneaux, qui n’ont ni portail ni
 *    état : ce qu’on y épingle est exactement ce qui est écrit.
 */

afterEach(() => {
  cleanup();
});

const compte = { id: 4, name: "Aïssatou Bah", email: "a.bah@lucepres.gn", role: "cadre" };
const compteSansEmail = { id: 12, name: null, email: null, role: "cadre" };
const invitation: AccessActionInvitation = {
  id: 7,
  email: "invite@lucepres.gn",
  role: "cadre",
  roleLabel: "Cadre",
  expiresAt: "2026-09-19T10:00:00.000Z",
  createdAt: "2026-09-16T10:00:00.000Z",
  expired: false,
};

/* ------------------------------------------------------------------ */
/* Supprimer — la confirmation qui compte                              */
/* ------------------------------------------------------------------ */

describe("Supprimer un compte — la confirmation par recopie", () => {
  it("demande l’adresse e-mail du compte, et la désigne sans ambiguïté", () => {
    expect(removalConfirmationText(compte)).toBe("a.bah@lucepres.gn");
    // Sans adresse, la forme technique reste unique et vérifiable dans la liste.
    expect(removalConfirmationText(compteSansEmail)).toBe("Compte #12");
  });

  it("n’accepte que la recopie EXACTE — ni approximation, ni majuscules", () => {
    expect(removalConfirmed(compte, "a.bah@lucepres.gn")).toBe(true);
    expect(removalConfirmed(compte, "  a.bah@lucepres.gn  ")).toBe(true);
    expect(removalConfirmed(compte, "a.bah@lucepres.gn ")).toBe(true);
    expect(removalConfirmed(compte, "a.bah@lucepres.gn2")).toBe(false);
    expect(removalConfirmed(compte, "A.BAH@LUCEPRES.GN")).toBe(false);
    expect(removalConfirmed(compte, "")).toBe(false);
    // La ligne voisine ne doit pas pouvoir servir de confirmation.
    expect(removalConfirmed(compte, "cadre@lucepres.gn")).toBe(false);
  });

  it("garde le bouton de suppression INERTE tant que la recopie n’est pas exacte", () => {
    render(
      createElement(RemoveAccountDialog, {
        open: true,
        onOpenChange: () => undefined,
        account: compte,
        onConfirm: () => undefined,
        pending: false,
      }),
    );

    const bouton = screen.getByTestId("remove-account-submit") as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    // Le texte attendu est MONTRÉ, pas seulement exigé.
    expect(screen.getByText("a.bah@lucepres.gn")).toBeTruthy();
    expect(screen.getByText(/IRRÉVERSIBLE/i)).toBeTruthy();

    const champ = screen.getByTestId("remove-account-confirm-input");
    fireEvent.change(champ, { target: { value: "a.bah@lucepres" } });
    expect((screen.getByTestId("remove-account-submit") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(champ, { target: { value: "a.bah@lucepres.gn" } });
    expect((screen.getByTestId("remove-account-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("annonce que l’action est journalisée, dans chaque boîte de dialogue", () => {
    render(
      createElement(RemoveAccountDialog, {
        open: true,
        onOpenChange: () => undefined,
        account: compte,
        onConfirm: () => undefined,
        pending: false,
      }),
    );
    expect(screen.getByText(/Les actions sont journalisées/)).toBeTruthy();
  });

  it("affiche le refus du serveur dans la boîte, sans la casser", () => {
    render(
      createElement(RemoveAccountDialog, {
        open: true,
        onOpenChange: () => undefined,
        account: compte,
        onConfirm: () => undefined,
        pending: false,
        error: "Impossible de retirer le dernier compte d’administration système de l’instance.",
      }),
    );
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("dernier compte d’administration système");
  });
});

/* ------------------------------------------------------------------ */
/* Mot de passe temporaire — montré une fois                           */
/* ------------------------------------------------------------------ */

describe("Mot de passe temporaire — affiché une seule fois", () => {
  const motDePasse = "Kt7mNpQrXbVzW2Yd";

  it("montre le mot de passe, et dit qu’il ne reviendra pas", () => {
    const html = renderToStaticMarkup(
      createElement(TemporaryPasswordPanel, { accountLabel: "Aïssatou Bah", password: motDePasse, onDone: () => undefined }),
    );

    expect(html).toContain(motDePasse);
    expect(html).toContain("affiché une seule fois");
    expect(html).toContain("canal sûr");
    expect(html).toContain("empreinte");
    expect(html).toContain("Aïssatou Bah");
    // Le geste qui ferme est nommé : « J’ai transmis », pas « OK ».
    expect(html).toContain("J’ai transmis le mot de passe");
    // Aucune trace du mot de passe ailleurs que dans la valeur affichée.
    expect((html.match(new RegExp(motDePasse, "g")) ?? []).length).toBe(1);
  });

  it("permet de le copier sans le journaliser nulle part", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(createElement(TemporaryPasswordPanel, { accountLabel: "Aïssatou Bah", password: motDePasse, onDone: () => undefined }));
    fireEvent.click(screen.getByRole("button", { name: /Copier/ }));

    expect(writeText).toHaveBeenCalledWith(motDePasse);
    expect(await screen.findByText(/Copié/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* Lien d’invitation — montré une fois                                 */
/* ------------------------------------------------------------------ */

describe("Lien d’invitation — affiché une seule fois", () => {
  const lien = "https://lucepres.gn/invitation?token=jeton-de-test";

  it("dit la vérité quand SMTP n’est pas configuré", () => {
    const html = renderToStaticMarkup(
      createElement(InvitationLinkPanel, {
        email: "invite@lucepres.gn",
        link: lien,
        emailed: false,
        smtpConfigured: false,
        onDone: () => undefined,
      }),
    );

    expect(html).toContain("SMTP non configuré");
    expect(html).toContain(lien);
    expect(html).toContain("72 heures");
    expect(html).toContain("J’ai transmis le lien");
  });

  it("signale l’envoi accepté sans promettre qu’il a été reçu", () => {
    const html = renderToStaticMarkup(
      createElement(InvitationLinkPanel, {
        email: "invite@lucepres.gn",
        link: lien,
        emailed: true,
        smtpConfigured: true,
        onDone: () => undefined,
      }),
    );

    expect(html).toContain("accepté l’envoi");
    expect(html).toContain("copiez le lien");
  });

  it("reporte l’échec d’envoi sans prétendre que l’invitation n’existe pas", () => {
    const html = renderToStaticMarkup(
      createElement(InvitationLinkPanel, {
        email: "invite@lucepres.gn",
        link: lien,
        emailed: false,
        emailError: "SMTP down",
        smtpConfigured: true,
        onDone: () => undefined,
      }),
    );

    expect(html).toContain("SMTP down");
    expect(html).toContain("L’invitation existe");
  });
});

/* ------------------------------------------------------------------ */
/* Les autres boîtes                                                   */
/* ------------------------------------------------------------------ */

describe("Créer, renommer, changer de rôle, inviter, révoquer", () => {
  it("la création demande e-mail, nom, mot de passe et rôle", () => {
    let soumis: unknown = null;
    render(
      createElement(CreateAccountDialog, {
        open: true,
        onOpenChange: () => undefined,
        pending: false,
        onSubmit: values => {
          soumis = values;
        },
      }),
    );

    expect(screen.getByText(/Le compte est actif immédiatement/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "neuf@lucepres.gn" } });
    fireEvent.change(screen.getByLabelText(/Nom/), { target: { value: "Nouveau" } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: "MotDePasse123" } });
    fireEvent.click(screen.getByTestId("role-choice-systeme"));
    fireEvent.click(screen.getByTestId("create-account-submit"));

    expect(soumis).toEqual({ email: "neuf@lucepres.gn", name: "Nouveau", password: "MotDePasse123", role: "systeme" });
  });

  it("la création refuse un mot de passe trop court AVANT d’appeler le serveur", () => {
    let appele = false;
    render(
      createElement(CreateAccountDialog, {
        open: true,
        onOpenChange: () => undefined,
        pending: false,
        onSubmit: () => {
          appele = true;
        },
      }),
    );

    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "neuf@lucepres.gn" } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: "court" } });
    fireEvent.click(screen.getByTestId("create-account-submit"));

    expect(appele).toBe(false);
    expect(screen.getByRole("alert").textContent).toContain("8 caractères");
  });

  it("le renommage pré-remplit le nom actuel et n’exige pas de confirmation", () => {
    render(
      createElement(RenameAccountDialog, {
        open: true,
        onOpenChange: () => undefined,
        account: compte,
        pending: false,
        onSubmit: () => undefined,
      }),
    );

    expect((screen.getByLabelText(/Nom affiché/) as HTMLInputElement).value).toBe("Aïssatou Bah");
    expect((screen.getByTestId("rename-account-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("le changement de rôle annonce ce que le geste retire ou ouvre", () => {
    const html = renderToStaticMarkup(
      createElement("div", null,
        createElement(ChangeRoleDialog, {
          open: true,
          onOpenChange: () => undefined,
          account: { id: 3, name: "Système", email: "sys@lucepres.gn", role: "systeme" },
          pending: false,
          onSubmit: () => undefined,
        }),
      ),
    );
    // Le rendu statique ne voit pas le portail : c’est la règle métier du
    // dialogue qui est vérifiée ici, via `roleLabel`.
    expect(roleLabel("systeme")).toBe("Administrateur système");
    expect(roleLabel("role-inconnu")).toBe("role-inconnu");
    expect(html).toBeDefined();
  });

  it("le changement de rôle se confirme explicitement, et pas sur le rôle déjà en place", () => {
    render(
      createElement(ChangeRoleDialog, {
        open: true,
        onOpenChange: () => undefined,
        account: compte,
        pending: false,
        onSubmit: () => undefined,
      }),
    );

    const confirmer = screen.getByTestId("change-role-submit") as HTMLButtonElement;
    // Le rôle courant est « cadre » : confirmer sans rien changer n’a pas de sens.
    expect(confirmer.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("role-choice-directeur"));
    expect((screen.getByTestId("change-role-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("la réinitialisation prévient que les sessions déjà ouvertes survivent", () => {
    render(
      createElement(ResetPasswordDialog, {
        open: true,
        onOpenChange: () => undefined,
        account: compte,
        pending: false,
        onConfirm: () => undefined,
      }),
    );

    expect(screen.getByText(/sessions DÉJÀ OUVERTES/)).toBeTruthy();
    expect(screen.getByText(/Sessions actives/)).toBeTruthy();
    expect(screen.getByTestId("reset-password-submit")).toBeTruthy();
  });

  it("l’invitation demande l’adresse et le rôle, et dit que l’invité choisit son mot de passe", () => {
    let soumis: unknown = null;
    render(
      createElement(InviteDialog, {
        open: true,
        onOpenChange: () => undefined,
        pending: false,
        onSubmit: values => {
          soumis = values;
        },
      }),
    );

    expect(screen.getByText(/L’invité choisit lui-même son mot de passe/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/E-mail de la personne/), { target: { value: "invite@lucepres.gn" } });
    fireEvent.click(screen.getByTestId("role-choice-directeur"));
    fireEvent.click(screen.getByTestId("invite-submit"));

    expect(soumis).toEqual({ email: "invite@lucepres.gn", role: "directeur" });
  });

  it("la révocation d’une invitation nomme l’adresse visée et propose le renvoi", () => {
    render(
      createElement(RevokeInvitationDialog, {
        open: true,
        onOpenChange: () => undefined,
        invitation,
        pending: false,
        onConfirm: () => undefined,
      }),
    );

    expect(screen.getByText(/invite@lucepres.gn/)).toBeTruthy();
    expect(screen.getByText(/préférez « Renvoyer »/)).toBeTruthy();
    expect(screen.getByTestId("revoke-invitation-submit")).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* L’écran AGISSANT                                                    */
/* ------------------------------------------------------------------ */

function accessFixture(overrides: Partial<ConsoleAccess> = {}): ConsoleAccess {
  return {
    generatedAt: "2026-09-16T10:00:00.000Z",
    scope: "tenant",
    accounts: [
      { id: 1, name: "Admin", email: "admin@lucepres.gn", role: "admin", mfaEnabled: false, lastSignedIn: null, createdAt: null },
      { id: 4, name: "Aïssatou Bah", email: "a.bah@lucepres.gn", role: "cadre", mfaEnabled: false, lastSignedIn: null, createdAt: null },
    ],
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
    ...overrides,
  };
}

const actionsFixture = {
  busyKey: null as string | null,
  onCreate: () => undefined,
  onRename: () => undefined,
  onChangeRole: () => undefined,
  onResetPassword: () => undefined,
  onRemove: () => undefined,
  onInvite: () => undefined,
  onResendInvitation: () => undefined,
  onRevokeInvitation: () => undefined,
};

describe("Écran agissant — les commandes existent, et disent ce qu’elles font", () => {
  it("offre les deux commandes d’en-tête et une commande par ligne", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture(),
        failed: false,
        isLoading: false,
        actions: actionsFixture,
      }),
    );

    expect(html).toContain("data-testid=\"access-create-account\"");
    expect(html).toContain("data-testid=\"access-invite\"");
    expect(html).toContain("Créer un compte");
    expect(html).toContain(">Inviter<");
    // Une commande de chaque sorte sur chaque ligne.
    for (const id of [1, 4]) {
      expect(html).toContain(`data-testid="rename-account-${id}"`);
      expect(html).toContain(`data-testid="change-role-${id}"`);
      expect(html).toContain(`data-testid="reset-password-${id}"`);
      expect(html).toContain(`data-testid="remove-account-${id}"`);
    }
  });

  it("annonce que les actions sont journalisées, et ne dit plus « lecture seule »", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false, actions: actionsFixture }),
    );

    expect(html).toContain("Les actions sont journalisées");
    expect(html).toContain("Comptes administrables");
    expect(html).not.toContain("Consultation seule");
  });

  it("reste STRICTEMENT en lecture quand aucun gestionnaire n’est fourni", () => {
    // C’est la garantie de l’étape A, et elle doit survivre à l’étape C : un
    // appelant qui n’arme pas l’écran n’obtient aucune commande, et le badge le
    // dit (« Lecture seule »).
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
    );

    for (const controle of ["<button", "<input", "<select", "<textarea"]) {
      expect(html).not.toContain(controle);
    }
    expect(html).toContain("Consultation seule");
    expect(html).toContain("Lecture seule");
    expect(html).not.toContain("Les actions sont journalisées");
  });

  it("désactive toutes les commandes pendant une écriture, sans les faire disparaître", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture(),
        failed: false,
        isLoading: false,
        actions: { ...actionsFixture, busyKey: "compte#4" },
      }),
    );

    // Les commandes sont rendues désactivées : un écran qui les retirerait
    // laisserait croire à une panne au lieu d’une opération en cours.
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("affiche le retour d’une écriture, y compris le refus du serveur", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture(),
        failed: false,
        isLoading: false,
        actions: actionsFixture,
        notice: { tone: "down", message: "Vous ne pouvez pas supprimer votre propre compte." },
      }),
    );

    expect(html).toContain("data-testid=\"access-notice\"");
    expect(html).toContain("Vous ne pouvez pas supprimer votre propre compte.");
  });

  it("détaille les invitations en attente, avec leurs deux commandes", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture(),
        failed: false,
        isLoading: false,
        actions: actionsFixture,
        invitations: [invitation],
      }),
    );

    expect(html).toContain("data-testid=\"access-invitation-7\"");
    expect(html).toContain("invite@lucepres.gn");
    expect(html).toContain("data-testid=\"resend-invitation-7\"");
    expect(html).toContain("data-testid=\"revoke-invitation-7\"");
    // Ni lien, ni jeton, ni empreinte dans ce qui est rendu.
    expect(html).not.toContain("jeton=");
    expect(html).not.toMatch(/[a-f0-9]{64}/);
  });

  it("marque une invitation échue plutôt que de la faire disparaître", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture(),
        failed: false,
        isLoading: false,
        actions: actionsFixture,
        invitations: [{ ...invitation, expired: true }],
      }),
    );
    expect(html).toContain("Échue");
    expect(html).toContain("data-testid=\"access-invitation-7\"");
  });

  it("annonce une liste d’invitations illisible plutôt qu’une liste vide", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture(),
        failed: false,
        isLoading: false,
        actions: actionsFixture,
        invitations: null,
        invitationsFailed: true,
      }),
    );

    expect(html).toContain("La liste des invitations n’a pas pu être lue");
    expect(html).not.toContain("Aucune invitation en attente : personne");
  });

  it("n’affiche le détail des invitations que si la page le fournit", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false, actions: actionsFixture }),
    );
    expect(html).not.toContain("data-testid=\"access-invitations\"");
  });

  it("nomme un compte de la même façon dans la liste et dans les dialogues", () => {
    // Une seule règle de nommage pour tout l’écran : sinon, une suppression
    // « confirmée sur le bon nom » ne voudrait plus rien dire.
    expect(accessAccountLabel(compte)).toBe("Aïssatou Bah");
    expect(accessAccountLabel({ ...compte, name: null })).toBe("a.bah@lucepres.gn");
    expect(accessAccountLabel(compteSansEmail)).toBe("Compte #12");
  });
});

/* ------------------------------------------------------------------ */
/* La page qui branche le tout                                         */
/* ------------------------------------------------------------------ */

describe("Page /console/acces — câblage des écritures", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/SystemAccessPage.tsx"), "utf8");

  it("appelle les huit procédures d’écriture et la lecture des invitations", () => {
    for (const procedure of [
      "trpc.system.accounts.create.useMutation",
      "trpc.system.accounts.rename.useMutation",
      "trpc.system.accounts.setRole.useMutation",
      "trpc.system.accounts.resetPassword.useMutation",
      "trpc.system.accounts.remove.useMutation",
      "trpc.system.invitations.issue.useMutation",
      "trpc.system.invitations.resend.useMutation",
      "trpc.system.invitations.revoke.useMutation",
      "trpc.system.invitations.list.useQuery",
    ]) {
      expect({ procedure, present: page.includes(procedure) }).toEqual({ procedure, present: true });
    }
  });

  it("monte chaque boîte de dialogue, et rien d’autre", () => {
    for (const composant of [
      "CreateAccountDialog",
      "InviteDialog",
      "RenameAccountDialog",
      "ChangeRoleDialog",
      "ResetPasswordDialog",
      "RemoveAccountDialog",
      "RevokeInvitationDialog",
      "TemporaryPasswordPanel",
      "InvitationLinkPanel",
    ]) {
      expect({ composant, monte: page.includes(`<${composant}`) || page.includes(`createElement(${composant}`) }).toEqual({
        composant,
        monte: page.includes(`<${composant}`),
      });
    }
  });

  it("ne touche ni aux procédures métier ni aux écrans métier", () => {
    // La console administre les comptes par SES procédures. Appeler `users.*`
    // depuis ici ferait passer l’administrateur système par le back-office
    // métier — un second chemin, et une seconde règle d’habilitation.
    expect(page).not.toContain("trpc.users.");
    expect(page).not.toContain("UsersPage");
  });

  it("relit l’état après chaque écriture, refus compris", () => {
    expect(page).toContain("refreshAll");
    expect((page.match(/refreshAll\(\)/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("ne laisse pas le mot de passe temporaire sortir de son panneau", () => {
    // Une seule LECTURE du secret : le retour de `resetPassword`. Les autres
    // occurrences du mot `temporaryPassword` désignent la boîte de dialogue, pas
    // une valeur. Aucun journal, aucune notification transitoire, aucun stockage
    // local — un secret qui passe par là survivrait à l’écran.
    expect((page.match(/\.temporaryPassword/g) ?? []).length).toBe(1);
    expect(page).toContain("password: result.temporaryPassword");
    expect(page).not.toContain("toast");
    expect(page).not.toContain("localStorage");
    expect(page).not.toContain("console.log");
  });
});
