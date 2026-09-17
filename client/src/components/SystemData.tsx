import { Metric } from "@/components/Metric";
import { Panel, formatConsoleTimestamp, ConsoleStatusBadge, type StatusTone } from "@/components/SystemConsoleDashboard";
import { formatBytes, formatCount } from "@/components/SystemSupervision";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AtSign,
  CircleAlert,
  Database,
  Download,
  FileStack,
  HardDrive,
  Info,
  Loader2,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  Tag,
  Trash2,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

/**
 * ÉCRAN « DONNÉES & CONFORMITÉ » DE LA CONSOLE (module « Données », lot 3).
 *
 * Purement présentationnel : les volumes, les candidats, l’export et la purge
 * viennent des procédures `system.data.*`. Aucune valeur n’est inventée — une
 * mesure absente s’affiche « indisponible », et un inventaire illisible ne
 * propose AUCUN candidat plutôt que de faire croire qu’il n’y a rien à voir.
 *
 * CE QUE L’ÉCRAN NE FAIT PAS, ET C’EST DÉLIBÉRÉ
 * ---------------------------------------------
 * Il ne décide de rien. La sélection est humaine (cases à cocher) ; le nombre à
 * confirmer est CALCULÉ PAR LE SERVEUR et seulement recopié ici ; le refus
 * éventuel est celui du serveur, affiché tel quel. L’interface ne peut donc pas
 * autoriser une suppression que le serveur refuserait — elle ne fait que
 * l’annoncer avant l’heure.
 *
 * L’ORDRE DES GARDE-FOUS À L’ÉCRAN EST L’ORDRE DU SERVEUR, et il est visible :
 * on ne peut pas supprimer tant qu’on n’a pas exporté, et l’export devient
 * CADUC dès que la sélection change. Ce n’est pas une politesse d’interface :
 * c’est la même règle que `systemDataPurge.ts` applique sur le jeton.
 */

/** Volume compté (réponse de `system.data.overview`). */
export type ConsoleDataVolume = {
  key: string;
  label: string;
  table: string;
  count: number | null;
};

export type ConsoleDataOverview = {
  generatedAt: string;
  scope: "instance";
  database: { sizeBytes: number | null };
  volumes: ConsoleDataVolume[];
  documentsByStatus: Array<{ status: string; label: string; count: number }> | null;
  unavailable: string[];
};

export type ConsoleDemoMotif = {
  matcher: string;
  field: string;
  label: string;
  pattern: string;
  value: string;
  matched: string;
};

export type ConsoleDemoCounts = {
  documents: number;
  documentLines: number;
  payments: number;
  paymentPromises: number;
  shareLinks: number;
  activities: number;
  attachments: number;
};

export type ConsoleDemoCandidate = {
  clientId: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  motifs: ConsoleDemoMotif[];
  counts: ConsoleDemoCounts;
  totalRecords: number;
  blockedReason: null;
};

export type ConsoleDemoExcluded = {
  clientId: number;
  companyName: string;
  motifs: ConsoleDemoMotif[];
  reason: string;
};

export type ConsoleDemoCandidates = {
  generatedAt: string;
  scope: "tenant";
  rules: ReadonlyArray<{ key: string; label: string; pattern: string; fields: readonly string[]; explanation: string }>;
  candidates: ConsoleDemoCandidate[];
  excluded: ConsoleDemoExcluded[];
  totalRecords: number | null;
  unavailable: string[];
};

/** Réponse de `system.data.export` — le contenu est déjà le fichier. */
export type ConsoleExportResult = {
  generatedAt: string;
  filename: string;
  contentType: string;
  content: string;
  totalRecords: number;
  clientIds: number[];
  counts: ReadonlyArray<{ label: string; count: number }>;
  token: string;
  tokenExpiresAt: string;
};

export type ConsoleNotice = { tone: "ok" | "error"; message: string };

/** Libellé d’un champ examiné, pour afficher un motif sans jargon. */
const FIELD_LABELS: Record<string, string> = {
  companyName: "Raison sociale",
  contactName: "Contact",
  email: "Adresse e-mail",
};

export function motifFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Compteurs affichés pour un client, dans l’ordre du serveur. */
const COUNT_LABELS: ReadonlyArray<{ key: keyof ConsoleDemoCounts; label: string }> = [
  { key: "documents", label: "documents" },
  { key: "documentLines", label: "lignes" },
  { key: "payments", label: "paiements" },
  { key: "paymentPromises", label: "promesses" },
  { key: "shareLinks", label: "liens de partage" },
  { key: "activities", label: "activités" },
  { key: "attachments", label: "pièces jointes" },
];

/** Détail compact d’un client : « 3 documents · 7 lignes · 2 paiements ». */
export function formatCandidateCounts(counts: ConsoleDemoCounts): string {
  const parts = COUNT_LABELS.filter(entry => counts[entry.key] > 0).map(
    entry => `${counts[entry.key]} ${entry.label}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "aucun document associé";
}

/**
 * Phrase de confirmation attendue par le serveur.
 *
 * Écrite ici à l’identique de `expectedConfirmation` (`systemDataPurge.ts`) :
 * l’écran l’AFFICHE, il ne la valide pas. La validation qui compte est serveur,
 * et un test confronte les deux formulations.
 */
export function confirmationPhrase(totalRecords: number): string {
  return `SUPPRIMER ${totalRecords} ENREGISTREMENTS`;
}

/** Même normalisation que le serveur : seuls les espaces sont assouplis. */
export function confirmationEntered(entered: string, totalRecords: number): boolean {
  return entered.replace(/[\s\u00a0]+/g, " ").trim() === confirmationPhrase(totalRecords);
}

/**
 * Signature d’une sélection : elle change dès qu’une case est cochée ou
 * décochée. L’export est rattaché à une signature, donc il devient caduc quand
 * le périmètre change — exactement ce que le serveur exige du jeton.
 *
 * Les doublons sont retirés et l’ordre est neutralisé : c’est la même
 * normalisation ensembliste que `canonicalClientIds` côté serveur, sans quoi
 * l’écran croirait l’export caduc là où le serveur l’accepterait.
 */
export function selectionSignature(clientIds: readonly number[]): string {
  return Array.from(new Set(clientIds))
    .sort((a, b) => a - b)
    .join(",");
}

export function dataVerdict(
  overview: ConsoleDataOverview | undefined,
  candidates: ConsoleDemoCandidates | undefined,
  failed: boolean,
): { tone: StatusTone; label: string } {
  if (failed) return { tone: "down", label: "Indisponible" };
  if (!overview || !candidates) return { tone: "unknown", label: "En attente" };
  if (overview.unavailable.length > 0 || candidates.unavailable.length > 0) return { tone: "warn", label: "Attention" };
  if (candidates.totalRecords === null) return { tone: "warn", label: "Attention" };
  return { tone: "ok", label: "OK" };
}

type SystemDataPanelProps = {
  overview: ConsoleDataOverview | undefined;
  isLoadingOverview: boolean;
  candidates: ConsoleDemoCandidates | undefined;
  isLoadingCandidates: boolean;
  failed: boolean;
  /** Lance l’export du périmètre sélectionné. */
  onExport: (clientIds: number[]) => void;
  isExporting: boolean;
  /** Dernier export réussi, s’il y en a un. */
  lastExport: ConsoleExportResult | null;
  /** Lance la purge. Le serveur revalide tout : rien n’est cru sur parole ici. */
  onPurge: (input: { clientIds: number[]; confirmation: string; exportToken: string }) => void;
  isPurging: boolean;
  notice: ConsoleNotice | null;
};

/**
 * Écran complet. Les cases à cocher et la phrase vivent ICI, dans un état
 * d’interface : c’est une saisie, pas une décision. Ce qui décide reste le
 * serveur.
 */
export function SystemDataPanel({
  overview,
  isLoadingOverview,
  candidates,
  isLoadingCandidates,
  failed,
  onExport,
  isExporting,
  lastExport,
  onPurge,
  isPurging,
  notice,
}: SystemDataPanelProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState("");

  const liste = candidates?.candidates ?? [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedCandidates = liste.filter(candidate => selectedSet.has(candidate.clientId));
  const selectedRecords = selectedCandidates.reduce((total, candidate) => total + candidate.totalRecords, 0);

  // L’EXPORT EST RATTACHÉ À UNE SIGNATURE, PAS À UN CLIC. Cocher une case de
  // plus après avoir exporté rend le filet caduc : il ne couvre plus le
  // périmètre qu’on s’apprête à détruire, donc le bouton se referme.
  const signature = selectionSignature(selected);
  const exportUpToDate =
    lastExport !== null && signature.length > 0 && selectionSignature(lastExport.clientIds) === signature;

  const canPurge = exportUpToDate && confirmationEntered(phrase, selectedRecords);
  const verdict = dataVerdict(overview, candidates, failed);
  const pending = "…";

  // TROIS ÉTATS DE L’INVENTAIRE, ET PAS DEUX. `undefined` ne veut pas dire
  // « vide » : il veut dire « pas lu » — la lecture est en cours, ou elle a
  // échoué. Les confondre ferait affirmer « il n’y a rien à purger » sur une
  // lecture qui n’a jamais eu lieu : c’est exactement le mensonge que le
  // commentaire d’en-tête de ce fichier promet d’éviter.
  const inventoryLoading = isLoadingCandidates && candidates === undefined;
  const inventoryUnreadable = candidates === undefined && !isLoadingCandidates;

  function toggle(clientId: number) {
    setSelected(current =>
      current.includes(clientId) ? current.filter(id => id !== clientId) : [...current, clientId],
    );
    setConfirmOpen(false);
    setPhrase("");
  }

  return (
    <div className="space-y-6" data-testid="system-data">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">Données</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Dernier relevé : {overview ? formatConsoleTimestamp(overview.generatedAt) : "—"} · volumes en lecture seule,
            suppression très encadrée
          </p>
        </div>
        <ConsoleStatusBadge tone={verdict.tone} label={verdict.label} />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-extrabold">Les suppressions sont journalisées</p>
          <p className="text-xs leading-5">
            Un export préalable du <strong>même périmètre</strong> est exigé avant toute suppression, et la confirmation
            se fait en recopiant une phrase qui porte le <strong>nombre exact</strong> d’enregistrements.{" "}
            <strong>Chaque suppression écrit une ligne de journal</strong> (acteur, périmètre, comptes). Les comptes, les
            paramètres et les intégrations ne sont <strong>jamais</strong> touchés.
          </p>
        </div>
      </div>

      {failed && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-extrabold">Relevé indisponible</p>
            <p className="mt-1 text-xs leading-5">
              Une des procédures de l’écran n’a pas répondu. Rien n’est inventé pour autant : les mesures manquantes
              s’affichent « indisponible ». Réessayez avec « Actualiser ».
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div
          data-testid="data-notice"
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200"
          }`}
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-xs leading-5 font-semibold">{notice.message}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={HardDrive}
          value={isLoadingOverview && !overview ? pending : formatBytes(overview?.database.sizeBytes)}
          label="Taille de la base"
          tone="neutral"
          detail="pg_database_size de la base courante"
        />
        <Metric
          icon={UsersRound}
          value={isLoadingOverview && !overview ? pending : formatCount(volumeCount(overview, "clients"))}
          label="Clients"
          tone="neutral"
          detail="Instance entière, tous espaces confondus"
        />
        <Metric
          icon={FileStack}
          value={isLoadingOverview && !overview ? pending : formatCount(volumeCount(overview, "documents"))}
          label="Documents"
          tone="neutral"
          detail="Devis et factures confondus"
        />
        <Metric
          icon={ScanSearch}
          value={
            isLoadingCandidates && !candidates
              ? pending
              : candidates?.totalRecords === null || candidates === undefined
                ? "indisponible"
                : formatCount(candidates.totalRecords)
          }
          label="Candidats à la purge"
          tone={candidates && candidates.candidates.length > 0 ? "warn" : "neutral"}
          detail={
            candidates
              ? `${candidates.candidates.length} client(s) proposé(s) · ${candidates.excluded.length} écarté(s)`
              : "Inventaire des données de démonstration"
          }
        />
      </div>

      <Panel title="Volumes par table">
        {isLoadingOverview && !overview ? (
          <p className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Relevé en cours…
          </p>
        ) : (
          <ul data-testid="data-volumes" className="divide-y divide-border/60">
            {(overview?.volumes ?? []).map(volume => (
              <li key={volume.key} data-testid={`data-volume-${volume.key}`} className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
                  {volume.label}
                  <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">{volume.table}</span>
                </span>
                <span className="shrink-0 font-mono text-sm font-bold text-foreground">{formatCount(volume.count)}</span>
              </li>
            ))}
            {(overview?.volumes ?? []).length === 0 && (
              <li className="py-2 text-xs leading-5 text-muted-foreground">
                Volumes indisponibles : aucun comptage n’a pu être relevé. Rien n’est estimé à la place.
              </li>
            )}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          Comptages de l’<strong>instance entière</strong>, tous espaces confondus — c’est la question « qu’y a-t-il dans
          cette base ? ». Une mesure illisible vaut « indisponible », jamais 0.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Documents par statut">
          <ul data-testid="data-statuses" className="divide-y divide-border/60">
            {(overview?.documentsByStatus ?? []).map(entry => (
              <li key={entry.status} data-testid={`data-status-${entry.status}`} className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="text-xs font-bold text-foreground">{entry.label}</span>
                <span className="font-mono text-sm font-bold text-foreground">{formatCount(entry.count)}</span>
              </li>
            ))}
            {overview?.documentsByStatus === null && (
              <li className="py-2 text-xs text-muted-foreground">Répartition par statut indisponible.</li>
            )}
            {overview?.documentsByStatus === undefined && (
              <li className="py-2 text-xs text-muted-foreground">Relevé en cours…</li>
            )}
          </ul>
        </Panel>

        <Panel title="Règle de sélection appliquée">
          <ul data-testid="data-rules" className="space-y-2">
            {(candidates?.rules ?? []).map(rule => (
              <li key={rule.key} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs font-extrabold text-foreground">{rule.label}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{rule.pattern}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{rule.explanation}</p>
              </li>
            ))}
            {(candidates?.rules ?? []).length === 0 && (
              <li className="text-xs text-muted-foreground">Règle indisponible : aucun inventaire n’a été lu.</li>
            )}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Règle fermée et publiée : un enregistrement n’est proposé que s’il porte l’un de ces motifs, et chaque
            proposition affiche celui qui l’a déclenchée. Aucun score, aucune heuristique silencieuse.
          </p>
        </Panel>
      </div>

      <Panel title="Candidats « données de démonstration »">
        {inventoryLoading ? (
          <p className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Inventaire en cours…
          </p>
        ) : inventoryUnreadable ? (
          /*
            ÉCHEC DE LECTURE — l’état est INDÉTERMINÉ, pas vide. On le dit, et on
            ne conclut rien : « rien à purger » exige d’avoir LU la liste.
          */
          <div
            data-testid="data-inventory-unreadable"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200"
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-extrabold">Impossible de conclure : l’inventaire n’a pas été lu</p>
              <p className="mt-1 text-xs leading-5">
                La liste des candidats est <strong>inconnue</strong> — elle n’est pas vide, elle n’a pas été lue. Aucun
                client n’est proposé, aucune suppression n’est possible, et l’écran ne peut pas dire s’il reste ou non
                des données de recette. Réessayez avec « Actualiser ».
              </p>
            </div>
          </div>
        ) : candidates?.unavailable.length ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Inventaire indisponible : la base n’a pas répondu. <strong>Rien n’est proposé</strong> plutôt que de
            proposer au hasard.
          </p>
        ) : liste.length === 0 ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Aucun client ne porte de motif de donnée de recette sur cette instance. Il n’y a donc rien à purger.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="data-select-all"
                className="h-8 rounded-xl border-border font-bold"
                onClick={() => {
                  setSelected(liste.map(candidate => candidate.clientId));
                  setConfirmOpen(false);
                  setPhrase("");
                }}
              >
                Tout sélectionner
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="data-select-none"
                className="h-8 rounded-xl border-border font-bold"
                onClick={() => {
                  setSelected([]);
                  setConfirmOpen(false);
                  setPhrase("");
                }}
              >
                Tout désélectionner
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedCandidates.length} client(s) sélectionné(s) · {formatCount(selectedRecords)} enregistrement(s)
              </span>
            </div>

            <ul className="space-y-3">
              {liste.map(candidate => (
                <li
                  key={candidate.clientId}
                  data-testid={`data-candidate-${candidate.clientId}`}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      data-testid={`data-candidate-check-${candidate.clientId}`}
                      checked={selectedSet.has(candidate.clientId)}
                      onCheckedChange={() => toggle(candidate.clientId)}
                      aria-label={`Sélectionner ${candidate.companyName}`}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{candidate.companyName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {candidate.email && (
                          <span className="inline-flex items-center gap-1">
                            <AtSign className="h-3 w-3" />
                            {candidate.email}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          client {candidate.clientId}
                        </span>
                      </p>
                      <ul data-testid={`data-candidate-motifs-${candidate.clientId}`} className="mt-2 space-y-1">
                        {candidate.motifs.map((motif, index) => (
                          <li
                            key={`${motif.matcher}-${motif.field}-${index}`}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2 py-1"
                          >
                            <Tag className="h-3 w-3 shrink-0 text-primary" />
                            <span className="text-[11px] font-extrabold text-foreground">{motif.label}</span>
                            <span className="text-[11px] text-muted-foreground">{motifFieldLabel(motif.field)}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{motif.pattern}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                        <strong className="text-foreground">{candidate.totalRecords}</strong> enregistrement(s) seraient
                        supprimés — le client compris : {formatCandidateCounts(candidate.counts)}.
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {lastExport && (
              <div
                data-testid="data-export-summary"
                className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${
                  exportUpToDate
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <Download className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-extrabold">
                    {exportUpToDate ? "Export préalable enregistré" : "Export caduc : la sélection a changé"}
                  </p>
                  <p className="text-[11px] leading-5">
                    {lastExport.filename} · {formatCount(lastExport.totalRecords)} enregistrement(s) ·{" "}
                    {lastExport.counts.map(entry => `${entry.label} : ${entry.count}`).join(" · ")}. Jeton valable jusqu’à{" "}
                    {formatConsoleTimestamp(lastExport.tokenExpiresAt)}.
                  </p>
                  {!exportUpToDate && (
                    <p className="text-[11px] leading-5 font-semibold">
                      Le jeton ne couvre que le périmètre exporté : exportez à nouveau la sélection courante pour
                      pouvoir supprimer.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {candidates && candidates.excluded.length > 0 && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-extrabold text-foreground">Clients reconnus mais écartés — et pourquoi</p>
            <ul data-testid="data-excluded" className="mt-2 space-y-2">
              {candidates.excluded.map(entry => (
                <li key={entry.clientId} data-testid={`data-excluded-${entry.clientId}`} className="text-[11px] leading-5">
                  <span className="font-bold text-foreground">{entry.companyName}</span>{" "}
                  <span className="text-muted-foreground">— {entry.reason}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Ces clients <strong>ne sont pas proposés</strong> : leur suppression emporterait des données métier réelles,
              ou la base la refuserait. Ils ne comptent donc pas dans le total annoncé.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Exporter, puis supprimer">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-testid="data-export"
              onClick={() => onExport(selected)}
              disabled={selected.length === 0 || isExporting || inventoryUnreadable}
              className="h-10 rounded-xl font-bold"
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
              Exporter la sélection (JSON)
            </Button>
            <span className="text-xs text-muted-foreground">
              {inventoryUnreadable
                ? "Inventaire non lu : aucune sélection n’est vérifiable."
                : selected.length === 0
                  ? "Sélectionnez au moins un client."
                  : `${selectedCandidates.length} client(s) · ${formatCount(selectedRecords)} enregistrement(s)`}
            </span>
          </div>

          {/*
            Un périmètre sélectionné AVANT l’échec ne doit pas pouvoir être figé
            après : la liste n’est plus à l’écran, donc plus vérifiable. On ferme
            les deux gestes et on dit pourquoi.
          */}
          {inventoryUnreadable && (
            <p data-testid="data-export-blocked" className="text-xs leading-5 font-semibold text-amber-800 dark:text-amber-200">
              Inventaire non lu : l’export et la suppression restent fermés tant que l’inventaire n’a pas été relu. Un
              périmètre exporté sans sa liste ne serait plus vérifiable à l’écran.
            </p>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <Button
              data-testid="data-purge"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={!exportUpToDate || isPurging || inventoryUnreadable}
              className="h-10 rounded-xl font-bold"
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Supprimer la sélection
            </Button>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {inventoryUnreadable
                ? "Inerte : l’inventaire n’a pas été lu, donc le périmètre à détruire est inconnu."
                : exportUpToDate
                  ? "Export préalable enregistré : la suppression est déverrouillée."
                  : "Inerte tant que l’export préalable du périmètre courant n’a pas été produit — on ne détruit pas sans filet."}
            </p>

            {confirmOpen && exportUpToDate && (
              <div data-testid="data-purge-dialog" className="mt-4 space-y-3 border-t border-border pt-4">
                <p className="text-xs leading-5 text-muted-foreground">
                  Pour confirmer, recopiez exactement la phrase ci-dessous. Elle porte le nombre d’enregistrements
                  recalculé par le serveur au moment du geste :
                </p>
                <p data-testid="data-purge-phrase" className="font-mono text-sm font-extrabold text-foreground">
                  {confirmationPhrase(selectedRecords)}
                </p>
                <Input
                  data-testid="data-purge-confirm-input"
                  value={phrase}
                  onChange={event => setPhrase(event.target.value)}
                  aria-label="Phrase de confirmation"
                  placeholder="SUPPRIMER … ENREGISTREMENTS"
                  className="font-mono"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    data-testid="data-purge-submit"
                    variant="destructive"
                    disabled={!canPurge || isPurging}
                    onClick={() =>
                      onPurge({
                        clientIds: selected,
                        confirmation: phrase,
                        exportToken: lastExport?.token ?? "",
                      })
                    }
                    className="h-10 rounded-xl font-bold"
                  >
                    {isPurging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Supprimer définitivement
                  </Button>
                  <Button
                    variant="outline"
                    data-testid="data-purge-cancel"
                    onClick={() => {
                      setConfirmOpen(false);
                      setPhrase("");
                    }}
                    className="h-10 rounded-xl border-border font-bold"
                  >
                    Annuler
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    {canPurge ? "Phrase exacte : le serveur acceptera le geste." : "La phrase doit être recopiée à l’identique."}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
            <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong className="text-foreground">Les suppressions sont journalisées</strong> : chaque purge écrit une
              ligne portant l’acteur, le périmètre et le nombre d’enregistrements supprimés par table (voir le journal
              d’exploitation du serveur). Les comptes, les paramètres de la société et les intégrations ne sont jamais
              concernés par cette purge.
            </span>
          </p>
        </div>
      </Panel>
    </div>
  );
}

/** Lecture d’un volume par clé, sans inventer de valeur quand il est absent. */
export function volumeCount(overview: ConsoleDataOverview | undefined, key: string): number | null {
  return overview?.volumes.find(volume => volume.key === key)?.count ?? null;
}
