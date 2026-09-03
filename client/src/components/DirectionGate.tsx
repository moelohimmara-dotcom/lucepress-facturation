import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { isDirectionRole } from "@shared/roles";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";

/** Bloque l’accès aux pages direction (admin + directeur) côté UI. */
export function DirectionGate({ children, title = "Accès réservé" }: { children: ReactNode; title?: string }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isDirectionRole(user?.role)) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="font-editorial mt-5 text-2xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Cette zone est réservée à la direction (admin ou directeur). Votre rôle ({user?.role ?? "inconnu"})
            ne permet pas de consulter le journal d’audit global.
          </p>
          <Button className="mt-6 h-10 rounded-xl bg-primary font-bold text-primary-foreground" onClick={() => setLocation("/")}>
            Retour à Aujourd’hui
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
