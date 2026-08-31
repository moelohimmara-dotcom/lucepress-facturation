import { Button } from "@/components/ui/button";
import { Clock, CreditCard, Check } from "lucide-react";
import { useLocation } from "wouter";
import { formatGnf } from "@shared/billing";

export function SubscriptionPaywall({ trialEndsAt }: { trialEndsAt: string | null }) {
  const [, setLocation] = useLocation();
  const endDate = trialEndsAt ? new Date(trialEndsAt) : null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <Clock className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Votre essai est terminé</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {endDate
            ? `Votre période d'essai s'est terminée le ${endDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`
            : "Votre période d'essai est terminée."}
          {" "}Souscrivez à un abonnement pour continuer à utiliser Lucepress.
        </p>

        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/[0.03] p-6 text-left">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Plan Pro</h2>
          </div>
          <p className="mt-2 text-2xl font-extrabold">
            {formatGnf(150_000)} <span className="text-sm font-medium text-muted-foreground">GNF / mois</span>
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Devis et factures illimités",
              "Jusqu'à 5 utilisateurs",
              "Envoi d'e-mails de relance",
              "Portail client",
              "Tableau de bord financier",
            ].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            className="mt-6 h-11 w-full rounded-xl font-bold"
            onClick={() => setLocation("/parametres/abonnement")}
          >
            S'abonner maintenant
          </Button>
        </div>
      </div>
    </div>
  );
}
