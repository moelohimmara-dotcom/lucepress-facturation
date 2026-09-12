import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricProps = {
  /** Icône illustrative. */
  icon?: LucideIcon;
  /** Valeur principale, en serif éditorial. */
  value: ReactNode;
  /** Libellé court sous la valeur. */
  label: ReactNode;
  /** Détail optionnel sous le libellé. */
  detail?: ReactNode;
  /** Nuance visuelle pour signaler un état (retard, alerte). */
  tone?: "primary" | "danger" | "neutral" | "warn";
  /** Variante compacte sans icône (valeur + libellé seuls). */
  flat?: boolean;
};

const toneIcon: Record<NonNullable<MetricProps["tone"]>, string> = {
  primary: "bg-secondary text-primary",
  danger: "bg-red-50 text-red-700",
  neutral: "bg-muted text-muted-foreground",
  warn: "bg-amber-50 text-amber-700",
};

const toneValue: Record<NonNullable<MetricProps["tone"]>, string> = {
  primary: "text-foreground",
  danger: "text-red-700",
  neutral: "text-foreground",
  warn: "text-amber-700",
};

/**
 * Carte métrique standard de Lucepres — le patron « Atelier lumineux » :
 * panneau au coin doux, icône teintée, valeur en serif, libellé en capitales
 * discrètes. Sert de repère visuel cohérent pour les tableaux de bord.
 */
export function Metric({ icon: Icon, value, label, detail, tone = "primary", flat = false }: MetricProps) {
  if (flat) {
    return (
      <div className="p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        <p className={cn("mt-2 font-mono text-lg font-extrabold", toneValue[tone])}>{value}</p>
      </div>
    );
  }
  return (
    <article className="lucepress-panel rounded-[1.35rem] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneIcon[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className={cn("lucepress-value text-xl", toneValue[tone])}>{value}</p>
          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        </div>
      </div>
      {detail && <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>}
    </article>
  );
}
