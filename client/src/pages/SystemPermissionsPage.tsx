import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConsoleModuleRail } from "@/components/SystemConsoleDashboard";
import { SystemPermissionsPanel } from "@/components/SystemPermissions";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — Phase 3 (module 5, étape A) : « Rôles & permissions ».
 *
 * Matrice de référence en LECTURE SEULE, dérivée du descripteur partagé
 * `shared/roles.ts` (`PERMISSION_CAPABILITIES`, `permissionFor`). L’édition
 * demanderait une table de surcharges de permissions, qui n’existe pas encore en
 * base : la page l’annonce explicitement et n’offre aucune action.
 *
 * Aucun appel serveur n’est nécessaire : la matrice décrit le code, pas la base.
 * L’accès à la route reste protégé par `SystemGate` (et la navigation par
 * `canAccessPath`).
 */
export default function SystemPermissionsPage() {
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Rôles & permissions"
          description="Matrice de référence des capacités par rôle (Admin, Directeur, Cadre, Administrateur système), telle que le code l’applique. Lecture seule — édition à venir."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console/permissions" onNavigate={path => setLocation(path)} />
          <SystemPermissionsPanel />
        </div>
      </div>
    </DashboardLayout>
  );
}
