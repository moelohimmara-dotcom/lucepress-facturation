import { ConsoleLink, Panel, type ConsoleNavigate } from "@/components/SystemConsoleDashboard";
import { buttonVariants } from "@/components/ui/button";
import { canAccessPath } from "@shared/roles";
import {
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  FolderKanban,
  History,
  Info,
  Mail,
  ReceiptText,
  ShieldCheck,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Écran « Données & métier » de la console d’exploitation — le HUB vers le
 * métier, pas une copie du métier.
 *
 * DÉCISION DE CONCEPTION, ET ELLE EST STRUCTURANTE. Le rôle `systeme` est un
 * super-administrateur : il ouvre toute l’application, écrans métier compris
 * (voir `canAccessPath`, `shared/roles.ts`). On n’a donc PAS recopié les écrans
 * métier dans la console — les écrans existants, déjà testés, font le travail,
 * et la console se contente de mener à eux. Recopier aurait créé un second
 * chemin d’écriture à maintenir, à tester et à tenir d’accord avec le premier.
 *
 * CONSÉQUENCE À DIRE PLUTÔT QU’À CACHER : les modifications se font dans les
 * écrans métier de l’application, qui RESTENT LA RÉFÉRENCE. La console ne
 * promet ici aucune écriture de son cru ; elle décrit où aller.
 *
 * Ce composant ne fait AUCUN appel serveur : il ne lit qu’un descripteur constant
 * et `canAccessPath`, donc il s’affiche même si la base est indisponible.
 */

/** Une destination métier : un écran réel du routeur (`client/src/App.tsx`). */
export type MetierDestination = {
  label: string;
  path: string;
};

/** Un domaine métier : ce qu’il couvre, et par quels écrans on y travaille. */
export type MetierDomain = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  destinations: readonly MetierDestination[];
};

/**
 * Les domaines métier, chacun pointant vers les écrans EXISTANTS.
 *
 * Chaque `path` est un chemin réellement déclaré dans `client/src/App.tsx` : le
 * hub ne peut donc pas envoyer l’opérateur vers un écran qui n’existe pas.
 */
export const METIER_DOMAINS: readonly MetierDomain[] = [
  {
    key: "documents",
    label: "Documents — devis & factures",
    description:
      "Création, envoi, encaissement et partage des devis et factures, y compris acomptes et factures de solde.",
    icon: ReceiptText,
    destinations: [
      { label: "Ouvrir les devis", path: "/devis" },
      { label: "Ouvrir les factures", path: "/factures" },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    description: "Fiches clients, coordonnées, historique des documents et doublons éventuels.",
    icon: UsersRound,
    destinations: [{ label: "Ouvrir les clients", path: "/clients" }],
  },
  {
    key: "chantiers",
    label: "Chantiers",
    description: "Chantiers rattachés aux clients, avancement et documents liés.",
    icon: FolderKanban,
    destinations: [{ label: "Ouvrir les chantiers", path: "/chantiers" }],
  },
  {
    key: "prestations",
    label: "Prestations",
    description: "Catalogue des prestations et tarifs utilisés dans les devis.",
    icon: Wrench,
    destinations: [{ label: "Ouvrir les prestations", path: "/prestations" }],
  },
  {
    key: "creances",
    label: "Créances",
    description: "Suivi des impayés, responsables de relance et rappels.",
    icon: WalletCards,
    destinations: [{ label: "Ouvrir les créances", path: "/creances" }],
  },
  {
    key: "relances",
    label: "Relances",
    description: "Préparation et envoi des relances clients.",
    icon: Mail,
    destinations: [{ label: "Ouvrir les relances", path: "/relances" }],
  },
  {
    key: "calendrier",
    label: "Calendrier",
    description: "Échéances de devis, factures et paiements.",
    icon: CalendarDays,
    destinations: [{ label: "Ouvrir le calendrier", path: "/calendrier" }],
  },
  {
    key: "couts-chantier",
    label: "Coûts de chantier",
    description: "Dépenses de chantier, marges et export du suivi financier.",
    icon: Wrench,
    destinations: [{ label: "Ouvrir les coûts de chantier", path: "/couts-chantier" }],
  },
  {
    key: "portail-client",
    label: "Portail client",
    description: "Ce que voit un client : ses devis, ses factures et ses réponses. Aperçu côté interne.",
    icon: ShieldCheck,
    destinations: [{ label: "Ouvrir le portail client", path: "/portail-client" }],
  },
  {
    key: "journal-audit",
    label: "Journal d’audit",
    description: "Historique des actions de l’équipe : qui a écrit quoi, et quand.",
    icon: History,
    destinations: [{ label: "Ouvrir le journal d’audit", path: "/journal-audit" }],
  },
];

/** Identifiant de test stable à partir d’un chemin (`/couts-chantier`). */
function slug(path: string): string {
  return path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");
}

/**
 * Hub « Données & métier ».
 *
 * `role` sert à n’afficher que les destinations réellement ouvertes : le hub
 * décrit le droit appliqué, il ne le remplace pas. Les boutons désactivés
 * n’existent donc pas — un domaine entièrement fermé disparaît, plutôt que
 * d’afficher un bouton qui répondrait 403.
 */
export function SystemMetierPanel({
  role,
  onNavigate,
}: {
  /** Rôle de l’opérateur, tel que `canAccessPath` le juge. */
  role: string | undefined;
  onNavigate?: ConsoleNavigate;
}) {
  const domains = METIER_DOMAINS.map(domain => ({
    ...domain,
    destinations: domain.destinations.filter(destination => canAccessPath(role, destination.path)),
  })).filter(domain => domain.destinations.length > 0);

  return (
    <div className="space-y-6" data-testid="system-metier">
      <div>
        <h2 className="font-editorial text-xl font-semibold">Données &amp; métier</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {domains.length} domaines · {domains.reduce((total, domain) => total + domain.destinations.length, 0)} écrans
          métier accessibles depuis la console
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-2">
          <p className="text-sm font-extrabold">Les écrans métier restent la référence</p>
          <p className="text-xs leading-5 text-muted-foreground">
            La console ne recopie pas le métier : elle y <strong>mène</strong>. Les modifications de factures, clients,
            chantiers et créances se font dans les <strong>écrans métier de l’application</strong>, qui restent la
            référence — mêmes écrans, mêmes règles, mêmes garde-fous serveur que pour l’équipe commerciale.{" "}
            <strong>Toute écriture y est déjà tracée par l’application</strong> (journal d’audit métier) : cette console
            n’ajoute donc aucune écriture de son cru et n’ouvre aucun second chemin vers les données.
          </p>
        </div>
      </div>

      <Panel title="Domaines métier">
        <ul className="space-y-3">
          {domains.map(domain => {
            const Icon = domain.icon;
            return (
              <li
                key={domain.key}
                data-testid={`metier-domain-${domain.key}`}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{domain.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{domain.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {domain.destinations.map(destination => (
                        <ConsoleLink
                          key={destination.path}
                          href={destination.path}
                          onNavigate={onNavigate}
                          testId={`metier-open-${slug(destination.path)}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          {destination.label}
                          <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        </ConsoleLink>
                      ))}
                      <span className="font-mono text-xs text-muted-foreground">
                        {domain.destinations.map(destination => destination.path).join(" · ")}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {domains.length === 0 && (
          <p className="text-xs leading-5 text-muted-foreground">
            Aucun écran métier n’est ouvert à ce rôle : seul l’administrateur système dispose de ce hub.
          </p>
        )}

        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Les boutons « Ouvrir » mènent aux écrans existants de l’application (navigation interne, ou nouvel onglet
          selon le clic).
        </p>
      </Panel>
    </div>
  );
}
