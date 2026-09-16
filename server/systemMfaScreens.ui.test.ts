import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INTROUVABLE_TITLE, IntrouvablePanel } from "../client/src/components/IntrouvablePanel";
import {
  ConsoleMfaPanel,
  MfaChallengePanel,
  MfaEnrollIntro,
  MfaEnrollSecret,
  MfaRecoveryCodes,
  formatRemainingTime,
  formatSecretForDisplay,
  mfaStatusSummary,
  type ConsoleMfaStatus,
} from "../client/src/components/SystemMfaPanels";
import { CONSOLE_MFA_REQUIRED_ERR_MSG, CONSOLE_REFUSED_ERR_MSG } from "./_core/trpc";

/**
 * ÉTAPE B2 — LES ÉCRANS, RENDUS POUR DE VRAI.
 *
 * Deux exigences de cette livraison ne se prouvent qu’en regardant ce qui
 * s’affiche :
 *
 *  1. LE REFUS EST MUET. L’écran que reçoit un rôle non habilité ne doit
 *     contenir AUCUNE occurrence de « console », « exploitation » ou
 *     « administration système » — pas même en commentaire HTML. Un mot suffit
 *     à confirmer l’existence d’un espace qu’on prétend cacher.
 *  2. LES ÉCRANS DE MFA EXISTENT ET DISENT CE QU’IL FAUT. Enrôlement, second
 *     temps de connexion, codes de secours montrés une fois, gestion depuis la
 *     console.
 *
 * Le rendu passe par `renderToStaticMarkup` : pas de navigateur, pas de réseau,
 * pas de contexte React. Ce fichier porte le suffixe `.ui.test.ts`, donc tourne
 * en jsdom — c’est la convention du dépôt pour tout ce qui touche à l’affichage.
 */

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/* ------------------------------------------------------------------ */
/* 1. Le refus muet                                                    */
/* ------------------------------------------------------------------ */

describe("Écran de refus — MUET, et identique à la page introuvable", () => {
  /** Les mots qui trahiraient l’existence de l’espace protégé. */
  const MOTS_INTERDITS = ["console", "exploitation", "administration système", "administrateur système"];

  it("n’affiche aucun mot révélateur", () => {
    const html = renderToStaticMarkup(createElement(IntrouvablePanel, { onHome: () => undefined }));
    const minuscules = html.toLowerCase();

    for (const mot of MOTS_INTERDITS) {
      expect({ mot, present: minuscules.includes(mot) }).toEqual({ mot, present: false });
    }
    // Preuve complémentaire : le mot n’apparaît nulle part dans le balisage,
    // y compris dans un attribut ou un identifiant de test.
    expect(html).not.toMatch(/console/i);
  });

  it("n’explique RIEN : ni rôle, ni motif, ni cause du refus", () => {
    const html = renderToStaticMarkup(createElement(IntrouvablePanel, { onHome: () => undefined }));

    expect(html).toContain(INTROUVABLE_TITLE);
    expect(html).toContain("404");
    for (const interdit of ["réservé", "habilit", "rôle", "refusé", "autoris"]) {
      expect({ interdit, present: html.toLowerCase().includes(interdit) }).toEqual({ interdit, present: false });
    }
    // Aucun appel à réessayer avec un autre compte : ce serait un indice.
    expect(html).not.toContain("autre compte");
  });

  it("est LE MÊME composant que la page 404 de l’application", () => {
    // Identité STRUCTURELLE, et non une intention : les deux écrans rendent le
    // même composant (`IntrouvableScreen`), avec l’habillage plein écran et les
    // deux boutons qu’il porte. Une différence — un habillage, un bouton de
    // moins — suffirait à confirmer l’existence de l’espace protégé à qui
    // compare `/console` avec une adresse inconnue.
    const notFound = readSource("client/src/pages/NotFound.tsx");
    const gate = readSource("client/src/components/SystemGate.tsx");
    for (const [nom, source] of [["NotFound.tsx", notFound], ["SystemGate.tsx", gate]] as const) {
      expect({ nom, rend: source.includes("<IntrouvableScreen />") }).toEqual({ nom, rend: true });
      // Aucun habillage propre au refus : le panneau nu (sans habillage plein
      // écran ni les deux navigations) n’est PAS rendu directement.
      expect({ nom, habillage: source.includes("<IntrouvablePanel") }).toEqual({ nom, habillage: false });
    }
    // La page 404 ignore jusqu’au nom de l’espace protégé ; `SystemGate`, lui, le
    // nomme dans ses commentaires — c’est la garde de cet espace, elle doit
    // pouvoir l’expliquer. Ce qui compte est que son REFUS ne le rende jamais :
    // le refus EST l’écran 404, ci-dessus, et rien d’autre.
    expect(notFound.includes("/console")).toBe(false);
    const brancheRefus = gate.slice(gate.indexOf("if (!hasSystemAccess(user?.role)) {"), gate.indexOf("return <ConsoleMfaGate>"));
    expect(brancheRefus).toContain("<IntrouvableScreen />");
    expect(brancheRefus).not.toMatch(/[«"]\s*(console|exploitation)/i);

    // Un seul composant porte l’habillage et les deux navigations.
    const panneau = readSource("client/src/components/IntrouvablePanel.tsx");
    expect(panneau).toContain("export function IntrouvableScreen()");
    expect(panneau).toContain('onHome={() => setLocation("/")}');
    expect(panneau).toContain('onLogin={() => setLocation("/login")}');

    // Le garde ne rend le refus QUE sur la négation de la règle d’habilitation :
    // défaut sûr, on refuse avant de rendre.
    expect(gate.replace(/\s+/g, " ")).toContain("if (!hasSystemAccess(user?.role)) {");
    // Et il n’écrit plus le message d’autrefois, qui nommait la console.
    expect(gate).not.toContain("réservée à l’administration système");
    expect(gate).not.toContain("ne permet pas d’ouvrir");
  });

  it("fait ATTEINDRE la tentative au serveur, pour qu’elle soit journalisée", () => {
    // Le silence exigé est celui de l’interface : il ne doit pas s’étendre au
    // journal. Sans ce signal, taper un chemin réservé dans la barre d’adresse —
    // le geste le plus réaliste — ne produisait AUCUNE ligne côté serveur.
    const gate = readSource("client/src/components/SystemGate.tsx");
    expect(gate).toContain("ConsoleRefusalProbe");
    expect(gate).toContain("trpc.system.reportRefusal.useMutation()");
    // Le signal est émis une seule fois par montage, sans lire de réponse.
    expect(gate).toContain("report.mutate();");
    // La procédure n’accepte AUCUNE entrée : la ligne ne peut pas être forgée.
    expect(readSource("server/_core/systemRouter.ts")).toContain("reportRefusal: publicProcedure.mutation(({ ctx }) => {");
  });

  it("n’expose aucun message d’erreur nommant l’espace protégé", () => {
    // Les messages que le serveur oppose à un non-habilité, et ceux que
    // l’interface pourrait relayer, sont muets eux aussi.
    for (const message of [CONSOLE_REFUSED_ERR_MSG, CONSOLE_MFA_REQUIRED_ERR_MSG]) {
      const minuscules = message.toLowerCase();
      for (const mot of MOTS_INTERDITS) {
        expect({ message, mot, present: minuscules.includes(mot) }).toEqual({ message, mot, present: false });
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. Le garde de la console                                           */
/* ------------------------------------------------------------------ */

describe("Garde de la console — deux verrous, et le chargement paresseux", () => {
  const app = readSource("client/src/App.tsx");
  const gate = readSource("client/src/components/SystemGate.tsx");

  it("interroge le serveur avant d’ouvrir, et n’ouvre que sur un « oui » explicite", () => {
    expect(gate).toContain("trpc.mfa.status.useQuery");
    expect(gate.replace(/\s+/g, " ")).toContain("if (!status.data?.enabled) {");
    // L’enrôlement remplace les modules ; il ne s’y ajoute pas.
    expect(gate).toContain("ConsoleMfaEnrollment");
  });

  it("ÉCHOUE FERMÉ : une vérification impossible n’est pas une autorisation", () => {
    // Sur erreur de la requête d’état, l’écran de reprise s’affiche — sans
    // aucun contenu — et non les modules.
    expect(gate.replace(/\s+/g, " ")).toContain("if (status.error) {");
    expect(gate).toContain("Vérification impossible");
    expect(gate).toContain("une vérification impossible n’est pas une autorisation");
    expect(gate).toContain("children");
  });

  it("recharge l’état auprès du serveur après activation, sans drapeau local", () => {
    expect(gate).toContain("utils.mfa.status.invalidate()");
    expect(gate).toContain("utils.mfa.status.refetch()");
  });

  it("garde les cinq routes de console, toujours en chargement paresseux", () => {
    for (const page of ["SystemConsolePage", "SystemSupervisionPage", "SystemAccessPage", "SystemSessionsPage", "SystemPermissionsPage"]) {
      expect({ page, lazy: app.includes(`lazy(() => import("./pages/${page}"))`) }).toEqual({ page, lazy: true });
      expect({ page, garde: app.includes(`withSystemGate(${page})`) }).toEqual({ page, garde: true });
      // Aucun import statique : le chunk de la console reste hors du bundle métier.
      expect({ page, statique: app.includes(`from "./pages/${page}"`) }).toEqual({ page, statique: false });
    }
    // Le garde ne reçoit plus d’intitulé : il n’y a plus de message de refus à
    // alimenter, donc plus de texte nommant l’espace à garder sous la main.
    expect(app).not.toContain('withSystemGate(SystemConsolePage, "Console d’exploitation")');
  });

  it("place la frontière de chargement SOUS le garde, pas au-dessus", () => {
    // C’est ce qui rend le refus instantané — et donc indiscernable d’une
    // adresse inconnue. Si le `Suspense` enveloppait le garde, un visiteur non
    // habilité verrait d’abord l’écran d’attente de l’application (barre
    // latérale) avant la 404 : une différence visible, et un morceau de code
    // téléchargé pour rien.
    const garde = app.slice(app.indexOf("function withSystemGate"), app.indexOf("const SystemConsoleRoute"));
    expect(garde).toContain("<SystemGate>");
    const suspensionInside = garde.indexOf("</SystemGate>");
    expect(garde.indexOf("<Suspense")).toBeGreaterThan(garde.indexOf("<SystemGate>"));
    expect(garde.indexOf("<Suspense")).toBeLessThan(suspensionInside);
  });

  it("ramène un compte système hors console vers la console (séparation des devoirs)", () => {
    const layout = readSource("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('setLocation("/console")');
  });
});

/* ------------------------------------------------------------------ */
/* 3. Le second temps de la connexion                                  */
/* ------------------------------------------------------------------ */

describe("Connexion — écran du second facteur", () => {
  function rendre(overrides: Partial<Parameters<typeof MfaChallengePanel>[0]> = {}) {
    return renderToStaticMarkup(
      createElement(MfaChallengePanel, {
        code: "",
        onCodeChange: () => undefined,
        onSubmit: () => undefined,
        pending: false,
        error: null,
        secondsRemaining: 240,
        ...overrides,
      }),
    );
  }

  it("demande le code, accepte un code de secours, et annonce l’échéance du défi", () => {
    const html = rendre();
    expect(html).toContain('data-testid="mfa-challenge"');
    expect(html).toContain("Votre mot de passe est reconnu");
    expect(html).toContain("Code à 6 chiffres");
    expect(html).toContain("code de secours est aussi accepté");
    expect(html).toContain("expire dans 4 min 00 s");
    expect(html).toContain("ressaisir votre mot de passe");
    // Le champ porte les deux aides à la saisie mobile.
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('autoComplete="one-time-code"');
  });

  it("affiche l’échec d’un code sans masquer le formulaire", () => {
    const html = rendre({ code: "000000", error: "Code refusé." });
    expect(html).toContain('data-testid="mfa-error"');
    expect(html).toContain("Code refusé.");
    // Le champ reste utilisable : on peut réessayer immédiatement.
    expect(html).toContain('id="mfa-login-code"');
    expect(/id="mfa-login-code"[^>]*disabled/.test(html)).toBe(false);
    // Et la valeur saisie n’est pas effacée : l’utilisateur corrige, il ne
    // ressaisit pas six chiffres.
    expect(html).toContain('value="000000"');
  });

  it("se met en attente pendant la vérification, sans doubler l’envoi", () => {
    const html = rendre({ code: "123456", pending: true });
    expect(html).toContain("Vérification…");
    expect(html).toContain("disabled");
  });

  it("tient le décompte du défi en clair", () => {
    expect(formatRemainingTime(0)).toBe("0 s");
    expect(formatRemainingTime(45)).toBe("45 s");
    expect(formatRemainingTime(240)).toBe("4 min 00 s");
    expect(formatRemainingTime(59)).toBe("59 s");
  });
});

/* ------------------------------------------------------------------ */
/* 4. L’enrôlement depuis la console                                   */
/* ------------------------------------------------------------------ */

describe("Console — enrôlement obligatoire", () => {
  it("explique pourquoi l’accès est fermé AVANT de demander quoi que ce soit", () => {
    const html = renderToStaticMarkup(createElement(MfaEnrollIntro, { onStart: () => undefined, pending: false, error: null }));

    expect(html).toContain('data-testid="mfa-enroll-intro"');
    expect(html).toContain("Authentification à deux facteurs requise");
    expect(html).toContain("les modules restent fermés — y compris pour vous");
    expect(html).toContain("Générer mon secret");
    // Les trois étapes annoncées, dans l’ordre : installer, enregistrer, confirmer.
    expect(html.indexOf("Installez une application")).toBeLessThan(html.indexOf("Enregistrez le compte"));
    expect(html.indexOf("Enregistrez le compte")).toBeLessThan(html.indexOf("Saisissez le code"));
  });

  it("rend le secret recopiable et le lien otpauth, puis demande le premier code", () => {
    const html = renderToStaticMarkup(
      createElement(MfaEnrollSecret, {
        secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        otpauthUri: "otpauth://totp/Lucepress%3Asysteme%40lucepres.gn?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        account: "systeme@lucepres.gn",
        code: "12345",
        onCodeChange: () => undefined,
        onSubmit: () => undefined,
        onCopySecret: () => undefined,
        copied: false,
        pending: false,
        error: null,
      }),
    );

    expect(html).toContain('data-testid="mfa-enroll-secret"');
    expect(html).toContain('data-testid="mfa-secret"');
    // Le secret est présenté par groupes de quatre : la recopie manuelle est le
    // seul chemin possible sans bibliothèque de QR code.
    expect(html).toContain("GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ");
    expect(html).toContain("systeme@lucepres.gn");
    expect(html).toContain("otpauth://totp/");
    expect(html).toContain("Saisir une clé de configuration");
    expect(html).toContain("Premier code de confirmation");
    // Un code incomplet ne peut pas être envoyé.
    expect(html).toContain("disabled");
  });

  it("présente le secret par groupes de quatre, quelle que soit la saisie", () => {
    expect(formatSecretForDisplay("gezdgnbvgy3tqojq")).toBe("GEZD GNBV GY3T QOJQ");
    expect(formatSecretForDisplay("GEZD GNBV GY3T QOJQ")).toBe("GEZD GNBV GY3T QOJQ");
    expect(formatSecretForDisplay("")).toBe("");
  });

  it("montre les codes de secours UNE fois, et le dit", () => {
    const codes = ["A2C4E-7GH9K", "MNPQR-STUVW", "X2Y34-Z5678"];
    const html = renderToStaticMarkup(createElement(MfaRecoveryCodes, { codes, onAcknowledge: () => undefined }));

    expect(html).toContain("Double authentification active");
    expect(html).toContain("plus jamais affichés");
    expect(html).toContain("n’en conserve que des empreintes");
    for (const code of codes) expect(html).toContain(code);
    expect(html).toContain('data-testid="mfa-recovery-code-1"');
    expect(html).toContain('data-testid="mfa-recovery-code-3"');
    expect(html).toContain("J’ai noté mes codes de secours");
    // L’écran précise l’usage : un code de secours remplace le code à 6 chiffres,
    // et il est à usage unique.
    expect(html).toContain("ne sert qu’une fois");
  });
});

/* ------------------------------------------------------------------ */
/* 5. La gestion depuis le tableau de bord                             */
/* ------------------------------------------------------------------ */

describe("Console — panneau « Ma double authentification »", () => {
  const etat: ConsoleMfaStatus = {
    readable: true,
    enabled: true,
    pending: false,
    enrolledAt: "2026-09-01T08:00:00.000Z",
    recoveryCodesRemaining: 7,
  };

  function rendre(overrides: Partial<Parameters<typeof ConsoleMfaPanel>[0]> = {}) {
    return renderToStaticMarkup(
      createElement(ConsoleMfaPanel, {
        status: etat,
        disableOpen: false,
        onToggleDisable: () => undefined,
        code: "",
        onCodeChange: () => undefined,
        onDisable: () => undefined,
        pending: false,
        error: null,
        isLoading: false,
        ...overrides,
      }),
    );
  }

  it("résume l’état, la méthode, la date et les codes restants", () => {
    const html = rendre();
    expect(html).toContain('data-testid="console-mfa-panel"');
    expect(html).toContain("Ma double authentification");
    expect(html).toContain("Facteur exigé pour ouvrir cette console");
    expect(html).toContain("Il reste facultatif pour les autres comptes");
    expect(html).toContain("Active");
    expect(html).toContain("TOTP · 6 chiffres · 30 s");
    expect(html).toContain("7 restant(s)");
  });

  it("n’affiche jamais de secret ni de code : seulement un décompte", () => {
    const html = rendre();
    expect(html).not.toMatch(/otpauth/);
    expect(html).not.toMatch(/[A-Z2-7]{16,}/);
    expect(html).not.toMatch(/[a-f0-9]{32}:[a-f0-9]{64}/);
  });

  it("prévient quand il ne reste AUCUN code de secours", () => {
    const html = rendre({ status: { ...etat, recoveryCodesRemaining: 0 } });
    expect(html).toContain("Il ne reste aucun code de secours");
    expect(html).toContain("réenrôlez");
  });

  it("demande un code de confirmation AVANT de désactiver (action en deux temps)", () => {
    const ferme = rendre();
    expect(ferme).toContain("Désactiver la double authentification");
    expect(ferme).not.toContain("Confirmer la désactivation");

    const ouvert = rendre({ disableOpen: true });
    expect(ouvert).toContain("Confirmer la désactivation");
    expect(ouvert).toContain("Annuler");
    expect(ouvert).toContain('id="mfa-disable-code"');
    // L’écran annonce la conséquence réelle : la console se referme.
    expect(ouvert).toContain("La désactivation ferme immédiatement l’accès à cette console");
  });

  it("distingue les quatre états possibles, sans jamais prétendre savoir", () => {
    expect(mfaStatusSummary(etat)).toEqual({ label: "Active", tone: "ok" });
    expect(mfaStatusSummary({ ...etat, enabled: false, pending: true })).toEqual({ label: "Enrôlement inachevé", tone: "warn" });
    expect(mfaStatusSummary({ ...etat, enabled: false, pending: false })).toEqual({ label: "Inactive", tone: "down" });
    // « Je ne sais pas » n’est pas « inactive » : une base muette ne doit pas
    // être affichée comme une absence de MFA.
    expect(mfaStatusSummary({ ...etat, readable: false })).toEqual({ label: "État inconnu", tone: "warn" });
    expect(mfaStatusSummary(undefined)).toEqual({ label: "État inconnu", tone: "warn" });

    const inconnu = rendre({ status: { ...etat, readable: false } });
    expect(inconnu).toContain("État inconnu");
  });

  it("affiche un refus de désactivation sans perdre le formulaire", () => {
    const html = rendre({ disableOpen: true, code: "000000", error: "Code refusé." });
    expect(html).toContain('data-testid="mfa-error"');
    expect(html).toContain("Confirmer la désactivation");
  });

  it("laisse le bouton de désactivation inactif tant que la MFA n’est pas active", () => {
    const html = rendre({ status: { ...etat, enabled: false, pending: false } });
    expect(html).toContain("Inactive");
    expect(html).toContain("disabled");
  });
});

/* ------------------------------------------------------------------ */
/* 6. Le panneau est bien monté dans la console                        */
/* ------------------------------------------------------------------ */

describe("Montage — les écrans sont branchés là où ils doivent l’être", () => {
  it("place le panneau de gestion sur le tableau de bord de la console", () => {
    const page = readSource("client/src/pages/SystemConsolePage.tsx");
    expect(page).toContain("ConsoleMfaManager");
    expect(page).toContain("<ConsoleMfaManager />");
  });

  it("branche le second temps de connexion sur la page de connexion", () => {
    const login = readSource("client/src/pages/LoginPage.tsx");
    expect(login).toContain("MfaChallengePanel");
    expect(login).toContain("mfaRequired");
    expect(login).toContain("mfaLogin({ challengeToken: challenge.token, code })");
    expect(login).toContain("Votre défi a expiré");
    // Le premier temps ne bascule sur l’écran de code QUE si le serveur l’a dit.
    expect(login).toContain("if (result?.mfaRequired && result.challengeToken)");
    // Toujours aucune fuite : la page de connexion ne mentionne pas la console.
    expect(login).not.toContain("/console");
  });

  it("expose le second temps par le hook d’authentification", () => {
    const hook = readSource("client/src/_core/hooks/useAuth.ts");
    expect(hook).toContain("auth.mfaLogin.useMutation");
    expect(hook).toContain("mfaLogin: mfaLoginMutation.mutateAsync");
  });
});
