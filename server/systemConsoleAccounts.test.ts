import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ÉCRITURE SUR LES COMPTES DEPUIS LA CONSOLE — CE QUI PASSE, CE QUI EST REFUSÉ,
 * ET CE QUI EST ÉCRIT.
 *
 * Trois questions, trois séries de preuves, et il serait facile de n’en traiter
 * qu’une :
 *
 *  1. QUI A LE DROIT ? Les huit nouvelles procédures sont sous
 *     `systemProcedure` : rôle `systeme` ET double authentification active. On
 *     le prouve DANS LES DEUX SENS — refus pour `admin`, `directeur`, `cadre`,
 *     `client` et anonyme, refus pour un compte `systeme` sans MFA, acceptation
 *     pour un compte `systeme` avec MFA.
 *  2. QUELS GARDE-FOUS TIENNENT ? Le dernier compte système ne peut être ni
 *     rétrogradé ni supprimé, on ne se retire pas soi-même, et on ne se
 *     rétrograde pas soi-même.
 *  3. QU’EST-CE QUI EST ÉCRIT ? Une ligne par écriture — succès, refus ET échec.
 *     Jamais de mot de passe, jamais de jeton, jamais de lien d’invitation.
 *
 * `./db` est doublé : aucune base n’est sollicitée (l’énoncé de la livraison
 * l’interdit, et un test d’écriture qui toucherait la base ne serait pas
 * reproductible). `./_core/password` l’est aussi : scrypt est coûteux, et le
 * double permet de prouver que ce qui est STOCKÉ n’est jamais le mot de passe en
 * clair. SMTP est neutralisé : aucun test ne doit produire d’appel réseau.
 */
const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    /** État de la MFA du compte système qui appelle. Piloté par les tests. */
    mfaActive: true,
    /** SMTP : faux par défaut (aucun appel réseau), vrai pour le renvoi d’invitation. */
    mailConfigured: false,
    listUsers: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
    getUserByEmail: vi.fn(async (): Promise<unknown> => undefined),
    createLocalUser: vi.fn(async (input: { email: string; role: string }) => ({ id: 99, openId: `local_${input.email}` })),
    setUserRole: vi.fn(async () => undefined),
    setUserName: vi.fn(async () => undefined),
    resetUserPassword: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => ({ deleted: true })),
    listInvitations: vi.fn(async () => []),
    listPendingInvitations: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
    createInvitation: vi.fn(async () => ({ id: 7 })),
    revokeInvitation: vi.fn(async () => undefined),
    rotateInvitationToken: vi.fn(),
    renderEmailTemplate: vi.fn(async () => null),
    getDb: vi.fn(async () => null),
    INVITATION_TTL_MS: 72 * 60 * 60 * 1000,
    /** Empreinte distincte du clair : ce qui est stocké ne contient pas le mot de passe. */
    hashPassword: vi.fn(async () => "scrypt:empreinte"),
  };
});

vi.mock("./db", () => mocks);
vi.mock("./_core/password", () => ({ hashPassword: mocks.hashPassword, verifyPassword: vi.fn(async () => false) }));
vi.mock("./mfa", async importOriginal => {
  const actual = await importOriginal<typeof import("./mfa")>();
  return { ...actual, isMfaActiveForUser: vi.fn(async () => mocks.mfaActive) };
});
// SMTP neutralisé : `issueInvitation` et `resendInvitationEmail` ne doivent
// produire aucun appel réseau, quel que soit l’environnement d’exécution.
vi.mock("./_core/mailer", () => ({
  sendMail: vi.fn(async () => undefined),
  isMailConfigured: () => mocks.mailConfigured,
  getSmtpUser: () => undefined,
  getDefaultFrom: () => "Lucepres <noreply@lucepress.local>",
}));

import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";
import { CONSOLE_MFA_REQUIRED_ERR_MSG, CONSOLE_REFUSED_ERR_MSG } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import {
  TEMPORARY_PASSWORD_ALPHABET,
  TEMPORARY_PASSWORD_LENGTH,
  accountTarget,
  classifyConsoleOutcome,
  createTemporaryPassword,
  invitationTarget,
} from "./systemAccounts";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

/**
 * Le compte système qui appelle porte l’identifiant 3 — c’est lui qui doit
 * rester en place pour que les garde-fous d’instance aient un sens.
 */
const SYSTEM_ACTOR_ID = 3;

function contextFor(role: string, id = SYSTEM_ACTOR_ID): TrpcContext {
  return {
    user: {
      id,
      openId: `staff-${role}`,
      name: `Compte ${role}`,
      email: `${role}@lucepres.gn`,
      loginMethod: "email",
      role,
      createdAt: new Date("2026-01-05T08:00:00.000Z"),
      updatedAt: new Date("2026-01-05T08:00:00.000Z"),
      lastSignedIn: new Date("2026-09-16T06:00:00.000Z"),
    },
    tenantId: 1,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

function anonymousContext(): TrpcContext {
  return { user: null, tenantId: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
}

function staffFixture(extra: Array<Record<string, unknown>> = []) {
  const base = (id: number, role: string, email: string) => ({
    id,
    openId: `local_${id}`,
    name: `Compte ${id}`,
    email,
    role,
    loginMethod: "email",
    lastSignedIn: new Date("2026-09-15T10:00:00.000Z"),
    createdAt: new Date("2026-01-05T08:00:00.000Z"),
  });
  return [
    base(1, "admin", "admin@lucepres.gn"),
    base(2, "cadre", "cadre@lucepres.gn"),
    base(SYSTEM_ACTOR_ID, "systeme", "systeme@lucepres.gn"),
    ...extra,
  ];
}

/** Instance à DEUX comptes système : le dernier n’est alors pas en jeu. */
function twoSystemAccounts() {
  return staffFixture([
    {
      id: 4,
      openId: "local_4",
      name: "Second système",
      email: "systeme2@lucepres.gn",
      role: "systeme",
      loginMethod: "email",
      lastSignedIn: new Date("2026-09-15T10:00:00.000Z"),
      createdAt: new Date("2026-01-05T08:00:00.000Z"),
    },
  ]);
}

/** Capture TOUTE la sortie console : le journal ne doit pas fuir par un autre canal. */
function captureConsole() {
  const lines: string[] = [];
  const spies = (["info", "warn", "error", "log"] as const).map(method =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(argument => String(argument)).join(" "));
    }),
  );
  return { lines, spies };
}

const caller = (role: string, id = SYSTEM_ACTOR_ID) => appRouter.createCaller(contextFor(role, id));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mfaActive = true;
  mocks.mailConfigured = false;
  mocks.listUsers.mockResolvedValue(staffFixture());
  mocks.getUserByEmail.mockResolvedValue(undefined);
  mocks.createLocalUser.mockImplementation(async (input: { email: string }) => ({ id: 99, openId: `local_${input.email}` }));
  mocks.deleteUser.mockResolvedValue({ deleted: true });
  mocks.listPendingInvitations.mockResolvedValue([]);
  mocks.createInvitation.mockResolvedValue({ id: 7 });
  mocks.hashPassword.mockResolvedValue("scrypt:empreinte");
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* 1. Qui a le droit ?                                                 */
/* ------------------------------------------------------------------ */

/**
 * Les huit écritures, appelées avec une entrée VALIDE. Le refus doit venir du
 * garde, jamais d’une entrée mal formée : une entrée invalide ferait échouer le
 * test pour la mauvaise raison.
 */
const ECRITURES: Array<{ nom: string; appeler: (role: string, id?: number) => Promise<unknown> }> = [
  { nom: "system.accounts.create", appeler: (r, id) => caller(r, id).system.accounts.create({ email: "n@x.com", password: "MotDePasse123", role: "cadre", name: "Nouveau" }) },
  { nom: "system.accounts.rename", appeler: (r, id) => caller(r, id).system.accounts.rename({ userId: 2, name: "Nouveau nom" }) },
  { nom: "system.accounts.setRole", appeler: (r, id) => caller(r, id).system.accounts.setRole({ userId: 2, role: "directeur" }) },
  { nom: "system.accounts.resetPassword", appeler: (r, id) => caller(r, id).system.accounts.resetPassword({ userId: 2 }) },
  { nom: "system.accounts.remove", appeler: (r, id) => caller(r, id).system.accounts.remove({ userId: 2 }) },
  { nom: "system.invitations.issue", appeler: (r, id) => caller(r, id).system.invitations.issue({ email: "invite@x.com", role: "cadre" }) },
  { nom: "system.invitations.resend", appeler: (r, id) => caller(r, id).system.invitations.resend({ id: 7 }) },
  { nom: "system.invitations.revoke", appeler: (r, id) => caller(r, id).system.invitations.revoke({ id: 7 }) },
];

describe("Console — les écritures sont réservées au rôle système", () => {
  it("refuse chaque écriture à tous les rôles non système, en 403", async () => {
    for (const ecriture of ECRITURES) {
      for (const role of ["admin", "directeur", "cadre", "client"]) {
        await expect(ecriture.appeler(role)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
  });

  it("refuse chaque écriture à un visiteur anonyme", async () => {
    for (const ecriture of ECRITURES) {
      const anonyme = { ...anonymousContext() };
      await expect(
        (async () => {
          const call = appRouter.createCaller(anonyme);
          switch (ecriture.nom) {
            case "system.accounts.create":
              return call.system.accounts.create({ email: "n@x.com", password: "MotDePasse123", role: "cadre" });
            case "system.accounts.rename":
              return call.system.accounts.rename({ userId: 2, name: "Nouveau nom" });
            case "system.accounts.setRole":
              return call.system.accounts.setRole({ userId: 2, role: "directeur" });
            case "system.accounts.resetPassword":
              return call.system.accounts.resetPassword({ userId: 2 });
            case "system.accounts.remove":
              return call.system.accounts.remove({ userId: 2 });
            case "system.invitations.issue":
              return call.system.invitations.issue({ email: "invite@x.com", role: "cadre" });
            case "system.invitations.resend":
              return call.system.invitations.resend({ id: 7 });
            default:
              return call.system.invitations.revoke({ id: 7 });
          }
        })(),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("n’écrit RIEN quand le rôle est refusé", async () => {
    for (const ecriture of ECRITURES) {
      await expect(ecriture.appeler("admin")).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
    expect(mocks.setUserName).not.toHaveBeenCalled();
    expect(mocks.setUserRole).not.toHaveBeenCalled();
    expect(mocks.resetUserPassword).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.createInvitation).not.toHaveBeenCalled();
    expect(mocks.revokeInvitation).not.toHaveBeenCalled();
  });

  it("refuse un compte système SANS MFA, sur les huit écritures", async () => {
    mocks.mfaActive = false;

    for (const ecriture of ECRITURES) {
      await expect(ecriture.appeler("systeme")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: CONSOLE_MFA_REQUIRED_ERR_MSG,
      });
    }
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
    expect(mocks.setUserRole).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("refuse aussi la lecture des invitations sans MFA", async () => {
    mocks.mfaActive = false;
    await expect(caller("systeme").system.invitations.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ne nomme rien dans le message de refus", async () => {
    // Le refus de rôle est muet : il ne dit ni « console », ni « exploitation »,
    // ni « administration système » (voir `_core/trpc.ts`).
    expect(CONSOLE_REFUSED_ERR_MSG).toBe("Accès refusé.");
    await expect(caller("admin").system.accounts.remove({ userId: 2 })).rejects.toMatchObject({
      message: CONSOLE_REFUSED_ERR_MSG,
    });
  });

  it("accepte chaque écriture pour un compte système avec MFA", async () => {
    mocks.mailConfigured = true;
    mocks.listUsers.mockResolvedValue(twoSystemAccounts());
    mocks.listPendingInvitations.mockResolvedValue([
      { id: 7, email: "invite@x.com", role: "cadre", expiresAt: new Date("2026-09-19T10:00:00.000Z"), createdAt: new Date("2026-09-16T10:00:00.000Z") },
    ]);
    mocks.rotateInvitationToken.mockResolvedValue({
      token: "jeton-renvoye",
      email: "invite@x.com",
      role: "cadre",
      expiresAt: new Date("2026-09-19T10:00:00.000Z"),
    });

    const call = caller("systeme");
    await expect(call.system.accounts.create({ email: "n@x.com", password: "MotDePasse123", role: "cadre" })).resolves.toMatchObject({ id: 99 });
    await expect(call.system.accounts.rename({ userId: 2, name: "Nouveau nom" })).resolves.toEqual({ userId: 2 });
    await expect(call.system.accounts.setRole({ userId: 2, role: "directeur" })).resolves.toEqual({ userId: 2, role: "directeur" });
    await expect(call.system.accounts.resetPassword({ userId: 2 })).resolves.toMatchObject({ userId: 2 });
    await expect(call.system.accounts.remove({ userId: 2 })).resolves.toEqual({ userId: 2 });
    await expect(call.system.invitations.list()).resolves.toHaveLength(1);
    await expect(call.system.invitations.issue({ email: "invite@x.com", role: "cadre" })).resolves.toMatchObject({ success: true });
    await expect(call.system.invitations.resend({ id: 7 })).resolves.toMatchObject({ success: true, email: "invite@x.com" });
    await expect(call.system.invitations.revoke({ id: 7 })).resolves.toEqual({ id: 7, email: "invite@x.com" });
  });
});

/* ------------------------------------------------------------------ */
/* 2. Ce que la console écrit réellement                               */
/* ------------------------------------------------------------------ */

describe("Création d’un compte", () => {
  it("crée un compte système depuis la console et n’enregistre que l’empreinte", async () => {
    const resultat = await caller("systeme").system.accounts.create({
      email: "nouveau.systeme@lucepres.gn",
      password: "MotDePasse123",
      role: "systeme",
      name: "Nouveau système",
    });

    expect(resultat).toEqual({ id: 99, openId: "local_nouveau.systeme@lucepres.gn" });
    expect(mocks.hashPassword).toHaveBeenCalledWith("MotDePasse123");
    expect(mocks.createLocalUser).toHaveBeenCalledWith({
      email: "nouveau.systeme@lucepres.gn",
      passwordHash: "scrypt:empreinte",
      name: "Nouveau système",
      role: "systeme",
      tenantId: 1,
    });
    // Le mot de passe en clair n’est transmis à AUCUNE écriture.
    expect(JSON.stringify(mocks.createLocalUser.mock.calls)).not.toContain("MotDePasse123");
  });

  it("refuse un compte portail client, avec la raison plutôt qu’un code", async () => {
    // Le schéma accepte `client` pour que le refus vienne du module et porte une
    // explication en français — même choix que `users.create`.
    await expect(
      caller("systeme").system.accounts.create({ email: "client@x.com", password: "MotDePasse123", role: "client" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("fiche du client"),
    });
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
  });

  it("refuse un e-mail déjà pourvu d’un compte", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: 5, email: "n@x.com" });
    await expect(
      caller("systeme").system.accounts.create({ email: "n@x.com", password: "MotDePasse123", role: "cadre" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.createLocalUser).not.toHaveBeenCalled();
  });
});

describe("Renommage, rôle et suppression", () => {
  it("renomme un compte sans toucher à son rôle", async () => {
    await caller("systeme").system.accounts.rename({ userId: 2, name: "  Aïssatou Bah  " });
    expect(mocks.setUserName).toHaveBeenCalledWith(2, "Aïssatou Bah");
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("efface un nom laissé vide plutôt que d’écrire une chaîne blanche", async () => {
    await caller("systeme").system.accounts.rename({ userId: 2, name: "   " });
    expect(mocks.setUserName).toHaveBeenCalledWith(2, null);
  });

  it("refuse de renommer un compte inexistant", async () => {
    await expect(caller("systeme").system.accounts.rename({ userId: 1234, name: "Personne" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.setUserName).not.toHaveBeenCalled();
  });

  it("change le rôle d’un compte métier — l’administrateur système gère tous les comptes", async () => {
    mocks.listUsers.mockResolvedValue(twoSystemAccounts());
    await caller("systeme").system.accounts.setRole({ userId: 2, role: "directeur" });
    expect(mocks.setUserRole).toHaveBeenCalledWith(2, "directeur");
  });

  it("supprime un compte et refuse quand la couche de données s’y oppose", async () => {
    await caller("systeme").system.accounts.remove({ userId: 2 });
    expect(mocks.deleteUser).toHaveBeenCalledWith(2);

    mocks.deleteUser.mockResolvedValue({ deleted: false, reason: "dernier_admin" });
    await expect(caller("systeme").system.accounts.remove({ userId: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("dernier administrateur"),
    });
  });
});

/* ------------------------------------------------------------------ */
/* 3. Les garde-fous                                                   */
/* ------------------------------------------------------------------ */

describe("Garde-fous d’instance et de continuité", () => {
  it("refuse de retirer le dernier rôle système de l’instance", async () => {
    // Un seul compte système : celui qui appelle.
    mocks.listUsers.mockResolvedValue(staffFixture());
    await expect(caller("systeme").system.accounts.setRole({ userId: SYSTEM_ACTOR_ID, role: "cadre" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("refuse de supprimer le dernier compte système, même un autre que soi", async () => {
    // L’acteur (id 3) n’est pas la cible (id 8), mais l’instance n’a qu’un
    // compte système : le retirer fermerait la porte définitivement. Ce cas ne
    // peut pas exister aujourd’hui (l’acteur est système), et c’est exactement
    // pourquoi le garde-fou porte sur le RELEVÉ, pas sur l’acteur.
    mocks.listUsers.mockResolvedValue([
      { id: 2, role: "cadre" },
      { id: 8, role: "systeme" },
    ]);
    await expect(caller("systeme").system.accounts.remove({ userId: 8 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("laisse retirer un rôle système dès qu’un autre compte le porte", async () => {
    mocks.listUsers.mockResolvedValue(twoSystemAccounts());
    await expect(caller("systeme").system.accounts.setRole({ userId: 4, role: "cadre" })).resolves.toEqual({
      userId: 4,
      role: "cadre",
    });
    expect(mocks.setUserRole).toHaveBeenCalledWith(4, "cadre");
  });

  it("refuse l’auto-suppression", async () => {
    mocks.listUsers.mockResolvedValue(twoSystemAccounts());
    await expect(caller("systeme").system.accounts.remove({ userId: SYSTEM_ACTOR_ID })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("votre propre compte"),
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("refuse l’auto-rétrogradation", async () => {
    mocks.listUsers.mockResolvedValue(twoSystemAccounts());
    await expect(caller("systeme").system.accounts.setRole({ userId: SYSTEM_ACTOR_ID, role: "cadre" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("votre propre rôle"),
    });
    expect(mocks.setUserRole).not.toHaveBeenCalled();
  });

  it("s’en tient au relevé réel : un navigateur qui mentirait n’ouvre rien", async () => {
    // Le garde-fou ne prend AUCUNE valeur d’état en entrée — seulement
    // l’identifiant visé et le rôle demandé. Le décompte vient de `db.listUsers`.
    const source = readSource("server/systemAccounts.ts");
    expect(source).toContain("assertNotLastSystemAccount(comptes)");
    expect(source).toContain("assertNotSelfRemoval(input.actor.id, input.userId)");
    expect(source).toContain("assertKeepsOwnSystemRole(input.actor.id, input.userId, input.role)");
  });
});

/* ------------------------------------------------------------------ */
/* 4. Le mot de passe temporaire                                       */
/* ------------------------------------------------------------------ */

describe("Mot de passe temporaire", () => {
  it("tire seize caractères d’un alphabet sans glyphe ambigu", () => {
    const motDePasse = createTemporaryPassword();
    expect(motDePasse).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    expect(motDePasse).toMatch(new RegExp(`^[${TEMPORARY_PASSWORD_ALPHABET}]+$`));
    // Ni 0/O, ni 1/I/l : ce mot de passe se dicte au téléphone.
    for (const ambigu of ["0", "O", "1", "I", "l"]) {
      expect(TEMPORARY_PASSWORD_ALPHABET).not.toContain(ambigu);
    }
    // Deux tirages ne se ressemblent pas.
    expect(createTemporaryPassword()).not.toBe(createTemporaryPassword());
  });

  it("respecte une longueur plancher même si on la demande plus courte", () => {
    // La politique appliquée par l’application refuse moins de 8 caractères.
    expect(createTemporaryPassword(3, () => 0)).toHaveLength(8);
  });

  it("est rendu une seule fois : ni journalisé, ni stocké en clair, ni relisible", async () => {
    const { lines } = captureConsole();

    const resultat = await caller("systeme").system.accounts.resetPassword({ userId: 2 });
    const motDePasse = resultat.temporaryPassword;

    expect(motDePasse).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    // 1. Ce qui est STOCKÉ est l’empreinte, jamais le clair.
    expect(mocks.resetUserPassword).toHaveBeenCalledWith(2, "scrypt:empreinte");
    expect(JSON.stringify(mocks.resetUserPassword.mock.calls)).not.toContain(motDePasse);
    expect(JSON.stringify(mocks.hashPassword.mock.calls)).toContain(motDePasse);

    // 2. Le journal n’en contient pas une trace.
    expect(lines.join("\n")).not.toContain(motDePasse);
    expect(lines.join("\n")).not.toContain("scrypt:empreinte");

    // 3. Aucune LECTURE ne le rend : `system.access` relu juste après ne le
    //    contient nulle part (et ne peut pas le contenir — la base n’en garde
    //    que l’empreinte, qui elle-même n’est jamais projetée).
    const releve = await caller("systeme").system.access();
    expect(JSON.stringify(releve)).not.toContain(motDePasse);
  });

  it("refuse de réinitialiser un compte inexistant, sans rien écrire", async () => {
    await expect(caller("systeme").system.accounts.resetPassword({ userId: 1234 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.resetUserPassword).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* 5. Le journal des écritures                                         */
/* ------------------------------------------------------------------ */

describe("Journal des écritures", () => {
  it("écrit une ligne par écriture, quelle que soit l’issue", async () => {
    const { lines } = captureConsole();
    mocks.listUsers.mockResolvedValue(twoSystemAccounts());
    mocks.listPendingInvitations.mockResolvedValue([
      { id: 7, email: "invite@x.com", role: "cadre", expiresAt: new Date("2026-09-19T10:00:00.000Z"), createdAt: new Date("2026-09-16T10:00:00.000Z") },
    ]);

    const call = caller("systeme");
    await call.system.accounts.rename({ userId: 2, name: "Nom" });
    await call.system.accounts.setRole({ userId: 2, role: "directeur" });
    await call.system.accounts.resetPassword({ userId: 2 });
    await call.system.invitations.issue({ email: "invite@x.com", role: "cadre" });
    await call.system.invitations.revoke({ id: 7 });

    const ecritures = lines.filter(ligne => ligne.startsWith("[console] écriture"));
    expect(ecritures).toHaveLength(5);
    expect(ecritures.map(ligne => /action=(\S+)/.exec(ligne)?.[1])).toEqual([
      "compte.nom",
      "compte.role",
      "compte.mot-de-passe",
      "invitation.creation",
      "invitation.revocation",
    ]);
    expect(ecritures.map(ligne => /cible=(\S+)/.exec(ligne)?.[1])).toEqual([
      "compte#2",
      "compte#2",
      "compte#2",
      "invitation#7",
      "invitation#7",
    ]);
    for (const ligne of ecritures) {
      expect(ligne).toContain("resultat=ok");
      expect(ligne).toContain("acteur=systeme@lucepres.gn");
      expect(ligne).toContain("role=systeme");
      expect(ligne).toContain("tenant=1");
    }
  });

  it("journalise AUSSI les refus — c’est la ligne qui manque quand on enquête", async () => {
    const { lines } = captureConsole();
    mocks.listUsers.mockResolvedValue(staffFixture());

    await expect(caller("systeme").system.accounts.setRole({ userId: SYSTEM_ACTOR_ID, role: "cadre" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    const refus = lines.filter(ligne => ligne.includes("resultat=refuse"));
    expect(refus).toHaveLength(1);
    expect(refus[0]).toContain("action=compte.role");
    expect(refus[0]).toContain(`cible=${accountTarget(SYSTEM_ACTOR_ID)}`);
  });

  it("distingue un refus d’un échec d’infrastructure", async () => {
    const { lines } = captureConsole();
    mocks.deleteUser.mockRejectedValue(new Error("connexion perdue"));

    await expect(caller("systeme").system.accounts.remove({ userId: 2 })).rejects.toThrow("connexion perdue");

    expect(lines.filter(ligne => ligne.includes("resultat=echec"))).toHaveLength(1);
    expect(lines.filter(ligne => ligne.includes("resultat=refuse"))).toHaveLength(0);
  });

  it("n’écrase jamais deux écritures identiques : un acte est un fait", async () => {
    // Le journal des TENTATIVES déduplique (voir `systemAccessLog.ts`) ; celui
    // des écritures ne le fait pas — dédupliquer ici supprimerait des preuves.
    const { lines } = captureConsole();
    const call = caller("systeme");
    await call.system.accounts.rename({ userId: 2, name: "Nom" });
    await call.system.accounts.rename({ userId: 2, name: "Nom" });

    expect(lines.filter(ligne => ligne.includes("action=compte.nom"))).toHaveLength(2);
  });

  it("nomme un compte créé par son identifiant RÉEL, jamais « à venir »", async () => {
    const { lines } = captureConsole();
    mocks.createLocalUser.mockResolvedValue({ id: 512, openId: "local_neuf" });

    await caller("systeme").system.accounts.create({ email: "neuf@x.com", password: "MotDePasse123", role: "cadre" });

    const ligne = lines.find(entree => entree.includes("action=compte.creation"));
    expect(ligne).toContain("cible=compte#512");
    expect(ligne).not.toContain("compte#inconnu");
  });

  it("ne laisse fuir ni mot de passe, ni empreinte, ni jeton, ni lien", async () => {
    const { lines } = captureConsole();
    mocks.listPendingInvitations.mockResolvedValue([
      { id: 7, email: "invite@x.com", role: "cadre", expiresAt: new Date("2026-09-19T10:00:00.000Z"), createdAt: new Date("2026-09-16T10:00:00.000Z") },
    ]);

    const call = caller("systeme");
    const creation = await call.system.accounts.resetPassword({ userId: 2 });
    const invitation = await call.system.invitations.issue({ email: "invite@x.com", role: "cadre", });
    await call.system.accounts.create({ email: "neuf@x.com", password: "MotDePasse123", role: "cadre" });

    const journal = lines.join("\n");
    expect(journal).not.toContain(creation.temporaryPassword);
    expect(journal).not.toContain("MotDePasse123");
    expect(journal).not.toContain("scrypt:empreinte");
    expect(journal).not.toContain(invitation.invitationLink);
    // La forme d’une ligne est FIXE : des champs techniques, et rien d’autre.
    // Le suffixe `(id n)` est l’identifiant interne de l’acteur — jamais son nom,
    // son mot de passe, ni le contenu de sa requête.
    for (const ligne of lines.filter(entree => entree.startsWith("[console] écriture"))) {
      expect(ligne).toMatch(
        /^\[console\] écriture — action=[a-z.-]+ resultat=(ok|refuse|echec) cible=(compte|invitation)#\S+ acteur=\S+\(id \d+\) role=\S+ tenant=\S+$/,
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/* 6. Invitations                                                      */
/* ------------------------------------------------------------------ */

describe("Invitations vues depuis la console", () => {
  const enAttente = [
    {
      id: 7,
      email: "invite@x.com",
      role: "cadre",
      expiresAt: new Date("2026-09-19T10:00:00.000Z"),
      createdAt: new Date("2026-09-16T10:00:00.000Z"),
    },
    {
      id: 8,
      email: "retard@x.com",
      role: "directeur",
      expiresAt: new Date("2026-09-01T10:00:00.000Z"),
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
    },
  ];

  it("liste les invitations en attente sans jamais transporter d’empreinte de jeton", async () => {
    mocks.listPendingInvitations.mockResolvedValue(enAttente);

    const liste = await caller("systeme").system.invitations.list();

    expect(liste).toHaveLength(2);
    expect(liste[0]).toEqual({
      id: 7,
      email: "invite@x.com",
      role: "cadre",
      roleLabel: "Cadre",
      expiresAt: "2026-09-19T10:00:00.000Z",
      createdAt: "2026-09-16T10:00:00.000Z",
      expired: false,
    });
    // Une invitation échue reste visible, et se dit échue.
    expect(liste[1].expired).toBe(true);
    const serialise = JSON.stringify(liste);
    expect(serialise).not.toMatch(/tokenHash|token|sha256/i);
    expect(serialise).not.toMatch(/[a-f0-9]{64}/);
  });

  it("n’écrit aucune ligne de journal pour une lecture", async () => {
    const { lines } = captureConsole();
    mocks.listPendingInvitations.mockResolvedValue(enAttente);
    await caller("systeme").system.invitations.list();
    expect(lines.filter(ligne => ligne.includes("[console]"))).toHaveLength(0);
  });

  it("émet une invitation et journalise l’identifiant réel", async () => {
    const { lines } = captureConsole();
    mocks.createInvitation.mockResolvedValue({ id: 41 });

    const invitation = await caller("systeme").system.invitations.issue({ email: "invite@x.com", role: "cadre" });

    expect(invitation.success).toBe(true);
    expect(invitation.invitationLink).toContain("/invitation?token=");
    expect(invitation.emailed).toBe(false);
    expect(invitation.smtpConfigured).toBe(false);
    const ligne = lines.find(entree => entree.includes("action=invitation.creation"));
    expect(ligne).toContain(`cible=${invitationTarget(41)}`);
  });

  it("refuse d’inviter un compte portail client, avec la raison", async () => {
    await expect(
      caller("systeme").system.invitations.issue({ email: "client@x.com", role: "client" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("fiche du client"),
    });
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("refuse de révoquer une invitation qui n’est plus en attente, sans écrire", async () => {
    mocks.listPendingInvitations.mockResolvedValue([]);
    await expect(caller("systeme").system.invitations.revoke({ id: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.revokeInvitation).not.toHaveBeenCalled();
  });

  it("ne journalise jamais « ok » sur une révocation qui n’a rien changé", async () => {
    const { lines } = captureConsole();
    mocks.listPendingInvitations.mockResolvedValue([]);
    await expect(caller("systeme").system.invitations.revoke({ id: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const ligne = lines.find(entree => entree.includes("action=invitation.revocation"));
    expect(ligne).toContain("resultat=refuse");
    expect(ligne).not.toContain("resultat=ok");
  });
});

/* ------------------------------------------------------------------ */
/* 7. Le code lui-même                                                 */
/* ------------------------------------------------------------------ */

describe("Module d’écriture — garanties structurelles", () => {
  const module = readSource("server/systemAccounts.ts");
  const router = readSource("server/_core/systemRouter.ts");

  it("classe un refus et un échec selon une règle, pas au cas par cas", () => {
    for (const code of ["FORBIDDEN", "BAD_REQUEST", "NOT_FOUND", "CONFLICT", "PRECONDITION_FAILED"] as const) {
      const refus = new TRPCError({ code });
      expect({ code, issue: classifyConsoleOutcome(refus) }).toEqual({ code, issue: "refuse" });
    }
    expect(classifyConsoleOutcome(new TRPCError({ code: "INTERNAL_SERVER_ERROR" }))).toBe("echec");
    expect(classifyConsoleOutcome(new Error("connexion perdue"))).toBe("echec");
    expect(classifyConsoleOutcome("pas une erreur")).toBe("echec");
  });

  it("n’écrit aucune requête SQL et ne peut donc pas modifier le schéma", () => {
    expect(module).not.toContain("db.execute");
    expect(module).not.toMatch(/\bsql`/);
    expect(module).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\b\s+(into|table|from)?/i);
    expect(module.toLowerCase()).not.toContain(".sql");
  });

  it("fait passer CHAQUE écriture par le même guichet journalisé", () => {
    // Huit écritures, huit appels à `performConsoleAction`, huit noms d’action.
    expect((module.match(/performConsoleAction\(\{/g) ?? []).length).toBe(8);
    expect((module.match(/action: "/g) ?? []).length).toBe(8);
    // Aucune écriture directe hors du guichet : le journal ne peut pas être
    // contourné par mégarde.
    for (const appel of ["db.setUserRole(", "db.setUserName(", "db.resetUserPassword(", "db.deleteUser(", "db.revokeInvitation("]) {
      expect({ appel, occurrences: module.split(appel).length - 1 }).toEqual({ appel, occurrences: 1 });
    }
  });

  it("réutilise les garde-fous et l’émission d’invitation au lieu de les réécrire", () => {
    expect(module).toContain('from "./accountGuardrails"');
    expect(module).toContain('from "./invitationIssue"');
    // Le texte des garde-fous vit dans `accountGuardrails.ts`, et nulle part
    // ailleurs : s’il apparaissait ici, c’est qu’une seconde version de la règle
    // aurait été écrite — et c’est la plus permissive des deux qui gagne.
    expect(module).not.toContain("Impossible de retirer le dernier compte d’administration système");
    expect(module).not.toContain("Vous ne pouvez pas retirer votre propre rôle d’administrateur système");
    expect(module).not.toContain("Vous ne pouvez pas supprimer votre propre compte.");
    // Aucune invitation n’est émise hors du chemin partagé : ni tirage de jeton,
    // ni écriture d’invitation, ni composition de lien ici.
    expect(module).not.toContain("createInvitationToken");
    expect(module).not.toContain("hashInvitationToken");
    expect(module).not.toContain("/invitation?token=");
    expect((module.match(/db\.createInvitation/g) ?? []).length).toBe(0);
    // Le contrôle « un compte par adresse » est en revanche écrit deux fois —
    // ici parce qu’il faut hacher AVANT d’insérer, dans `users.create` pour la
    // même raison. Les deux portent le même message : la même situation doit se
    // dire avec les mêmes mots, quel que soit l’écran.
    expect(module).toContain("Un compte existe déjà avec cet e-mail.");
  });

  it("ne transmet jamais un mot de passe au journal", () => {
    // Le guichet ne reçoit que quatre choses : acteur, action, cible, travail.
    // Aucun appel n’y ajoute de champ sensible.
    const appels = module.split("performConsoleAction({").slice(1);
    expect(appels).toHaveLength(8);
    for (const appel of appels) {
      const tete = appel.slice(0, 200);
      expect(tete).not.toMatch(/password|motDePasse|temporaryPassword|secret/i);
    }
  });

  it("déclare les huit procédures sous le garde de la console", () => {
    for (const chemin of [
      "create: systemProcedure",
      "rename: systemProcedure",
      "setRole: systemProcedure",
      "resetPassword: systemProcedure",
      "remove: systemProcedure",
      "issue: systemProcedure",
      "resend: systemProcedure",
      "revoke: systemProcedure",
    ]) {
      expect({ chemin, present: router.includes(chemin) }).toEqual({ chemin, present: true });
    }
    // Et sous AUCUN garde plus faible.
    expect(router).not.toMatch(/(create|rename|remove|revoke):\s*(publicProcedure|protectedProcedure|adminProcedure|staffProcedure|usersProcedure)/);
    expect(router).toContain("accounts: router({");
    expect(router).toContain("invitations: router({");
  });
});
