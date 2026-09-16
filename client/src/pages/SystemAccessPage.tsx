import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { SystemAccessPanel } from "@/components/SystemAccess";
import { ConsoleModuleRail } from "@/components/SystemConsoleDashboard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — Phase 3 (module 4, étape A) : « Accès & comptes ».
 *
 * Toutes les données viennent de la procédure protégée `system.access` (voir
 * `server/systemAccess.ts`) : comptes staff et portail client, invitations en
 * attente, moyens d’accès et politique de mot de passe. Étape A = **lecture
 * seule** : cette page n’offre aucune action, et le serveur n’expose que des
 * lectures. Aucun secret, aucun jeton n’est transmis.
 */
export default function SystemAccessPage() {
  const [, setLocation] = useLocation();
  // Procédure protégée : le contrôle d’accès serveur est exercé à chaque relevé.
  const access = trpc.system.access.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const refresh = useCallback(() => {
    void access.refetch();
  }, [access]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Accès & comptes"
          description="Tous les comptes de l’instance (staff et portail client), invitations en attente, moyens d’accès et politique de mot de passe. Lecture seule, sans secret."
          actions={
            <Button variant="outline" onClick={refresh} className="h-10 rounded-xl border-border font-bold">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          }
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console/acces" onNavigate={path => setLocation(path)} />
          <SystemAccessPanel
            access={access.data}
            failed={Boolean(access.error)}
            isLoading={access.isLoading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
