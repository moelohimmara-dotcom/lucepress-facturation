import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConsoleModuleRail } from "@/components/SystemConsoleDashboard";
import { SystemMetierPanel } from "@/components/SystemMetier";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — module « Données & métier » : le HUB vers le métier.
 *
 * Le rôle `systeme` est un super-administrateur : il ouvre tous les écrans de
 * l’application, métier compris. Cet écran ne les recopie pas — il y mène, par
 * navigation interne, vers les écrans existants qui restent la référence des
 * écritures (et qui les tracent déjà).
 *
 * Aucun appel serveur : le hub ne décrit que des chemins réels. L’accès à la
 * route reste protégé par `SystemGate`, et la navigation par `canAccessPath`.
 */
export default function SystemMetierPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Données & métier"
          description="Portes d’entrée vers les écrans métier de l’application — documents, clients, chantiers, prestations, créances, relances, calendrier, coûts, portail client et journal d’audit. Ce sont ces écrans qui font foi."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console/metier" onNavigate={path => setLocation(path)} />
          <SystemMetierPanel role={user?.role} onNavigate={path => setLocation(path)} />
        </div>
      </div>
    </DashboardLayout>
  );
}
