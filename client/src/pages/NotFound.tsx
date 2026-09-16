import { IntrouvableScreen } from "@/components/IntrouvablePanel";

/**
 * Page 404 de l’application.
 *
 * Le rendu vit dans `client/src/components/IntrouvablePanel.tsx`, et il est
 * rendu par le MÊME composant que le refus d’accès de la console
 * (`IntrouvableScreen`, utilisé par `client/src/components/SystemGate.tsx`).
 * Ce n’est pas une convention à tenir à la main : c’est le même code, donc les
 * deux écrans ne peuvent pas diverger. Une différence — un bouton en plus, un
 * habillage différent — suffirait à confirmer à un visiteur non habilité
 * l’existence de l’espace qu’il a tenté d’ouvrir.
 */
export default function NotFound() {
  return <IntrouvableScreen />;
}
