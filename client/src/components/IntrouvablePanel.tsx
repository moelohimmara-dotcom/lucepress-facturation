import { Button } from "@/components/ui/button";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { Compass, Home, LogIn } from "lucide-react";
import { useLocation } from "wouter";

/**
 * ÉCRAN « INTROUVABLE » — NEUTRE PAR CONSTRUCTION.
 *
 * Ce composant est le SEUL rendu d’un refus d’accès à une zone réservée, et il
 * ne dit rien d’autre que « cette page n’existe pas ». Il ne nomme ni la zone,
 * ni le rôle, ni la raison : c’est exactement ce que la page 404 affiche pour
 * une adresse réellement inconnue, au caractère près. Un refus qui se
 * distinguerait d’une 404 confirmerait l’existence de ce qu’il protège.
 *
 * TROIS RÈGLES POUR QUI MODIFIERA LE TEXTE PLUS TARD :
 *   1. aucun nom d’espace réservé, aucune mention de rôle ou d’habilitation ;
 *   2. aucun détail sur la cause (connecté ou non, autorisé ou non) ;
 *   3. aucune invitation à réessayer ou à se connecter « avec un autre compte ».
 * Un test échoue si l’une de ces règles est enfreinte
 * (`server/systemMfaScreens.ui.test.ts`).
 *
 * DEUX NIVEAUX, ET LE SECOND EST LE SEUL À UTILISER
 * -------------------------------------------------
 * - `IntrouvablePanel` : le CONTENU, sans aucun hook. Il reçoit sa navigation
 *   par propriétés, ce qui permet de le rendre statiquement dans un test sans
 *   navigateur — donc de PROUVER qu’aucun mot interdit n’apparaît.
 * - `IntrouvableScreen` : le même contenu, avec le même habillage plein écran
 *   que la 404 de l’application. C’est CE composant qui est rendu à la fois par
 *   la route inconnue ET par le refus d’accès de la console : l’identité n’est
 *   pas une intention, elle est structurelle. Deux rendus distincts finiraient
 *   par diverger — un bouton de plus ici, un habillage différent là — et la
 *   différence serait précisément l’indice à ne pas donner.
 */

export type IntrouvablePanelProps = {
  /** Retour à l’espace de travail. Absent = bouton masqué. */
  onHome?: () => void;
  /** Lien de connexion. Absent = bouton masqué. */
  onLogin?: () => void;
};

/** Titre affiché — exporté pour que les tests l’épinglent. */
export const INTROUVABLE_TITLE = "Page introuvable";

export function IntrouvablePanel({ onHome, onLogin }: IntrouvablePanelProps) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4" data-testid="page-introuvable">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Compass className="h-8 w-8" />
        </div>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#b8862f]">Erreur 404</p>
        <h1 className="font-editorial mt-3 text-3xl font-semibold tracking-tight text-foreground">{INTROUVABLE_TITLE}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Cette page n’existe pas ou a été déplacée. Vérifiez l’adresse, puis revenez à l’espace de travail.
        </p>
        {(onHome || onLogin) && (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {onHome && (
              <Button onClick={onHome} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground">
                <Home className="mr-2 h-4 w-4" />
                Retour à l’accueil
              </Button>
            )}
            {onLogin && (
              <Button variant="outline" onClick={onLogin} className="h-10 rounded-xl border-border font-bold">
                <LogIn className="mr-2 h-4 w-4" />
                Se connecter
              </Button>
            )}
          </div>
        )}
        <p className="mt-10 text-xs text-muted-foreground">
          {LUCEPRES_PUBLIC_PROFILE.legalName} &middot; Conakry, Guinée
        </p>
      </div>
    </div>
  );
}

/**
 * Écran plein, autonomme : c’est LUI que rendent la route inconnue et le refus
 * d’accès. Il fournit l’habillage et les deux navigations — jamais l’un sans
 * l’autre, sans quoi les deux rendus se distingueraient au premier coup d’œil.
 */
export function IntrouvableScreen() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <IntrouvablePanel onHome={() => setLocation("/")} onLogin={() => setLocation("/login")} />
    </div>
  );
}
