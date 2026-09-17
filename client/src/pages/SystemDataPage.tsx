import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConsoleModuleRail } from "@/components/SystemConsoleDashboard";
import {
  SystemDataPanel,
  type ConsoleDemoCandidates,
  type ConsoleDataOverview,
  type ConsoleExportResult,
  type ConsoleNotice,
} from "@/components/SystemData";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — module « Données & conformité » (lot 3) :
 * `/console/donnees`.
 *
 * LA PAGE NE DÉCIDE RIEN — ELLE RELAIE.
 * Les volumes, l’inventaire, l’export et la purge viennent des quatre procédures
 * `system.data.*`, toutes sous `systemProcedure` (rôle `systeme`, et lui seul).
 * Le serveur revalide chaque identifiant, recalcule le nombre à confirmer et
 * vérifie le jeton d’export : la page ne fait que montrer ce qu’il répond, y
 * compris ses refus.
 *
 * LE TÉLÉCHARGEMENT SE FAIT ICI, ET PAS DANS LE PANNEAU.
 * Le panneau reste purement rendu (donc testable sans navigateur) ; c’est la
 * page qui transforme le contenu rendu par `system.data.export` en fichier. Le
 * contenu descend tel quel : aucune donnée n’est réécrite ni complétée en
 * chemin, sinon le fichier ne serait plus la preuve de ce qui a été exporté.
 */

/** Déclenche le téléchargement d’un contenu texte rendu par le serveur. */
function downloadContent(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Message d’un refus serveur, sans jamais inventer de cause. */
function refusalMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return "Le serveur a refusé le geste sans en donner la raison.";
}

export default function SystemDataPage() {
  const [, setLocation] = useLocation();
  const [notice, setNotice] = useState<ConsoleNotice | null>(null);
  const [lastExport, setLastExport] = useState<ConsoleExportResult | null>(null);

  // Procédures protégées : le contrôle d’accès serveur est exercé à chaque appel.
  const overview = trpc.system.data.overview.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const candidates = trpc.system.data.demoCandidates.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(() => {
    setNotice(null);
    void overview.refetch();
    void candidates.refetch();
  }, [overview, candidates]);

  const exportSelection = trpc.system.data.export.useMutation({
    onSuccess: result => {
      // L’export est CONSERVÉ : il porte le jeton que la purge exigera, et il
      // n’est valable que pour ce périmètre précis (voir `selectionSignature`).
      setLastExport(result);
      downloadContent(result.filename, result.content, result.contentType);
      setNotice({
        tone: "ok",
        message: `Export produit et téléchargé : ${result.filename} (${result.totalRecords} enregistrement(s), jeton valable dix minutes).`,
      });
      void candidates.refetch();
    },
    onError: error => {
      setLastExport(null);
      setNotice({ tone: "error", message: `Export refusé — ${refusalMessage(error)}` });
    },
  });

  const purgeSelection = trpc.system.data.purge.useMutation({
    onSuccess: result => {
      setLastExport(null);
      setNotice({
        tone: "ok",
        message: `Suppression enregistrée : ${result.totalRecords} enregistrement(s) sur ${result.clientIds.length} client(s). Les suppressions sont journalisées (acteur, périmètre, comptes).`,
      });
      void overview.refetch();
      void candidates.refetch();
    },
    onError: error => {
      // Le refus vient du serveur, avec sa raison : on l’affiche tel quel plutôt
      // que de le résumer. Aucune donnée n’a bougé.
      setNotice({ tone: "error", message: `Suppression refusée — ${refusalMessage(error)}` });
      // La liste est relue quand même : l’inventaire a peut-être changé sous nos pieds.
      void candidates.refetch();
      void overview.refetch();
    },
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Données"
          description="Volumes de la base, inventaire des données de démonstration, export préalable et purge sélective. Aucun secret n’est affiché, et rien n’est supprimé sans export ni confirmation écrite."
          actions={
            <Button variant="outline" onClick={refresh} className="h-10 rounded-xl border-border font-bold">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          }
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console/donnees" onNavigate={path => setLocation(path)} />
          <SystemDataPanel
            overview={overview.data as ConsoleDataOverview | undefined}
            isLoadingOverview={overview.isLoading}
            candidates={candidates.data as ConsoleDemoCandidates | undefined}
            isLoadingCandidates={candidates.isLoading}
            failed={Boolean(overview.error) || Boolean(candidates.error)}
            onExport={clientIds => exportSelection.mutate({ clientIds })}
            isExporting={exportSelection.isPending}
            lastExport={lastExport}
            onPurge={input => purgeSelection.mutate(input)}
            isPurging={purgeSelection.isPending}
            notice={notice}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
