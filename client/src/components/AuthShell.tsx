import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type AuthShellProps = {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Lien de retour optionnel sous le formulaire (ex: « Retour à la connexion »). */
  footerLink?: ReactNode;
};

/**
 * Décor de marque partagé par les écrans d'authentification (login,
 * mot de passe oublié, réinitialisation). Reprend les tokens signatures
 * de l'identité Lucepres : panneau éditorial vert/sable, kicker en
 * capitales espacées, titre serif, gradients radiaux.
 */
export function AuthShell({ kicker, title, description, children, footerLink }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 78% -10%, oklch(0.88 0.058 89 / 36%), transparent 32rem), radial-gradient(circle at 4% 102%, oklch(0.84 0.057 157 / 18%), transparent 28rem)",
        }}
      />
      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-stretch gap-0 px-[max(1rem,env(safe-area-inset-left,0px))] py-[max(2rem,env(safe-area-inset-top,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(2rem,env(safe-area-inset-bottom,0px))] sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-12">
        <aside
          className="relative hidden flex-col justify-between overflow-hidden rounded-[1.6rem] border border-border bg-gradient-to-br from-sidebar to-primary p-8 text-sidebar-foreground lg:flex lg:p-12"
          style={{ colorScheme: "dark" }}
        >
          <div aria-hidden className="lucepress-ornament absolute inset-0" />
          <div className="relative z-10 flex flex-col gap-10">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sidebar-primary/15 ring-1 ring-sidebar-border/60">
                <ShieldCheck className="h-5 w-5 text-sidebar-primary" aria-hidden="true" />
              </span>
              <span className="lucepress-kicker text-sidebar-primary" translate="no">{LUCEPRES_PUBLIC_PROFILE.legalName}</span>
            </div>
            <div className="max-w-sm">
              <p className="lucepress-kicker text-sidebar-foreground/70">Gestion commerciale</p>
              <h1 className="font-editorial mt-4 text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-sidebar-foreground text-balance">
                Vos devis, vos créances,
                <span className="block italic text-sidebar-primary">une seule lumière.</span>
              </h1>
              <p className="mt-5 max-w-xs text-sm leading-7 text-sidebar-foreground/75 text-pretty">
                L’espace sécurisé de <span translate="no">{LUCEPRES_PUBLIC_PROFILE.displayName}</span>. Gérez vos documents, vos clients et votre trésorerie depuis un seul endroit.
              </p>
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between gap-4 border-t border-sidebar-border/50 pt-6 text-xs text-sidebar-foreground/60">
            <span className="font-mono">{LUCEPRES_PUBLIC_PROFILE.location}</span>
            <span className="lucepress-kicker text-sidebar-foreground/70">{LUCEPRES_PUBLIC_PROFILE.positioning}</span>
          </div>
        </aside>

        <div className="flex flex-col justify-center">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <span className="lucepress-kicker text-primary" translate="no">{LUCEPRES_PUBLIC_PROFILE.legalName}</span>
            </div>

            <header className="mb-8">
              <p className="lucepress-kicker text-primary">{kicker}</p>
              <h2 className="font-editorial mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
              {description && <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">{description}</p>}
            </header>

            {children}

            {footerLink && <div className="mt-6 text-center">{footerLink}</div>}

            <p className="mt-10 text-center text-xs leading-5 text-muted-foreground/70">
              <span translate="no">{LUCEPRES_PUBLIC_PROFILE.legalName}</span> · {LUCEPRES_PUBLIC_PROFILE.location}
              <br />
              {LUCEPRES_PUBLIC_PROFILE.documentFooter}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
