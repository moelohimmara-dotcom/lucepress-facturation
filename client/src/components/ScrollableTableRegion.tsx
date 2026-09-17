import { MoveHorizontal } from "lucide-react";
import type { ReactNode } from "react";

/**
 * CADRE D’UN TABLEAU LARGE — ATTEIGNABLE AU CLAVIER, NOMMÉ, ET IL LE DIT.
 *
 * POURQUOI CE COMPOSANT EXISTE
 * ----------------------------
 * Les trois tableaux de la console forcent une largeur minimale bien plus
 * grande qu’un écran de téléphone (`min-w-[42rem]`, `min-w-[52rem]`,
 * `min-w-[62rem]` pour ~328 px de contenu utile à 360 px). Les actions de ligne
 * — « Renommer », « Rôle », « Mot de passe », « Supprimer », « Révoquer » — se
 * trouvent donc à 600–900 px du bord gauche.
 *
 * Or un `<div class="overflow-x-auto">` sans `tabIndex` N’EST PAS DÉFILABLE AU
 * CLAVIER : le navigateur ne donne le focus qu’aux éléments focusables, et le
 * défilement au clavier suit le focus. Un utilisateur clavier ne pouvait donc
 * structurellement pas atteindre la seule action de `/console/sessions`.
 *
 * LES RÈGLES APPLIQUÉES, ET POURQUOI CHACUNE EST LÀ
 * -------------------------------------------------
 *  - `keyboard-nav` — « Tab order matches visual order; full keyboard support » :
 *    `tabIndex={0}` fait entrer le cadre dans l’ordre de tabulation, et le
 *    défilement horizontal suit alors les flèches ← →.
 *  - `role="region"` + nom accessible : un conteneur focalisé SANS rôle ni nom
 *    n’est pas annoncé comme une zone défilable. Le nom décrit le TABLEAU (« ce
 *    qu’on y trouve »), pas le cadre : c’est ce que le lecteur d’écran annonce.
 *  - `focus-not-obscured` (WCAG 2.2 AA) — « Don’t let a fixed overlay cover
 *    `:focus` » : `scroll-padding-inline` empêche qu’un bouton focalisé reste
 *    collé au bord du cadre, à demi masqué.
 *  - `horizontal-scroll` — « ensure content fits viewport width » : la cible
 *    reste une liste de cartes sous `md` (lot 2 de l’audit, non implémenté ici).
 *    En attendant, la zone doit au moins être parcourable, et l’indice ci-dessous
 *    le dit à l’opérateur qui, sinon, doit DEVINER qu’il faut faire glisser.
 *
 * L’indice est VISIBLE, et placé HORS du cadre défilable : il ne défile pas avec
 * le tableau, donc il reste lisible quand on a fait défiler les colonnes.
 */
export function ScrollableTableRegion({
  label,
  testId,
  hint = "Défilement horizontal : atteignez le tableau avec Tab, puis parcourez-le avec les flèches ← →.",
  className,
  children,
}: {
  /** Nom accessible de la région — il décrit le tableau, au pluriel ou non. */
  label: string;
  /** Identifiant du cadre ; l’indice reçoit `<testId>-hint`. */
  testId: string;
  /** Phrase d’indice affichée au-dessus du cadre. */
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      <p data-testid={`${testId}-hint`} className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
        <MoveHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {hint}
      </p>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        data-testid={testId}
        className={`mt-2 overflow-x-auto scroll-px-4 rounded-xl ${className ?? ""}`}
      >
        {children}
      </div>
    </>
  );
}
