import {
  Check,
  Info,
  Minus,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import {
  APP_ROLE_LABELS,
  PERMISSION_MATRIX_ROLES,
  PROCEDURE_GUARD_ROLES,
  permissionMatrix,
  type AppRole,
  type PermissionMatrixRole,
  type ProcedureGuard,
} from "@shared/roles";

/**
 * Écran « Rôles & permissions » de la console d’exploitation (Phase 3
 * « Protéger », module 5 — étape A, lecture seule).
 *
 * La matrice est une RÉFÉRENCE, pas un réglage : elle décrit les droits que le
 * code applique aujourd’hui, dérivés de `canAccessPath` (`shared/roles.ts`) et
 * des procédures protégées (`server/_core/trpc.ts`). Aucune case n’est
 * modifiable — l’édition exigerait une table de surcharges qui n’existe pas
 * encore en base.
 *
 * Le rôle `client` n’a pas de colonne : le portail est cloisonné par
 * `CLIENT_PATHS` et ne partage aucune capacité avec l’équipe interne.
 *
 * Ce composant ne fait AUCUN appel serveur : il dérive du code partagé, donc il
 * reste lisible même si la base est indisponible. C’est précisément ce qu’il
 * annonce à l’opérateur.
 */

/** Nom court d’un rôle, tel qu’il se lit dans un résumé de procédure. */
const ROLE_SHORT_LABELS: Record<AppRole, string> = {
  admin: "admin",
  directeur: "directeur",
  cadre: "cadre",
  systeme: "système",
  client: "client",
};

/**
 * Libellé lisible d’une procédure serveur.
 *
 * LES RÔLES NE SONT PAS RECOPIÉS ICI : ils sont LUS dans
 * `PROCEDURE_GUARD_ROLES[guard]`, la table que `server/_core/trpc.ts` applique.
 * Un garde qui gagne un rôle change donc son libellé tout seul — la colonne
 * « Procédure serveur » ne peut pas se mettre à décrire autre chose que ce que
 * le serveur exige (c’est exactement ce qu’un « admin seulement » figé avait
 * cessé de faire le jour où l’administrateur système est devenu
 * super-administrateur).
 *
 * Deux gardes gardent un nom, parce qu’ils ne décrivent pas une liste de rôles :
 * la console (un espace) et la session authentifiée (une condition).
 */
function guardLabel(guard: string): string {
  if (guard === "systemProcedure") return "console d’exploitation";
  if (guard === "protectedProcedure") return "session authentifiée";
  const roles = PROCEDURE_GUARD_ROLES[guard as ProcedureGuard];
  if (!roles) return guard;
  return roles.map(role => ROLE_SHORT_LABELS[role] ?? role).join(" + ");
}

/** Résumé des procédures qui appliquent une ligne de la matrice. */
export function capabilityGuardSummary(guards: readonly string[]): string {
  const [opening, ...writes] = guards;
  const base = guardLabel(opening);
  return writes.length === 0 ? base : `${base} · écriture : ${writes.map(guardLabel).join(", ")}`;
}

function GrantCell({ granted, capabilityKey, role }: { granted: boolean; capabilityKey: string; role: PermissionMatrixRole }) {
  return (
    <td
      className="px-3 py-2.5 text-center"
      data-testid={`perm-${capabilityKey}-${role}`}
      data-granted={granted ? "oui" : "non"}
    >
      {granted ? (
        <Check className="mx-auto h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
      ) : (
        <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      )}
      <span className="sr-only">{granted ? "Autorisé" : "Refusé"}</span>
    </td>
  );
}

/** Écran « Rôles & permissions » : matrice de référence en lecture seule. */
export function SystemPermissionsPanel() {
  const rows = permissionMatrix();
  const grantedTotal = rows.reduce(
    (sum, row) => sum + PERMISSION_MATRIX_ROLES.filter(role => row.grants[role]).length,
    0,
  );

  return (
    <div className="space-y-6" data-testid="system-permissions">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">Rôles &amp; permissions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length} capacités × {PERMISSION_MATRIX_ROLES.length} rôles internes · {grantedTotal} droits ouverts
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          <UsersRound className="h-3.5 w-3.5" />
          Matrice de référence
        </span>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-extrabold">Matrice de référence — édition à venir (migration requise)</p>
          <p className="mt-1 text-xs leading-5">
            Les droits ci-dessous sont <strong>appliqués par le code</strong> : ils sont affichés pour vérification, pas
            pour être modifiés. L’édition demanderait une table de surcharges de permissions, qui n’existe pas encore en
            base ; aucune case n’est cliquable et aucune écriture n’est possible depuis cette console.
          </p>
        </div>
      </div>

      <section className="lucepress-panel rounded-[1.35rem] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="lucepress-kicker">Capacités × rôles</h2>
          <p className="text-[11px] text-muted-foreground">Droits dérivés de canAccessPath</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Matrice de référence des capacités par rôle, en lecture seule.
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                  Capacité
                </th>
                {PERMISSION_MATRIX_ROLES.map(role => (
                  <th
                    key={role}
                    scope="col"
                    data-testid={`perm-col-${role}`}
                    className="px-3 py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {APP_ROLE_LABELS[role]}
                  </th>
                ))}
                <th scope="col" className="py-2 pl-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                  Procédure serveur
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ capability, grants }) => (
                <tr
                  key={capability.key}
                  className="border-b border-border/60 last:border-b-0"
                  data-testid={`perm-row-${capability.key}`}
                >
                  <td className="py-2.5 pr-3">
                    <span className="block font-semibold text-foreground">{capability.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{capability.detail}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground/80">{capability.path}</span>
                  </td>
                  {PERMISSION_MATRIX_ROLES.map(role => (
                    <GrantCell key={role} granted={grants[role]} capabilityKey={capability.key} role={role} />
                  ))}
                  <td className="py-2.5 pl-3 text-xs leading-5 text-muted-foreground">
                    {capabilityGuardSummary(capability.guards)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> Autorisé
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" /> Refusé
          </span>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-2">
          <p className="text-sm font-extrabold">Séparation des devoirs</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Le rôle <strong>Administrateur système</strong> est un <strong>super-administrateur</strong> : il ouvre toute
            l’application, écrans métier compris, et détient en plus les habilitations de console que{" "}
            <strong>personne d’autre</strong> ne porte. La console reste donc son espace privé, et elle ne recopie pas
            le métier : elle mène aux écrans existants, qui restent la référence des écritures (voir « Données &amp;
            métier »). L’<strong>Admin</strong>, à l’inverse, administre tout le métier — comptes collaborateurs,
            modèles, intégrations, agent IA, journal d’audit — sans aucune habilitation de console. Il ne peut ni créer
            ni promouvoir un compte <span className="font-mono">systeme</span> : c’est ce qui l’empêche de s’octroyer la
            console.
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Le <strong>portail client</strong> ne figure pas dans cette matrice : ses comptes n’accèdent qu’à
            <span className="font-mono"> /portail-client</span> et à <span className="font-mono">/compte/mot-de-passe</span>,
            jamais à un écran interne.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-5 text-muted-foreground">
          Source unique : le descripteur <span className="font-mono">shared/roles.ts</span>. Chaque case est calculée par
          la même fonction que celle qui commande la navigation et les gardes d’écran (<span className="font-mono">canAccessPath</span>),
          et un test compare la matrice à ce comportement réel pour chaque rôle. Cette page ne lit rien en base : elle
          décrit le code, et reste donc lisible même si la base est indisponible.
        </p>
      </div>
    </div>
  );
}
