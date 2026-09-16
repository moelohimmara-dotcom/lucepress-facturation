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
import { CONSOLE_REFUSED_ERR_MSG } from "./_core/trpc";

/**
 * LA CONSOLE, RENDUE POUR DE VRAI — ET LA MFA PROPOSÉE.
 *
 * Deux exigences ne se prouvent qu’en regardant ce qui s’affiche :
 *
 *  1. LE REFUS EST MUET. L’écran que reçoit un rôle non habilité ne doit
 *     contenir AUCUNE occurrence de « console », « exploitation » ou
 *     « administration système » — pas même en commentaire HTML. Un mot suffit
 *     à confirmer l’existence d’un espace qu’on prétend cacher.
 *  2. LES ÉCRANS DE MFA EXISTENT ET DISENT CE QU’IL FAUT — sans promettre une
 *     obligation qui n’existe plus. L’enrôlement, le second temps de connexion,
 *     les codes de secours montrés une fois et la gestion depuis la console
 *     (activer, désactiver) sont épinglés ici, textes compris : une interface
 *     qui annoncerait encore « requise » mentirait sur la règle.
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
    // La branche de refus va du test d’habilitation au rendu des enfants : ce
    // qu’elle contient est EXACTEMENT ce que reçoit un rôle non habilité.
    const brancheRefus = gate.slice(gate.indexOf("if (!hasSystemAccess(user?.role)) {"), gate.indexOf("return <>{children}</>"));
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
    // Le seul refus que la console oppose encore, et ceux que l’interface
    // pourrait relayer, sont muets eux aussi.
    const minuscules = CONSOLE_REFUSED_ERR_MSG.toLowerCase();
    for (const mot of MOTS_INTERDITS) {
      expect({ mot, present: minuscules.includes(mot) }).toEqual({ mot, present: false });
    }
    // RETOURNÉ — un second message existait, « Authentification à deux facteurs
    // requise… », pour le refus d’un compte sans MFA. Ce refus n’existe plus :
    // le message est retiré, et le dépôt ne doit pas en garder la promesse.
    expect(readSource("server/_core/trpc.ts")).not.toContain("deux facteurs requise");
    for (const source of ["client/src/components/SystemGate.tsx", "client/src/components/SystemMfaPanels.tsx"]) {
      expect({ source, texte: readSource(source).includes("Authentification à deux facteurs requise") }).toEqual({
        source,
        texte: false,
      });
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. Le garde de la console                                           */
/* ------------------------------------------------------------------ */

describe("Garde de la console — le rôle suffit, et le chargement reste paresseux", () => {
  const app = readSource("client/src/App.tsx");
  const gate = readSource("client/src/components/SystemGate.tsx");

  it("n’ouvre plus sur un second facteur : le rôle habilité suffit", () => {
    // RETOURNÉ — ce garde interrogeait `mfa.status` et n’ouvrait que sur
    // `enabled === true`. Il ne demande plus rien au serveur que le rôle.
    expect(gate).not.toContain("trpc.mfa.status");
    expect(gate).not.toContain("ConsoleMfaEnrollment");
    expect(gate).toContain("hasSystemAccess");
    // Et il rend les modules dès que la règle de rôle est satisfaite.
    expect(gate).toContain("return <>{children}</>;");
  });

  it("n’a plus d’écran d’échec qui ferme : une vérification impossible n’a plus lieu d’être", () => {
    // RETOURNÉ — l’écran « Vérification impossible » tenait lieu de défaut sûr
    // quand l’état MFA décidait de l’accès. Ne restant que le rôle — connu
    // localement par la session — il n’y a plus rien à vérifier auprès du
    // serveur avant d’afficher, donc plus d’écran de reprise à opposer.
    expect(gate).not.toContain("Vérification impossible");
    expect(gate).not.toContain("status.error");
    expect(gate).not.toContain("mfa.status.useQuery");
    // Le seul défaut sûr qui subsiste est celui du rôle : on refuse AVANT de rendre.
    expect(gate.replace(/\s+/g, " ")).toContain("if (!hasSystemAccess(user?.role)) {");
    // L’attente de session, elle, reste : elle ne bloque personne au-delà du
    // temps de la réponse du serveur.
    expect(gate).toContain("GateSpinner");
  });

  it("garde le rafraîchissement de l’état MFA là où il sert : dans le panneau de gestion", () => {
    // RETOURNÉ — le garde rechargeait `mfa.status` après activation, puisque
    // c’est cette relecture qui rouvrait la console. C’est désormais le panneau
    // du tableau de bord qui en a besoin, et lui seul : il affiche l’état.
    const manager = readSource("client/src/components/SystemMfa.tsx");
    expect(gate).not.toContain("utils.mfa.status.invalidate()");
    expect(manager).toContain("utils.mfa.status.invalidate()");
    expect(manager).toContain("utils.mfa.status.refetch()");
    // Aucun drapeau local ne tient lieu d’état : c’est la relecture serveur qui
    // décide de ce que le panneau affiche.
    expect(manager).toContain("trpc.mfa.status.useQuery");
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
/* 4. L’enrôlement depuis la console — PROPOSÉ, jamais imposé          */
/* ------------------------------------------------------------------ */

describe("Console — enrôlement proposé", () => {
  it("annonce le compromis — recommandée, jamais imposée — AVANT de demander quoi que ce soit", () => {
    // RETOURNÉ — cet écran annonçait « Authentification à deux facteurs
    // requise » et « les modules restent fermés — y compris pour vous ». Depuis
    // que la console s’ouvre sans second facteur, ces deux phrases sont
    // fausses : le test épingle désormais ce qui est vrai, et vérifie que la
    // promesse d’obligation a disparu du rendu.
    const html = renderToStaticMarkup(createElement(MfaEnrollIntro, { onStart: () => undefined, pending: false, error: null }));

    expect(html).toContain('data-testid="mfa-enroll-intro"');
    expect(html).toContain("Double authentification — recommandée, jamais imposée");
    expect(html).toContain("la console reste ouverte sans elle");
    expect(html).toContain("codes de secours");
    expect(html).toContain("la désactiver");
    expect(html).toContain("Générer mon secret");
    // Aucune trace de l’obligation retirée, ni dans le texte, ni en balisage.
    expect(html).not.toContain("requise");
    expect(html).not.toContain("les modules restent fermés");
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
        onStartEnroll: () => undefined,
        onRetry: () => undefined,
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
    // RETOURNÉ — le panneau disait « Facteur exigé pour ouvrir cette console ».
    // Il dit maintenant l’inverse, et c’est la règle : recommandée, jamais
    // imposée, la console restant ouverte sans elle.
    expect(html).toContain("Recommandée pour un compte d’administration — jamais imposée");
    expect(html).toContain("La console reste ouverte sans elle");
    expect(html).not.toContain("Facteur exigé");
    expect(html).toContain("MFA : activée");
    expect(html).toContain("TOTP · 6 chiffres · 30 s");
    expect(html).toContain("7 restant(s)");
  });

  it("propose l’activation quand la MFA n’est PAS active, sans rien imposer", () => {
    const html = rendre({ status: { ...etat, enabled: false, pending: false, enrolledAt: null, recoveryCodesRemaining: 0 } });
    expect(html).toContain("MFA : non activée");
    expect(html).toContain("Aucun second facteur n’est actif sur ce compte");
    expect(html).toContain("Activer la double authentification");
    expect(html).toContain("Rien n’est imposé");
    // Aucune désactivation possible tant que rien n’est actif, et aucun texte
    // ne promet une fermeture de la console.
    expect(html).not.toContain("Désactiver la double authentification");
    expect(html).not.toContain("ferme immédiatement");
  });

  it("ne propose ni activation ni désactivation quand l’état est illisible", () => {
    // « Je ne sais pas » n’est pas « absente » : on ne lance ni un enrôlement
    // qui serait refusé (`deja_active`), ni une désactivation à l’aveugle.
    const html = rendre({ status: { ...etat, readable: false } });
    expect(html).toContain("MFA : état inconnu");
    expect(html).toContain("Réessayer");
    expect(html).not.toContain("Activer la double authentification");
    expect(html).not.toContain("Désactiver la double authentification");

    // Même chose quand la requête a échoué : il n’y a AUCUNE donnée, et c’est
    // exactement le cas où une proposition d’activation serait la plus
    // trompeuse — elle s’adresserait peut-être à un compte déjà enrôlé.
    const enEchec = rendre({ status: undefined, isLoading: false });
    expect(enEchec).toContain("MFA : état inconnu");
    expect(enEchec).not.toContain("Activer la double authentification");

    // Et pendant la lecture, aucune action n’est proposée non plus.
    const enCours = rendre({ status: undefined, isLoading: true });
    expect(enCours).toContain("Vérification…");
    expect(enCours).not.toContain("Activer la double authentification");
    expect(enCours).not.toContain("Réessayer");
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
    // RETOURNÉ — l’écran annonçait que la console se refermait aussitôt. Elle
    // ne se referme plus : le texte dit la conséquence RÉELLE, qui porte
    // désormais sur la connexion suivante.
    expect(ouvert).not.toContain("La désactivation ferme immédiatement l’accès à cette console");
    expect(ouvert).toContain("la console reste ouverte");
    expect(ouvert).toContain("ne demandera plus qu’un mot de passe");
  });

  it("distingue les quatre états possibles, sans jamais prétendre savoir", () => {
    expect(mfaStatusSummary(etat)).toEqual({ label: "MFA : activée", tone: "ok" });
    expect(mfaStatusSummary({ ...etat, enabled: false, pending: true })).toEqual({ label: "MFA : enrôlement inachevé", tone: "warn" });
    expect(mfaStatusSummary({ ...etat, enabled: false, pending: false })).toEqual({ label: "MFA : non activée", tone: "down" });
    // « Je ne sais pas » n’est pas « inactive » : une base muette ne doit pas
    // être affichée comme une absence de MFA.
    expect(mfaStatusSummary({ ...etat, readable: false })).toEqual({ label: "MFA : état inconnu", tone: "warn" });
    expect(mfaStatusSummary(undefined)).toEqual({ label: "MFA : état inconnu", tone: "warn" });

    const inconnu = rendre({ status: { ...etat, readable: false } });
    expect(inconnu).toContain("MFA : état inconnu");
  });

  it("affiche un refus de désactivation sans perdre le formulaire", () => {
    const html = rendre({ disableOpen: true, code: "000000", error: "Code refusé." });
    expect(html).toContain('data-testid="mfa-error"');
    expect(html).toContain("Confirmer la désactivation");
  });

  it("laisse le bouton de désactivation inactif tant que la MFA n’est pas active", () => {
    // Retournement partiel : le bouton n’existe même plus quand la MFA est
    // inactive — c’est l’activation qui prend sa place. Ce que le test garde,
    // c’est l’impossibilité de désactiver ce qui n’est pas actif.
    const html = rendre({ status: { ...etat, enabled: false, pending: false } });
    expect(html).toContain("MFA : non activée");
    expect(html).not.toContain("Désactiver la double authentification");
    // Le formulaire de confirmation ne s’ouvre pas non plus, même si l’état
    // `disableOpen` traîne : une désactivation sans MFA est un non-sens.
    const ouvert = rendre({ status: { ...etat, enabled: false, pending: false }, disableOpen: true });
    expect(ouvert).not.toContain("Confirmer la désactivation");
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

  it("branche les DEUX gestes — activer et désactiver — sur le conteneur du panneau", () => {
    // Le panneau ne connaît ni tRPC ni routeur : ce qu’il reçoit par propriétés
    // doit exister, et pointer sur les procédures réelles. C’est le seul endroit
    // où une proposition sans effet pourrait se cacher.
    const manager = readSource("client/src/components/SystemMfa.tsx");
    expect(manager).toContain("onStartEnroll");
    expect(manager).toContain("ConsoleMfaEnrollment");
    expect(manager).toContain("trpc.mfa.enrollStart.useMutation");
    expect(manager).toContain("trpc.mfa.enrollConfirm.useMutation");
    expect(manager).toContain("trpc.mfa.disable.useMutation");
    expect(manager).toContain("normalizeRecoveryCode");
    // L’enrôlement est atteignable SANS condition : rien ne le subordonne à un
    // état ou à un droit autre que la session — c’est la proposition.
    expect(manager).not.toContain("if (!status.data?.enabled) return");
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
