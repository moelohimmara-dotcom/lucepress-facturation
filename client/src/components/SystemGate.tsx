import { useAuth } from "@/_core/hooks/useAuth";
import { IntrouvableScreen } from "@/components/IntrouvablePanel";
import { ConsoleMfaEnrollment } from "@/components/SystemMfa";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { hasSystemAccess } from "@shared/roles";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * GARDE DE L’ÉCRAN DE CONSOLE — deux verrous, un refus muet, et une trace.
 *
 * VERROU 1 — LE RÔLE. La garde s’appuie sur `hasSystemAccess`, qui dérive de
 * `canAccessPath` : la même règle commande cette garde, la navigation latérale
 * et la matrice de référence. Un `admin` est refusé ici comme partout ailleurs.
 *
 * LE REFUS EST MUET, ET C’EST LE POINT
 * ------------------------------------
 * Un rôle non habilité — ou un visiteur — ne reçoit NI « accès réservé », NI le
 * nom de l’espace, NI la moindre confirmation qu’il existe : il obtient
 * `IntrouvableScreen`, le composant EXACT que rend la route inconnue de
 * l’application. Même code, même habillage, mêmes boutons : rien à comparer,
 * rien à déduire.
 *
 * VERROU 2 — LA MFA. Un compte `systeme` sans double authentification n’obtient
 * pas les modules : la console affiche l’écran d’enrôlement et RIEN d’autre.
 * L’état est lu auprès du serveur (`mfa.status`), jamais déduit localement —
 * l’interface ne décide pas de qui a le droit d’entrer.
 *
 * DÉFAUT SÛR — en cas de doute, on refuse. Si l’état MFA ne peut pas être lu,
 * les modules ne s’affichent pas : une vérification impossible n’est pas une
 * autorisation.
 */

/** Écran de repli pendant la vérification : ni contenu, ni information. */
function GateSpinner() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );
}

/**
 * TÉMOIN DE REFUS — LA TENTATIVE DOIT ATTEINDRE LE SERVEUR POUR ÊTRE JOURNALISÉE.
 *
 * Le silence exigé est celui de l’INTERFACE. Il ne doit pas s’étendre au journal
 * du serveur, et c’est pourtant ce qui se produisait : la garde refusant côté
 * client, le navigateur n’émettait AUCUNE requête. Le geste le plus réaliste —
 * taper un chemin réservé dans la barre d’adresse — était donc précisément celui
 * que l’administrateur système ne voyait jamais.
 *
 * Ce composant signale le refus au serveur et N’EN LIT PAS LA RÉPONSE : ce qui
 * est recherché, c’est la ligne que `system.reportRefusal` écrit alors
 * (motif `role_refuse` pour un rôle non habilité, `anonyme` pour un visiteur).
 * La procédure n’accepte AUCUNE entrée : l’acteur, son rôle et son tenant
 * viennent de la session résolue par le serveur, jamais de la requête. La ligne
 * n’est donc pas forgeable, et le journal déduplique par motif, cible et acteur.
 *
 * LIMITES ASSUMÉES DE CE SILENCE — pour ne pas se raconter d’histoires :
 * - sans exécution JavaScript, ce signal n’est pas émis — mais le visiteur
 *   n’apprend alors rien non plus, et toute tentative réelle sur l’API de la
 *   console est journalisée par le refus de `systemProcedure` ;
 * - le silence porte sur ce qui est AFFICHÉ et sur le message d’erreur. Un
 *   visiteur qui inspecte les échanges réseau de son navigateur y voit cette
 *   requête, et un chemin de console est donc distinguable d’une adresse
 *   inconnue par ce canal-là. Le corriger supposerait de journaliser AUSSI
 *   chaque visite d’adresse inconnue — du bruit pour l’administrateur, au
 *   bénéfice d’une indiscrétion qui ne révèle rien de plus que ce que l’API
 *   révèle déjà (`system.*` répond `403`, jamais `404`).
 */
function ConsoleRefusalProbe() {
  const report = trpc.system.reportRefusal.useMutation();
  useEffect(() => {
    // Une seule fois par montage. Le mode strict de React peut doubler l’appel
    // en développement : le journal déduplique, aucune ligne n’est dupliquée.
    report.mutate();
    // `report` est stable d’un rendu à l’autre : l’effet ne se rejoue pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function SystemGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <GateSpinner />;

  if (!hasSystemAccess(user?.role)) {
    // REFUS MUET : l’écran exact de la route inconnue de l’application, et une
    // trace côté serveur — silencieux pour l’intéressé, visible pour qui de droit.
    return (
      <>
        <ConsoleRefusalProbe />
        <IntrouvableScreen />
      </>
    );
  }

  return <ConsoleMfaGate>{children}</ConsoleMfaGate>;
}

/**
 * Second verrou : la MFA doit être active AVANT que les modules ne s’affichent.
 *
 * Le composant ne rend ses enfants que sur un « oui » explicite du serveur
 * (`enabled === true`). Un « je ne sais pas » (`readable: false`, requête en
 * échec) laisse l’écran d’attente ou de reprise, jamais le contenu.
 */
function ConsoleMfaGate({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const status = trpc.mfa.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  if (status.isLoading) return <GateSpinner />;

  if (status.error) {
    // FAIL-CLOSED : on ne peut pas prouver que la MFA est active, donc on
    // n’ouvre pas. Le message s’adresse au seul titulaire légitime du rôle
    // système — il ne révèle rien à personne d’autre, la garde de rôle ayant
    // déjà écarté tout le monde.
    return (
      <DashboardLayout>
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-200">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="font-editorial mt-5 text-2xl font-semibold">Vérification impossible</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            L’état de la double authentification de votre compte n’a pas pu être lu. L’accès reste fermé par
            précaution : une vérification impossible n’est pas une autorisation.
          </p>
          <Button
            className="mt-6 h-10 rounded-xl bg-primary font-bold text-primary-foreground"
            onClick={() => void status.refetch()}
          >
            Réessayer
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!status.data?.enabled) {
    return (
      <DashboardLayout>
        <ConsoleMfaEnrollment
          onActivated={() => {
            // Le serveur vient de confirmer l’activation : on relit l’état, et
            // c’est CETTE relecture — pas un drapeau local — qui ouvre l’accès.
            void utils.mfa.status.invalidate();
            void utils.mfa.status.refetch();
          }}
        />
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
