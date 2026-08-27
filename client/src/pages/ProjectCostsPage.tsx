import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatGnf } from "@shared/billing";
import { BarChart3, CircleDollarSign, Loader2, Plus, ReceiptText, Trash2, WalletCards } from "lucide-react";
import React, { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const COST_CATEGORIES = {
  materiaux: "Matériaux",
  main_oeuvre: "Main-d’œuvre",
  transport: "Transport",
  equipement: "Équipement",
  sous_traitance: "Sous-traitance",
  autre: "Autre",
} as const;

type CostCategory = keyof typeof COST_CATEGORIES;

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("fr-GN");
}

export default function ProjectCostsPage() {
  const utils = trpc.useUtils();
  const { data: projects = [], isLoading: projectsLoading } = trpc.billing.projects.list.useQuery();
  const { data: costs = [], isLoading: costsLoading } = trpc.billing.projects.costs.list.useQuery();
  const { data: profitability = [], isLoading: profitabilityLoading } = trpc.billing.projects.costs.profitability.useQuery();
  const [projectId, setProjectId] = useState(0);
  const [category, setCategory] = useState<CostCategory>("materiaux");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredAt, setIncurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const createCost = trpc.billing.projects.costs.create.useMutation({
    onSuccess: () => {
      utils.billing.projects.costs.list.invalidate();
      utils.billing.projects.costs.profitability.invalidate();
      setDescription(""); setAmount("");
      toast.success("Le coût a été enregistré pour ce chantier.");
    },
    onError: error => toast.error(error.message),
  });
  const deleteCost = trpc.billing.projects.costs.delete.useMutation({
    onSuccess: () => { utils.billing.projects.costs.list.invalidate(); utils.billing.projects.costs.profitability.invalidate(); toast.success("Le coût a été supprimé."); },
    onError: error => toast.error(error.message),
  });
  const totals = useMemo(() => profitability.reduce((summary, project) => ({ revenue: summary.revenue + project.revenueCollected, costs: summary.costs + project.costTotal, margin: summary.margin + project.margin }), { revenue: 0, costs: 0, margin: 0 }), [profitability]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!projectId) return toast.error("Sélectionnez le chantier concerné.");
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) return toast.error("Saisissez un montant entier positif en GNF.");
    createCost.mutate({ projectId, category, description, amount: parsedAmount, incurredAt });
  }

  const loading = projectsLoading || costsLoading || profitabilityLoading;
  return <DashboardLayout><main className="mx-auto max-w-6xl pb-10"><header className="mb-7 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Pilotage financier · Chantiers</p><h1 className="font-editorial mt-2 text-3xl font-semibold">Coûts & marges chantier</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Enregistrez les coûts réels et suivez la marge réalisée à partir des règlements reçus. Les montants sont en GNF.</p></div><div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] px-4 py-3 text-xs font-semibold text-primary"><BarChart3 className="h-4 w-4" />La marge est calculée sur les encaissements, pas sur les devis.</div></header>
    <section className="grid gap-4 sm:grid-cols-3"><Metric icon={WalletCards} label="Encaissements rattachés" value={formatGnf(totals.revenue)} /><Metric icon={ReceiptText} label="Coûts enregistrés" value={formatGnf(totals.costs)} /><Metric icon={CircleDollarSign} label="Marge réalisée" value={formatGnf(totals.margin)} tone={totals.margin >= 0 ? "text-emerald-700" : "text-red-700"} /></section>
    <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"><form onSubmit={submit} className="card-shadow rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><Plus className="h-5 w-5" /></div><div><h2 className="font-editorial text-xl font-semibold">Saisir un coût</h2><p className="mt-1 text-xs text-muted-foreground">Une saisie correspond à une dépense réelle du chantier.</p></div></div><div className="mt-5 space-y-4"><CostField label="Chantier *"><select aria-label="Chantier concerné" value={projectId} onChange={event => setProjectId(Number(event.target.value))} required><option value={0}>Sélectionner un chantier</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.clientName}</option>)}</select></CostField><CostField label="Catégorie *"><select aria-label="Catégorie du coût" value={category} onChange={event => setCategory(event.target.value as CostCategory)}>{Object.entries(COST_CATEGORIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></CostField><CostField label="Description *"><input aria-label="Description du coût" value={description} onChange={event => setDescription(event.target.value)} required minLength={3} maxLength={500} placeholder="Ex. Achat de tubes de forage" /></CostField><div className="grid gap-4 sm:grid-cols-2"><CostField label="Montant (GNF) *"><input aria-label="Montant du coût en GNF" type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} required placeholder="0" /></CostField><CostField label="Date de dépense *"><input aria-label="Date du coût" type="date" value={incurredAt} onChange={event => setIncurredAt(event.target.value)} required /></CostField></div></div><Button type="submit" disabled={createCost.isPending || !projects.length} className="mt-6 h-10 w-full rounded-xl bg-primary font-bold text-primary-foreground"><Plus className="mr-2 h-4 w-4" />{createCost.isPending ? "Enregistrement…" : "Enregistrer le coût"}</Button>{!projects.length && !projectsLoading && <p className="mt-3 text-center text-xs text-muted-foreground">Créez d’abord un chantier pour pouvoir lui rattacher un coût.</p>}</form>
      <section className="card-shadow rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-editorial text-xl font-semibold">Marge par chantier</h2><p className="mt-1 text-xs text-muted-foreground">Encaissements moins coûts enregistrés.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-extrabold text-primary">{profitability.length} chantier{profitability.length > 1 ? "s" : ""}</span></div>{loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : profitability.length ? <div className="mt-5 grid gap-3">{profitability.map(project => <article key={project.id} className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-extrabold">{project.name}</p><p className="mt-1 text-xs text-muted-foreground">{project.clientName}{project.reference ? ` · ${project.reference}` : ""}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${project.margin >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{project.marginRate === null ? "Sans encaissement" : `${project.marginRate}% de marge`}</span></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><SmallMetric label="Encaissé" value={formatGnf(project.revenueCollected)} /><SmallMetric label="Coûts" value={formatGnf(project.costTotal)} /><SmallMetric label="Marge" value={formatGnf(project.margin)} tone={project.margin >= 0 ? "text-emerald-700" : "text-red-700"} /></div></article>)}</div> : <EmptyState message="Aucun chantier n’est encore disponible pour calculer une marge." />}</section></section>
    <section className="card-shadow mt-6 overflow-hidden rounded-2xl border border-border bg-card"><div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-editorial text-xl font-semibold">Journal des coûts</h2><p className="mt-1 text-xs text-muted-foreground">Chaque dépense est rattachée à un chantier et peut être corrigée en supprimant la ligne.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-extrabold text-primary">{costs.length} ligne{costs.length > 1 ? "s" : ""}</span></div>{costs.length ? <div className="divide-y divide-border">{costs.map(cost => <div key={cost.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold">{cost.description}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{COST_CATEGORIES[cost.category as CostCategory]}</span></div><p className="mt-1 text-xs text-muted-foreground">{cost.projectName} · {cost.clientName} · {formatDate(cost.incurredAt)}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><p className="font-mono text-sm font-extrabold text-foreground">− {formatGnf(cost.amount)}</p><AlertDialog><AlertDialogTrigger asChild><Button aria-label={`Supprimer le coût ${cost.description}`} variant="ghost" size="icon" className="text-destructive hover:bg-red-50 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce coût ?</AlertDialogTitle><AlertDialogDescription>Cette dépense sera retirée du calcul de marge du chantier. Cette action ne modifie aucune facture ni aucun paiement.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conserver</AlertDialogCancel><AlertDialogAction onClick={() => deleteCost.mutate({ id: cost.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer le coût</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>)}</div> : <EmptyState message="Aucun coût n’a encore été saisi. Ajoutez une dépense réelle pour suivre la marge." />}</section>
  </main></DashboardLayout>;
}

function Metric({ icon: Icon, label, value, tone = "text-foreground" }: { icon: React.ElementType; label: string; value: string; tone?: string }) { return <article className="rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div><div><p className={`font-editorial text-xl font-semibold ${tone}`}>{value}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p></div></div></article>; }
function SmallMetric({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) { return <div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className={`mt-1 font-mono text-sm font-extrabold ${tone}`}>{value}</p></div>; }
function CostField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-extrabold">{label}<div className="mt-2 [&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-border [&_input]:bg-background [&_input]:px-3 [&_input]:text-sm [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-border [&_select]:bg-background [&_select]:px-3 [&_select]:text-sm">{children}</div></label>; }
function EmptyState({ message }: { message: string }) { return <div className="p-8 text-center text-sm text-muted-foreground">{message}</div>; }
