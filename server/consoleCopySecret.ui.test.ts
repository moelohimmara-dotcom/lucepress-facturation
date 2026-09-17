/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard, selectElementText } from "../client/src/lib/clipboard";
import {
  InvitationLinkPanel,
  TemporaryPasswordPanel,
} from "../client/src/components/SystemAccessActions";
import { MfaEnrollSecret } from "../client/src/components/SystemMfaPanels";

/**
 * P0-2 — « COPIÉ » NE SE DIT QUE QUAND LA COPIE A EU LIEU.
 *
 * Le défaut d’origine tenait en deux lignes :
 *
 *     void navigator.clipboard?.writeText(password);
 *     setCopied(true);
 *
 * En contexte non sécurisé (HTTP, iframe sans permission), `navigator.clipboard`
 * est `undefined` : l’appel optionnel ne fait RIEN, et l’écran annonce quand
 * même « Copié ». Sur un mot de passe temporaire affiché une seule fois et sur
 * un lien d’invitation valable 72 heures, c’est un mensonge coûteux : l’opérateur
 * colle ailleurs, obtient autre chose, et le secret est perdu.
 *
 * Ce que ces tests éprouvent, et qu’un test de « chemin heureux » ne verrait pas :
 *  1. l’utilitaire partagé distingue les TROIS cas — copie réussie, rejet de la
 *     promesse, API absente ;
 *  2. les trois écrans qui copient un secret n’affichent « Copié » que sur une
 *     copie RÉELLE, et disent la vérité sinon ;
 *  3. l’échec propose un repli utilisable : la valeur est SÉLECTIONNÉE, prête à
 *     être recopiée à la main ;
 *  4. la logique de copie n’existe qu’une fois — les écrans ne parlent plus au
 *     presse-papiers directement.
 */

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, writable: true, value });
}

afterEach(() => {
  cleanup();
  setClipboard(undefined);
  vi.restoreAllMocks();
});

const motDePasse = "Kt7mNpQrXbVzW2Yd";
const lien = "https://lucepres.gn/invitation?token=jeton-de-test";

/* ------------------------------------------------------------------ */
/* 1. L’utilitaire partagé — trois issues, aucune exception            */
/* ------------------------------------------------------------------ */

describe("Utilitaire de copie — le résultat réel, jamais supposé", () => {
  it("rend « copied » quand le presse-papiers a accepté le texte", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });

    await expect(copyTextToClipboard("secret")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("secret");
  });

  it("rend « failed » quand le presse-papiers REJETTE la promesse", async () => {
    // Cas réel : contexte non sécurisé, iframe sans permission, refus utilisateur.
    setClipboard({ writeText: vi.fn(async () => Promise.reject(new Error("NotAllowedError"))) });

    await expect(copyTextToClipboard("secret")).resolves.toBe("failed");
  });

  it("rend « failed » quand l’API est ABSENTE — le cas exact du P0-2", async () => {
    setClipboard(undefined);

    // Aucune exception ne doit sortir : l’appelant décide de ce qu’il affiche.
    await expect(copyTextToClipboard("secret")).resolves.toBe("failed");
  });

  it("rend « failed » quand writeText n’est pas une fonction", async () => {
    setClipboard({ writeText: "pas-une-fonction" });

    await expect(copyTextToClipboard("secret")).resolves.toBe("failed");
  });

  it("sélectionne le contenu d’un élément non saisissable, pour la recopie manuelle", () => {
    const bloc = document.createElement("code");
    bloc.textContent = motDePasse;
    document.body.appendChild(bloc);

    expect(selectElementText(bloc)).toBe(true);
    expect(window.getSelection()?.toString()).toBe(motDePasse);

    bloc.remove();
  });

  it("sélectionne un champ en lecture seule, et ne casse pas sur une cible absente", () => {
    const champ = document.createElement("input");
    champ.readOnly = true;
    champ.value = lien;
    document.body.appendChild(champ);

    expect(selectElementText(champ)).toBe(true);
    expect(champ.selectionStart).toBe(0);
    expect(champ.selectionEnd).toBe(lien.length);

    champ.remove();
    expect(selectElementText(null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Mot de passe temporaire — le secret perdu si l’écran mentait     */
/* ------------------------------------------------------------------ */

describe("Mot de passe temporaire — « Copié » seulement si c’est copié", () => {
  it("affiche « Copié » quand la copie a réellement eu lieu", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });

    render(createElement(TemporaryPasswordPanel, { accountLabel: "Aïssatou Bah", password: motDePasse, onDone: () => undefined }));
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copié" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(motDePasse);
    expect(screen.queryByTestId("temporary-password-copy-fallback")).toBeNull();
  });

  it("NE DIT PAS « Copié » quand le presse-papiers rejette, et le dit honnêtement", async () => {
    setClipboard({ writeText: vi.fn(async () => Promise.reject(new Error("NotAllowedError"))) });

    render(createElement(TemporaryPasswordPanel, { accountLabel: "Aïssatou Bah", password: motDePasse, onDone: () => undefined }));
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    const repli = await screen.findByTestId("temporary-password-copy-fallback");
    expect(repli.textContent).toContain("Copie impossible");
    // Le mot de passe reste affiché, et le bouton reste « Copier » : on peut réessayer.
    expect(screen.getByTestId("temporary-password-value").textContent).toContain(motDePasse);
    expect(screen.getByRole("button", { name: "Copier" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copié" })).toBeNull();
    // Le repli est utilisable : le secret est SÉLECTIONNÉ pour être recopié.
    expect(window.getSelection()?.toString()).toContain(motDePasse);
  });

  it("NE DIT PAS « Copié » quand le presse-papiers est absent (contexte non sécurisé)", async () => {
    setClipboard(undefined);

    render(createElement(TemporaryPasswordPanel, { accountLabel: "Aïssatou Bah", password: motDePasse, onDone: () => undefined }));
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    expect((await screen.findByTestId("temporary-password-copy-fallback")).textContent).toContain("Copie impossible");
    expect(screen.queryByRole("button", { name: "Copié" })).toBeNull();
  });

  it("revient à « Copier » quand une NOUVELLE valeur est affichée", async () => {
    setClipboard({ writeText: vi.fn(async () => undefined) });

    const { rerender } = render(
      createElement(TemporaryPasswordPanel, { accountLabel: "Aïssatou Bah", password: motDePasse, onDone: () => undefined }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copié" })).toBeTruthy());

    // Un second mot de passe n’est pas « déjà copié » : l’état ne suit pas la valeur.
    rerender(createElement(TemporaryPasswordPanel, { accountLabel: "Aïssatou Bah", password: "Nw9Zx8Cv7Bn6Ma5S", onDone: () => undefined }));
    expect(screen.getByRole("button", { name: "Copier" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copié" })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 3. Lien d’invitation — même mensonge, même correction               */
/* ------------------------------------------------------------------ */

describe("Lien d’invitation — « Copié » seulement si c’est copié", () => {
  const props = {
    email: "invite@lucepres.gn",
    link: lien,
    emailed: true,
    smtpConfigured: true,
    onDone: () => undefined,
  };

  it("affiche « Copié » quand la copie a eu lieu", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });

    render(createElement(InvitationLinkPanel, props));
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copié" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(lien);
  });

  it("NE DIT PAS « Copié » quand la copie échoue, et sélectionne le champ du lien", async () => {
    setClipboard(undefined);

    render(createElement(InvitationLinkPanel, props));
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    expect((await screen.findByTestId("invitation-link-copy-fallback")).textContent).toContain("Copie impossible");
    expect(screen.queryByRole("button", { name: "Copié" })).toBeNull();

    // Le champ est en lecture seule : le repli le sélectionne pour une copie manuelle.
    const champ = screen.getByTestId("invitation-link-value") as HTMLInputElement;
    expect(champ.readOnly).toBe(true);
    expect(champ.selectionStart).toBe(0);
    expect(champ.selectionEnd).toBe(lien.length);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Enrôlement MFA — le troisième usage converge sur le même bouton  */
/* ------------------------------------------------------------------ */

describe("Secret TOTP — le même bouton, la même honnêteté", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  function renderSecret() {
    return render(
      createElement(MfaEnrollSecret, {
        secret,
        otpauthUri: `otpauth://totp/Lucepres?secret=${secret}`,
        account: "systeme@lucepres.gn",
        code: "123456",
        onCodeChange: () => undefined,
        onSubmit: () => undefined,
        pending: false,
        error: null,
      }),
    );
  }

  it("copie le secret BRUT — pas sa présentation par groupes de quatre", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });

    renderSecret();
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copié" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(secret);
  });

  it("NE DIT PAS « Copié » quand la copie échoue, et sélectionne le secret affiché", async () => {
    setClipboard(undefined);

    renderSecret();
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    expect((await screen.findByTestId("mfa-secret-copy-fallback")).textContent).toContain("Copie impossible");
    expect(screen.queryByRole("button", { name: "Copié" })).toBeNull();
    expect(window.getSelection()?.toString()).toContain("GEZD GNBV");
  });
});

/* ------------------------------------------------------------------ */
/* 5. La logique n’existe qu’une fois                                  */
/* ------------------------------------------------------------------ */

describe("Une seule implémentation de la copie dans la console", () => {
  const lire = (chemin: string) => readFileSync(resolve(process.cwd(), chemin), "utf8");

  it("les écrans ne parlent plus au presse-papiers — ils passent par l’utilitaire", () => {
    for (const fichier of [
      "client/src/components/SystemAccessActions.tsx",
      "client/src/components/SystemMfa.tsx",
      "client/src/components/SystemMfaPanels.tsx",
    ]) {
      const source = lire(fichier);
      expect({ fichier, navigatorClipboard: source.includes("navigator.clipboard") }).toEqual({
        fichier,
        navigatorClipboard: false,
      });
      expect({ fichier, boutonPartage: source.includes("CopyButton") }).toEqual({ fichier, boutonPartage: true });
    }
  });

  it("l’ancien état local « copied » de l’enrôlement MFA a disparu", () => {
    const source = lire("client/src/components/SystemMfa.tsx");
    expect(source).not.toContain("setCopied");
    expect(source).not.toContain("copySecret");
  });

  it("seul l’utilitaire partagé touche `navigator.clipboard`", () => {
    // Le composant partagé et son utilitaire sont les deux seuls fichiers qui
    // connaissent l’API ; le reste passe par le bouton.
    expect(lire("client/src/lib/clipboard.ts")).toContain("navigator.clipboard");
    expect(lire("client/src/components/CopyButton.tsx")).not.toContain("navigator.clipboard");
  });
});
