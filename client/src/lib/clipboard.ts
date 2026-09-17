/**
 * COPIE DANS LE PRESSE-PAPIERS — L’ISSUE RÉELLE, JAMAIS SUPPOSÉE.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * `navigator.clipboard` n’est pas toujours là : absent en contexte non sécurisé
 * (HTTP), refusé dans une iframe sans permission, rejeté si l’utilisateur
 * décline, et purement inexistant sur les navigateurs anciens. Écrire
 *
 *     void navigator.clipboard?.writeText(secret);
 *     setCopied(true);
 *
 * ne copie donc RIEN dans ces cas, tout en annonçant « Copié ». Sur un mot de
 * passe temporaire affiché une seule fois, ou sur un lien d’invitation que la
 * base ne garde qu’en empreinte, le secret est perdu et l’opérateur croit à un
 * bug de l’application.
 *
 * La règle est donc : ATTENDRE la promesse, et rendre l’issue. Les trois écrans
 * qui copient un secret (`SystemAccessActions` ×2, `SystemMfaPanels`) passent
 * par ici — une seule implémentation, un seul comportement.
 */

/** Issue d’une tentative de copie : la copie a eu lieu, ou elle a échoué. */
export type CopyOutcome = "copied" | "failed";

/**
 * Copie `value` et DIT si la copie a réussi.
 *
 * Ne lève jamais : un échec est une issue normale (presse-papiers indisponible),
 * pas une exception à faire remonter. C’est l’appelant qui décide de ce qu’il
 * affiche — « Copié » seulement sur `"copied"`.
 */
export async function copyTextToClipboard(value: string): Promise<CopyOutcome> {
  try {
    // `globalThis` plutôt que `navigator` : rend la fonction sûre à appeler même
    // là où le DOM n’existe pas (rendu statique, test serveur).
    const clipboard = (globalThis as { navigator?: { clipboard?: { writeText?: unknown } } }).navigator?.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") return "failed";
    await clipboard.writeText(value);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * Sélectionne le contenu d’un élément, pour permettre une recopie manuelle
 * (Ctrl+C) quand le presse-papiers n’est pas accessible.
 *
 * Deux cas, parce que le DOM en connaît deux : un champ de saisie se sélectionne
 * par `select()`, un élément de texte par une plage de sélection. Rend `true`
 * quand une sélection a bien été posée.
 */
export function selectElementText(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    const field = element as HTMLInputElement;
    field.focus();
    field.select();
    return true;
  }
  if (typeof document === "undefined") return false;
  const selection = typeof window === "undefined" ? null : window.getSelection?.();
  if (!selection || !document.createRange) return false;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
