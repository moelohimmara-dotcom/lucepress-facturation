import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Petit label en capitales espacées au-dessus du titre. */
  kicker?: ReactNode;
  /** Titre principal, en serif éditorial. */
  title: ReactNode;
  /** Description courte sous le titre. */
  description?: ReactNode;
  /** Actions (boutons) alignées à droite sur desktop. */
  actions?: ReactNode;
  /** Supprime la bordure inférieure (pour les pages qui gèrent leur propre séparateur). */
  flush?: boolean;
};

/**
 * En-tête de page standard de Lucepres — le patron « Atelier lumineux » :
 * kicker en capitales espacées, titre serif Playfair, description discrète,
 * actions alignées à droite. Bordure inférieure douce par défaut.
 *
 * Usage : <PageHeader kicker="Gestion commerciale" title="Devis"
 *          description="..." actions={<Button>...</Button>} />
 */
export function PageHeader({ kicker, title, description, actions, flush }: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between ${flush ? "" : "border-b border-border pb-6"}`}>
      <div className="min-w-0">
        {kicker && <p className="lucepress-kicker">{kicker}</p>}
        <h1 className="font-editorial mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
