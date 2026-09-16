import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import {
  ConsoleModuleRail,
  SystemDashboard,
  type ConsoleHealth,
} from "@/components/SystemConsoleDashboard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — Phase 1 (socle) et Phase 2 (module 1).
 * Coquille : rail des modules (Phases 2 à 5) + page d’accueil
 * « Tableau de bord système » alimentée par `/api/health` et `system.overview`.
 * Lecture seule : la console n’écrit jamais dans les données commerciales.
 */
export default function SystemConsolePage() {
  const [, setLocation] = useLocation();
  const [health, setHealth] = useState<ConsoleHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [now, setNow] = useState(() => new Date());
  // Procédure protégée : prouve que le contrôle d’accès serveur est bien exercé.
  const overview = trpc.system.overview.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const loadHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const response = await fetch("/api/health", { headers: { accept: "application/json" } });
      const payload = (await response.json()) as ConsoleHealth;
      if (!response.ok) throw new Error(`Le relevé de santé a répondu ${response.status}.`);
      setHealth(payload);
      setHealthError(null);
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "Relevé de santé indisponible.");
    } finally {
      setIsLoadingHealth(false);
      setNow(new Date());
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Console d’exploitation"
          description="Supervision et administration du système Lucepres : santé, base de données, accès, environnement. En lecture seule sur les données commerciales."
          actions={
            <Button
              variant="outline"
              onClick={() => {
                void loadHealth();
                void overview.refetch();
              }}
              className="h-10 rounded-xl border-border font-bold"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          }
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console" onNavigate={path => setLocation(path)} />
          <SystemDashboard
            health={health}
            healthError={healthError}
            isLoadingHealth={isLoadingHealth}
            overview={overview.data}
            isLoadingOverview={overview.isLoading}
            overviewFailed={Boolean(overview.error)}
            now={now}
            onNavigate={path => setLocation(path)}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
