import { cn } from "@/lib/utils";

type LucepresMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  tone?: "solid" | "ghost";
};

const sizeMap = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-10 w-10 rounded-2xl",
  lg: "h-16 w-16 rounded-2xl",
} as const;

const glyphMap = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-3xl",
} as const;

/**
 * Emblème de marque Lucepres : le « L » éditorial (Fraunces italique) dans un
 * carré arrondi. Repris de l'en-tête de la sidebar et des écrans d'auth.
 */
export function LucepresMark({ size = "md", className, tone = "solid" }: LucepresMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center shadow-lg shadow-primary/20",
        sizeMap[size],
        tone === "solid"
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-primary",
        className,
      )}
    >
      <span className={cn("font-editorial italic leading-none", glyphMap[size])}>L</span>
    </span>
  );
}
