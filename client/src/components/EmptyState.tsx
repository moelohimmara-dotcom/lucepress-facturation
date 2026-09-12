import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  /** Icône illustrative, teintée à la couleur primaire. */
  icon: LucideIcon;
  /** Titre court, en serif éditorial. */
  title: ReactNode;
  /** Description d'aide sous le titre. */
  description?: ReactNode;
  /** Action optionnelle (bouton) affichée sous la description. */
  action?: ReactNode;
  /** Réduit la hauteur minimale pour les contextes compacts (listes inline). */
  compact?: boolean;
};

/**
 * État vide standard de Lucepres — le patron « Atelier lumineux » :
 * fond grille subtile, ornement décoratif, icône teintée primaire,
 * titre serif et description discrète.
 */
export function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`surface-grid relative flex ${compact ? "min-h-44" : "min-h-64"} flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-card px-6 text-center`}
    >
      <div className="lucepress-ornament absolute inset-0 opacity-40" aria-hidden />
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="font-editorial mt-4 text-lg font-semibold">{title}</h3>
        {description && <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
