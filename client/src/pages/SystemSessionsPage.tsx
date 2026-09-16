import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConsoleModuleRail } from "@/components/SystemConsoleDashboard";
import {
  SystemSessionsPanel,
  sessionAccountName,
  type ConsoleSession,
  type SessionNotice,
} from "@/components/SystemSessions";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — Phase 3 (module 4, étape B1) : « Sessions actives ».
 *
 * Les données viennent de la procédure protégée `system.sessions.list`, la seule
 * action de `system.sessions.revoke`. Les deux sont réservées au SEUL rôle
 * système (voir `systemProcedure`) : l’interface ne fait que refléter une
 * décision prise côté serveur.
 */
export default function SystemSessionsPage() {
  const [, setLocation] = useLocation();
  const [notice, setNotice] = useState<SessionNotice | null>(null);
  // Session en cours de révocation : identifiant, jamais le jeton.
  const [revokingId, setRevokingId] = useState<number | null>(null);
  // Session visée par la révocation en vol, pour nommer le compte dans le
  // retour affiché. Une référence, pas un état : elle ne doit pas provoquer de
  // rendu, et elle est lue au moment du retour, pas au moment du clic.
  const target = useRef<ConsoleSession | null>(null);

  // Procédure protégée : le contrôle d’accès serveur est exercé à chaque relevé.
  const sessions = trpc.system.sessions.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const revoke = trpc.system.sessions.revoke.useMutation({
    onSuccess: result => {
      const label = target.current ? sessionAccountName(target.current) : `session #${result.id}`;
      setNotice(
        result.alreadyRevoked
          ? { tone: "warn", message: `La session de ${label} était déjà révoquée : aucun changement.` }
          : { tone: "ok", message: `Session de ${label} révoquée. Sa prochaine requête sera refusée.` },
      );
      void sessions.refetch();
    },
    onError: error => {
      // Le refus du garde-fou (auto-révocation) arrive ici : on affiche le
      // message du serveur, qui dit quoi faire, plutôt qu’un code technique.
      setNotice({ tone: "down", message: error.message });
      // Un refus n’a rien changé en base : on relit pour rester au plus près de
      // l’état réel plutôt que de laisser croire à une révocation partielle.
      void sessions.refetch();
    },
    onSettled: () => {
      setRevokingId(null);
      target.current = null;
    },
  });

  const refresh = useCallback(() => {
    setNotice(null);
    void sessions.refetch();
  }, [sessions]);

  const handleRevoke = useCallback(
    (session: ConsoleSession) => {
      setNotice(null);
      setRevokingId(session.id);
      target.current = session;
      revoke.mutate({ id: session.id });
    },
    [revoke],
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Sessions actives"
          description="Sessions ouvertes de l’instance : compte, dates, agent, IP et état, avec révocation à distance. Ni jeton ni empreinte ne transitent par cet écran."
          actions={
            <Button variant="outline" onClick={refresh} className="h-10 rounded-xl border-border font-bold">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          }
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console/sessions" onNavigate={path => setLocation(path)} />
          <SystemSessionsPanel
            sessions={sessions.data}
            failed={Boolean(sessions.error)}
            isLoading={sessions.isLoading}
            revokingId={revokingId}
            notice={notice}
            onRevoke={handleRevoke}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
