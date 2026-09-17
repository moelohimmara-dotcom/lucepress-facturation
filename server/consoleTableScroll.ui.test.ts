/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SystemAccessPanel, type ConsoleAccess } from "../client/src/components/SystemAccess";
import { SystemPermissionsPanel } from "../client/src/components/SystemPermissions";
import { SystemSessionsPanel, type ConsoleSessions } from "../client/src/components/SystemSessions";

/**
 * P0-3 — LES ACTIONS DE TABLEAU SONT ATTEIGNABLES AU CLAVIER.
 *
 * Les trois tableaux de la console vivent dans un `<div class="overflow-x-auto">`
 * sans `tabIndex` ni rôle. Or un conteneur `overflow-x-auto` NON FOCUSABLE n’est
 * pas défilable au clavier : un utilisateur qui navigue au clavier ne peut
 * structurellement pas atteindre la colonne d’actions, située à 600–900 px du
 * bord sur un écran de 360 px. Sur `/console/sessions`, « Révoquer » est la
 * SEULE action de l’écran.
 *
 * Le correctif minimal, et c’est celui qu’exige WCAG :
 *   - `tabIndex={0}` sur le conteneur, pour qu’il reçoive le focus ;
 *   - `role="region"` + un NOM ACCESSIBLE, parce qu’un conteneur focalisé sans
 *     rôle ni nom n’est pas annoncé comme une zone défilable (WCAG 1.3.1, 2.1.1
 *     et le motif « scrollable region must have keyboard access ») ;
 *   - `scroll-padding-inline`, pour qu’un contrôle focalisé ne reste pas collé
 *     au bord du cadre (WCAG 2.2 « Focus Not Obscured ») ;
 *   - un INDICE VISIBLE : rien, à l’écran, n’indique aujourd’hui qu’il faut
 *     faire glisser le tableau.
 *
 * Ce que ces tests ne peuvent pas faire : mesurer le rendu réel à 360 px (§3 de
 * l’audit). Ils vérifient la GARANTIE STRUCTURELLE — le cadre est focusable,
 * nommé, pourvu d’un `scroll-padding`, et les actions sont bien DANS ce cadre.
 */

afterEach(() => {
  cleanup();
});

function accessFixture(): ConsoleAccess {
  return {
    generatedAt: "2026-09-16T10:00:00.000Z",
    scope: "tenant",
    accounts: [
      { id: 1, name: "Admin", email: "admin@lucepres.gn", role: "admin", mfaEnabled: false, lastSignedIn: null, createdAt: null },
    ],
    accountsTotal: 1,
    roleCounts: [{ role: "admin", label: "Administrateur", count: 1 }],
    invitations: { total: 0, byRole: [] },
    accessMeans: [{ key: "password", label: "Mot de passe", available: true, detail: "Longueur 8 à 128 caractères." }],
    passwordPolicy: {
      minLength: 8,
      maxLength: 128,
      hashing: {
        algorithm: "scrypt",
        saltBytes: 16,
        keyBytes: 64,
        storedFormat: "salt:hash",
        comparison: "timingSafeEqual",
        implementation: "server/_core/password.ts",
      },
      complexity: null,
      resetLinkTtlMinutes: 60,
      protections: [],
      enforcedBy: [],
    },
    unavailable: [],
  };
}

function sessionsFixture(): ConsoleSessions {
  const base = {
    accountName: "Aïssatou Bah",
    accountEmail: "a.bah@lucepres.gn",
    accountRoleLabel: "Admin",
    createdAt: "2026-09-16T06:00:00.000Z",
    lastSeenAt: "2026-09-16T07:25:00.000Z",
    expiresAt: "2027-09-16T06:00:00.000Z",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120",
    clientLabel: "Chrome · Windows",
    ip: "41.66.1.9",
  };
  return {
    generatedAt: "2026-09-16T07:30:00.000Z",
    scope: "tenant",
    sessions: [
      { ...base, id: 1, userId: 4, state: "active", current: false },
      { ...base, id: 2, userId: 12, state: "active", current: true },
    ],
    totals: { total: 2, active: 2, revoked: 0, expired: 0 },
    omitted: 0,
    limit: 50,
    unavailable: false,
  };
}

/** Le conteneur de défilement doit être focusable, nommé et pourvu d’un rôle. */
function expectScrollableRegion(region: HTMLElement) {
  expect(region.getAttribute("role")).toBe("region");
  expect(region.getAttribute("tabindex")).toBe("0");
  // Nom accessible : il DÉCRIT le tableau, il n’est pas un « region » anonyme.
  const label = region.getAttribute("aria-label") ?? "";
  expect(label.length).toBeGreaterThan(8);
  expect(label).toContain("tableau");
  // Le rappel de défilement clavier : le cadre reçoit le focus, on y défile.
  expect(region.className).toContain("overflow-x-auto");
  // WCAG 2.2 « Focus Not Obscured » : le contrôle focalisé n’est pas au bord.
  expect(region.className).toMatch(/scroll-(px|pl|pr)-/);
}

describe("P0-3 — conteneurs de tableaux focusables et nommés", () => {
  it("« Accès & comptes » : le cadre du tableau est une région focusable nommée", () => {
    render(
      createElement(SystemAccessPanel, {
        access: accessFixture(),
        failed: false,
        isLoading: false,
        actions: {
          busyKey: null,
          onCreate: () => undefined,
          onRename: () => undefined,
          onChangeRole: () => undefined,
          onResetPassword: () => undefined,
          onRemove: () => undefined,
          onInvite: () => undefined,
          onResendInvitation: () => undefined,
          onRevokeInvitation: () => undefined,
        },
      }),
    );

    const region = screen.getByRole("region", { name: /Comptes de l’instance/ });
    expectScrollableRegion(region);
    // Les commandes de la ligne sont DANS le cadre défilable : une fois le cadre
    // atteint au clavier et défilé, elles sont atteignables.
    expect(within(region).getByTestId("rename-account-1")).toBeTruthy();
    expect(within(region).getByTestId("remove-account-1")).toBeTruthy();
  });

  it("« Sessions actives » : le cadre est focusable, et « Révoquer » est dedans", () => {
    render(
      createElement(SystemSessionsPanel, {
        sessions: sessionsFixture(),
        failed: false,
        isLoading: false,
        revokingId: null,
        notice: null,
        onRevoke: () => undefined,
      }),
    );

    const region = screen.getByRole("region", { name: /Sessions de l’instance/ });
    expectScrollableRegion(region);
    expect(within(region).getByTestId("revoke-session-1")).toBeTruthy();
  });

  it("« Rôles & permissions » : la matrice est dans un cadre focusable nommé", () => {
    render(createElement(SystemPermissionsPanel));

    const region = screen.getByRole("region", { name: /Capacités/ });
    expectScrollableRegion(region);
    expect(within(region).getByRole("table")).toBeTruthy();
  });

  it("affiche un indice de défilement VISIBLE — pas seulement pour les lecteurs d’écran", () => {
    render(createElement(SystemPermissionsPanel));

    const indice = screen.getByTestId("permissions-matrix-table-hint");
    expect(indice.textContent).toMatch(/défilement/i);
    expect(indice.textContent).toMatch(/Tab/);
    // Il doit être VISIBLE : un indice `sr-only` ne dirait rien à l’opérateur
    // qui, lui, doit deviner qu’il faut faire glisser le tableau.
    expect(indice.className).not.toContain("sr-only");
    expect(indice.className).toContain("text-xs");
  });

  it("aucun conteneur de défilement des trois écrans n’est laissé sans rôle ni tabIndex", () => {
    // Balayage : chaque `.overflow-x-auto` rendu doit être une région focusable.
    // Le jour où un quatrième tableau apparaît sans son cadre, ce test tombe.
    render(
      createElement("div", null,
        createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
        createElement(SystemPermissionsPanel),
        createElement(SystemSessionsPanel, {
          sessions: sessionsFixture(),
          failed: false,
          isLoading: false,
          revokingId: null,
          notice: null,
          onRevoke: () => undefined,
        }),
      ),
    );

    const defilables = Array.from(document.querySelectorAll<HTMLElement>(".overflow-x-auto"));
    expect(defilables.length).toBeGreaterThanOrEqual(3);
    for (const cadre of defilables) {
      expect(cadre.getAttribute("role")).toBe("region");
      expect(cadre.getAttribute("tabindex")).toBe("0");
      expect(cadre.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("les trois écrans passent par le MÊME cadre partagé, et non par trois copies", () => {
    // Le conteneur est un composant : sa règle (rôle, tabIndex, indice, scroll
    // padding) ne peut pas se perdre sur l’un des trois écrans sans que les
    // autres la gardent.
    const lire = (chemin: string) => readFileSync(resolve(process.cwd(), chemin), "utf8");
    for (const fichier of [
      "client/src/components/SystemAccess.tsx",
      "client/src/components/SystemSessions.tsx",
      "client/src/components/SystemPermissions.tsx",
    ]) {
      const source = lire(fichier);
      expect({ fichier, cadrePartage: source.includes("<ScrollableTableRegion") }).toEqual({ fichier, cadrePartage: true });
      expect({ fichier, overflowBrut: source.includes("overflow-x-auto") }).toEqual({ fichier, overflowBrut: false });
    }
  });
});
