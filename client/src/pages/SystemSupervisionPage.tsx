import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConsoleModuleRail } from "@/components/SystemConsoleDashboard";
import { SystemSupervisionPanel } from "@/components/SystemSupervision";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — Phase 2 (module 2) : « Santé & supervision ».
 *
 * Toutes les mesures sont relevées côté serveur par `system.metrics` (lecture
 * seule : comptages, `pg_catalog`, suivi des migrations). Rien n’est calculé ni
 * inventé côté client, et aucun secret n’est transmis.
 */
export default function SystemSupervisionPage() {
  const [, setLocation] = useLocation();
  // Procédure protégée : le contrôle d’accès serveur est exercé à chaque relevé.
  const metrics = trpc.system.metrics.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const refresh = useCallback(() => {
    void metrics.refetch();
  }, [metrics]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Santé & supervision"
          description="État de la base, latence, pool de connexions, compteurs métier, stockage et suivi des migrations. Mesures serveur en lecture seule, sans secret."
          actions={
            <Button variant="outline" onClick={refresh} className="h-10 rounded-xl border-border font-bold">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          }
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console/sante" onNavigate={path => setLocation(path)} />
          <SystemSupervisionPanel
            metrics={metrics.data}
            failed={Boolean(metrics.error)}
            isLoading={metrics.isLoading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
