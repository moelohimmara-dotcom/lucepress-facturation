import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test de NON-RÉGRESSION d'une faille critique.
 *
 * Une version déployée de `_core/context.ts` fabriquait un utilisateur
 * `local-admin` (role: "admin") quand aucune session n'était présentée. Tout
 * visiteur anonyme d'Internet obtenait donc les pleins droits.
 *
 * Ces tests échouent si ce repli est réintroduit, sous quelque forme que ce soit.
 */
const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    getUserByOpenId: vi.fn(),
    getUserByEmail: vi.fn(),
  };
});

vi.mock("../db", () => mocks);

import { createContext } from "./context";
import { signLocalSession } from "./localAuth";
import { COOKIE_NAME } from "@shared/const";

function optsWithCookie(cookie?: string) {
  return {
    req: { headers: cookie ? { cookie } : {} },
    res: {},
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createContext — aucun accès privilégié sans session", () => {
  it("renvoie user=null quand AUCUN cookie n'est présenté", async () => {
    const ctx = await createContext(optsWithCookie());
    expect(ctx.user).toBeNull();
    expect(mocks.getUserByOpenId).not.toHaveBeenCalled();
  });

  it("renvoie user=null quand le cookie de session est invalide (signature forgée)", async () => {
    const ctx = await createContext(optsWithCookie(`${COOKIE_NAME}=jeton.completement.bidon`));
    expect(ctx.user).toBeNull();
  });

  it("ne fabrique JAMAIS d'utilisateur local-admin (faille corrigée)", async () => {
    const ctx = await createContext(optsWithCookie());
    expect(ctx.user).toBeNull();
    // Formulation explicite : si un repli réapparaît, l'intention est lisible.
    expect((ctx.user as any)?.openId).not.toBe("local-admin");
    expect((ctx.user as any)?.role).not.toBe("admin");
  });

  it("ignore les anciens cookies OAuth Manus", async () => {
    const ctx = await createContext(
      optsWithCookie("manus_session=abc; __Host-oauth_state=xyz; session_id=legacy")
    );
    expect(ctx.user).toBeNull();
  });

  it("renvoie user=null si la session est valide mais le compte a été supprimé", async () => {
    // Cookie légitime, mais le compte n'existe plus en base : le typage
    // `User | null` doit être respecté (pas `undefined`), sinon les gardes
    // `if (!ctx.user)` en aval pourraient se comporter de façon inattendue.
    mocks.getUserByOpenId.mockResolvedValue(undefined);
    const token = await signLocalSession({
      openId: "local_supprime",
      email: "supprime@lucepress.com",
      name: "Compte supprimé",
    });

    const ctx = await createContext(optsWithCookie(`${COOKIE_NAME}=${token}`));
    expect(ctx.user).toBeNull();
    expect(ctx.user).not.toBeUndefined();
  });

  it("restitue l'utilisateur lorsqu'une session valide est présentée", async () => {
    const compte = {
      id: 1,
      openId: "local_dg",
      email: "dg@lucepress.com",
      name: "Directeur",
      role: "admin",
      passwordHash: "sel:empreinte",
      loginMethod: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    mocks.getUserByOpenId.mockResolvedValue(compte);

    const token = await signLocalSession({
      openId: "local_dg",
      email: "dg@lucepress.com",
      name: "Directeur",
    });

    const ctx = await createContext(optsWithCookie(`${COOKIE_NAME}=${token}`));
    expect(ctx.user).toMatchObject({ openId: "local_dg", role: "admin" });
    expect(mocks.getUserByOpenId).toHaveBeenCalledWith("local_dg");
  });
});
