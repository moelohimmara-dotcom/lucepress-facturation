import { useAuth } from "@/_core/hooks/useAuth";
import { IntrouvableScreen } from "@/components/IntrouvablePanel";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { hasSystemAccess } from "@shared/roles";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * GARDE DE L’ÉCRAN DE CONSOLE — UN SEUL VERROU, UN REFUS MUET, ET UNE TRACE.
 *
 * VERROU UNIQUE — LE RÔLE. La garde s’appuie sur `hasSystemAccess`, qui dérive
 * de `canAccessPath` : la même règle commande cette garde, la navigation latérale
 * et la matrice de référence. Un `admin` est refusé ici comme partout ailleurs.
 *
 * LA MFA N’EST PLUS UN VERROU — C’EST UNE PROPOSITION.
 * Un second écran bloquait ici les modules tant que le compte n’avait pas
 * enrôlé un second facteur. Le propriétaire de l’instance a demandé le
 * contraire — « je dois toujours avoir le choix de décider » : la console
 * s’ouvre donc au seul rôle `systeme`, et la double authentification se gère
 * depuis son tableau de bord (`ConsoleMfaManager`), où elle est PROPOSÉE et
 * jamais imposée. Le serveur n’exige plus rien de plus que le rôle
 * (`server/_core/trpc.ts`), et l’interface ne décide de rien : elle reflète.
 *
 * LE REFUS EST MUET, ET C’EST LE POINT
 * ------------------------------------
 * Un rôle non habilité — ou un visiteur — ne reçoit NI « accès réservé », NI le
 * nom de l’espace, NI la moindre confirmation qu’il existe : il obtient
 * `IntrouvableScreen`, le composant EXACT que rend la route inconnue de
 * l’application. Même code, même habillage, mêmes boutons : rien à comparer,
 * rien à déduire.
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

  // Rôle habilité : les modules s’affichent. Rien d’autre n’est demandé ici —
  // ni second facteur, ni état MFA à relire.
  return <>{children}</>;
}
