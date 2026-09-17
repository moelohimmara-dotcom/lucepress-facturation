import { Button } from "@/components/ui/button";
import { copyTextToClipboard, selectElementText, type CopyOutcome } from "@/lib/clipboard";
import { Check, ClipboardCopy, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * BOUTON « COPIER » UNIQUE DE LA CONSOLE — et il ne ment pas.
 *
 * Il n’affiche « Copié » que sur une copie RÉELLE, c’est-à-dire après que
 * `copyTextToClipboard` a rendu `"copied"`. En cas d’échec — presse-papiers
 * absent en contexte non sécurisé, permission refusée — il laisse le libellé
 * « Copier » (on peut réessayer), affiche un message honnête, et SÉLECTIONNE la
 * valeur affichée pour que l’opérateur la recopie à la main.
 *
 * Trois écrans s’en servent, et c’est le point : le mot de passe temporaire, le
 * lien d’invitation et le secret TOTP suivent la même règle, parce qu’ils
 * partagent le même bouton. Sur ces trois valeurs — toutes affichées une seule
 * fois et non relisibles en base — un « Copié » de complaisance coûte un secret.
 */

/** Message d’échec quand la valeur a pu être sélectionnée pour recopie manuelle. */
export const COPY_FAILED_WITH_SELECTION =
  "Copie impossible : le presse-papiers n’est pas accessible depuis ce navigateur. La valeur est sélectionnée — recopiez-la à la main (Ctrl+C).";

/** Message d’échec quand aucun repli n’est possible. */
export const COPY_FAILED_MESSAGE =
  "Copie impossible : le presse-papiers n’est pas accessible depuis ce navigateur. Recopiez la valeur à la main.";

export const COPY_LABEL = "Copier";
export const COPIED_LABEL = "Copié";

type CopyButtonProps = {
  /** Valeur transmise au presse-papiers — toujours la valeur BRUTE. */
  value: string;
  /** Élément qui affiche la valeur, sélectionné en repli. */
  targetRef?: RefObject<HTMLElement | null>;
  /** Libellé au repos (le libellé de succès est fixe : « Copié »). */
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Identifiant du bouton et base de celui du message de repli. */
  testId?: string;
};

export function CopyButton({
  value,
  targetRef,
  label = COPY_LABEL,
  className = "h-10 rounded-xl border-border font-bold",
  disabled = false,
  testId,
}: CopyButtonProps) {
  const [feedback, setFeedback] = useState<CopyOutcome | "idle">("idle");

  // Une NOUVELLE valeur n’est pas « déjà copiée » : l’état ne suit pas le
  // composant, il suit ce qui a été copié.
  useEffect(() => {
    setFeedback("idle");
  }, [value]);

  const copy = useCallback(async () => {
    const outcome = await copyTextToClipboard(value);
    if (outcome === "failed") {
      // Repli proposé par l’écran, pas par le presse-papiers : la valeur reste
      // sous les yeux et se recopie à la main.
      selectElementText(targetRef?.current ?? null);
    }
    setFeedback(outcome);
  }, [value, targetRef]);

  const failed = feedback === "failed";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        disabled={disabled}
        data-testid={testId}
        onClick={() => void copy()}
      >
        {feedback === "copied" ? (
          <Check className="mr-2 h-4 w-4" aria-hidden="true" />
        ) : (
          <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {feedback === "copied" ? COPIED_LABEL : label}
      </Button>
      {failed && (
        <p
          role="status"
          data-testid={testId ? `${testId}-fallback` : "copy-fallback"}
          className="flex w-full items-start gap-2 text-xs leading-5 font-semibold text-rose-800 dark:text-rose-200"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {targetRef ? COPY_FAILED_WITH_SELECTION : COPY_FAILED_MESSAGE}
        </p>
      )}
    </>
  );
}
