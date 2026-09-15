import { Button } from "@/components/ui/button";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { Compass, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Compass className="h-8 w-8" />
        </div>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#b8862f]">Erreur 404</p>
        <h1 className="font-editorial mt-3 text-3xl font-semibold tracking-tight text-foreground">Page introuvable</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Cette page n&rsquo;existe pas ou a &eacute;t&eacute; d&eacute;plac&eacute;e. V&eacute;rifiez l&rsquo;adresse, puis revenez &agrave; l&rsquo;espace de travail.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => setLocation("/")} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground">
            <Home className="mr-2 h-4 w-4" />
            Retour &agrave; l&rsquo;accueil
          </Button>
          <Button variant="outline" onClick={() => setLocation("/login")} className="h-10 rounded-xl border-border font-bold">
            Se connecter
          </Button>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          {LUCEPRES_PUBLIC_PROFILE.legalName} &middot; Conakry, Guin&eacute;e
        </p>
      </div>
    </div>
  );
}