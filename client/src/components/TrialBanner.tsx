import { Clock, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import type { SubscriptionAccess } from "@/hooks/useSubscriptionAccess";

export function TrialBanner({ access }: { access: SubscriptionAccess }) {
  const [, setLocation] = useLocation();

  if (access.status !== "trial") return null;

  const trialEndsAt = access.trialEndsAt ? new Date(access.trialEndsAt) : null;
  const expired = !trialEndsAt || trialEndsAt < new Date();
  const days = access.daysRemaining ?? 0;

  if (expired) {
    return (
      <div className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-destructive">
        <div className="flex items-center gap-2 text-xs font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Votre essai est terminé — souscrivez un abonnement pour continuer
        </div>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={() => setLocation("/parametres/abonnement")}
        >
          S'abonner
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-primary/[0.06] px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs font-bold text-primary">
        <Clock className="h-4 w-4 shrink-0" />
        {days <= 1
          ? "Dernier jour d'essai gratuit"
          : `${days} jours d'essai gratuit restants`}
      </div>
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={() => setLocation("/parametres/abonnement")}
      >
        S'abonner
      </Button>
    </div>
  );
}
