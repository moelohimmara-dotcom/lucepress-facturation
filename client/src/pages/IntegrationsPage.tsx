import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Database, Info, Link2, Loader2, PlugZap, ShieldCheck, XCircle } from "lucide-react";
import React from "react";
import { toast } from "sonner";

const categoryLabel = {
  communication: "Communication",
  collaboration: "Collaboration",
  chantier: "Gestion de chantier",
  comptabilite: "Comptabilité",
} as const;

const statusMeta = {
  eligible: { label: "Éligible", className: "border-slate-200 bg-slate-50 text-slate-700" },
  credentials_pending: { label: "Accès à renseigner", className: "border-amber-200 bg-amber-50 text-amber-800" },
  testing: { label: "Vérification en cours", className: "border-blue-200 bg-blue-50 text-blue-800" },
  active: { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  degraded: { label: "À vérifier", className: "border-orange-200 bg-orange-50 text-orange-800" },
  revoked: { label: "Accès révoqué", className: "border-red-200 bg-red-50 text-red-800" },
  disabled: { label: "Désactivée", className: "border-slate-200 bg-slate-100 text-slate-600" },
} as const;

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function IntegrationsPage() {
  const utils = trpc.useUtils();
  const { data: integrations, isLoading } = trpc.billing.integrations.list.useQuery();
  const { data: audit } = trpc.billing.integrations.audit.useQuery();
  const prepare = trpc.billing.integrations.prepareConnection.useMutation({
    onSuccess: result => {
      utils.billing.integrations.list.invalidate();
      utils.billing.integrations.audit.invalidate();
      toast.success(result.reused ? "Cette connexion est déjà préparée." : "Connexion préparée : les accès restent à renseigner de façon sécurisée.");
    },
    onError: error => toast.error(error.message),
  });
  const disable = trpc.billing.integrations.disableConnection.useMutation({
    onSuccess: () => {
      utils.billing.integrations.list.invalidate();
      utils.billing.integrations.audit.invalidate();
      toast.success("Connexion désactivée et référence d’accès supprimée.");
    },
    onError: error => toast.error(error.message),
  });

  if (isLoading) return <DashboardLayout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></DashboardLayout>;

  return <DashboardLayout><div className="mx-auto max-w-6xl pb-8"><header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Administration · Connexions</p><h1 className="font-editorial mt-2 text-3xl font-semibold">Centre d’intégrations</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Préparez les connexions API et MCP compatibles avec Lucepres. Toute action externe reste bloquée tant que les accès, capacités et validations métier ne sont pas confirmés.</p></div><div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] px-4 py-3 text-xs font-semibold text-primary"><ShieldCheck className="h-4 w-4" />Aucun secret n’est affiché ni stocké dans cette page.</div></header>

  <section className="mt-6 grid gap-4 md:grid-cols-3"><OverviewCard icon={PlugZap} value={integrations?.length ?? 0} label="Fournisseurs contrôlés" /><OverviewCard icon={CheckCircle2} value={integrations?.filter(item => item.connection?.status === "active").length ?? 0} label="Connexions actives" /><OverviewCard icon={ShieldCheck} value={`${integrations?.flatMap(item => item.capabilities).filter(capability => capability.requiresApproval === "oui").length ?? 0}`} label="Actions à valider" /></section>

  <section className="mt-6 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 sm:p-5"><div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h2 className="text-sm font-extrabold">Fonctionnement du premier incrément</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Le bouton <strong>Préparer l’accès</strong> crée uniquement une demande de connexion et une trace d’audit. L’activation réelle, la vérification OAuth et tout échange de données seront ajoutés une fois les comptes fournisseurs et leurs autorisations confirmés.</p></div></div></section>

  <section className="mt-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Intégrations compatibles</h2><p className="mt-1 text-sm text-muted-foreground">Les fournisseurs sont limités à un registre administré afin d’éviter les endpoints ou serveurs MCP non approuvés.</p></div><Badge variant="outline" className="hidden border-primary/20 bg-primary/[0.035] text-primary sm:inline-flex">Registre dynamique</Badge></div><div className="mt-4 grid gap-4 md:grid-cols-2">{integrations?.map(provider => {
    const connection = provider.connection;
    const status = connection ? statusMeta[connection.status] : { label: "À préparer", className: "border-slate-200 bg-slate-50 text-slate-700" };
    const canPrepare = provider.isSupported === "oui" && (!connection || connection.status === "disabled" || connection.status === "revoked");
    const isPreparing = prepare.isPending && prepare.variables?.providerSlug === provider.slug;
    const isDisabling = disable.isPending && disable.variables?.connectionId === connection?.id;
    return <article key={provider.id} className="card-shadow flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Database className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-editorial text-xl font-semibold">{provider.name}</h3><Badge variant="outline" className="border-border bg-background text-[10px] uppercase tracking-wide">{provider.transport.toUpperCase()}</Badge></div><p className="mt-1 text-xs font-semibold text-muted-foreground">{categoryLabel[provider.category]} · {provider.authType === "oauth2" ? "OAuth 2.0" : provider.authType === "api_key" ? "Clé API" : "Sans identifiant"}</p></div></div><div className="mt-5 flex flex-wrap gap-2"><Badge variant="outline" className={status.className}>{status.label}</Badge>{provider.isSupported === "non" && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Disponibilité à venir</Badge>}</div><div className="mt-5 border-t border-border pt-4"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Capacités prévues</p><div className="mt-3 flex flex-wrap gap-2">{provider.capabilities.map(capability => <span key={capability.id} className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">{capability.label}{capability.requiresApproval === "oui" ? " · validation" : ""}</span>)}</div></div>{provider.adapterPreparation && <div className="mt-4 rounded-xl border border-border bg-muted/35 p-3"><p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Avant activation</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{provider.adapterPreparation.activationChecklist[0]}. Politique : {provider.adapterPreparation.executionPolicy === "lecture_seulement" ? "lecture seule" : "validation humaine"}.</p></div>}{connection && <div className="mt-4 rounded-xl bg-muted/45 p-3 text-xs leading-5 text-muted-foreground"><div className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-primary" />Dernière vérification : {formatDate(connection.lastHealthCheckAt)}</div>{connection.lastError && <div className="mt-2 flex items-start gap-2 text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{connection.lastError}</div>}</div>}<div className="mt-5 flex flex-wrap items-center gap-3"><Button size="sm" disabled={!canPrepare || isPreparing} onClick={() => prepare.mutate({ providerSlug: provider.slug })} className="rounded-xl bg-primary font-bold text-primary-foreground"><Link2 className="mr-2 h-4 w-4" />{isPreparing ? "Préparation…" : canPrepare ? "Préparer l’accès" : connection?.status === "credentials_pending" ? "Accès à renseigner" : provider.isSupported === "non" ? "Bientôt disponible" : "Connexion en cours"}</Button>{connection && connection.status !== "disabled" && <Button size="sm" variant="outline" disabled={isDisabling} onClick={() => disable.mutate({ connectionId: connection.id })} className="rounded-xl border-border">{isDisabling ? "Désactivation…" : "Désactiver"}</Button>}<a className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-primary underline-offset-4 hover:underline" href={provider.documentationUrl || "#"} target="_blank" rel="noreferrer">Documentation<ArrowUpRight className="h-3.5 w-3.5" /></a></div></article>;
  })}</div></section>

  <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><Clock3 className="h-5 w-5" /></div><div><h2 className="text-sm font-extrabold">Journal des préparations</h2><p className="mt-1 text-xs text-muted-foreground">Les changements de statut sont enregistrés pour faciliter le suivi administratif.</p></div></div><div className="mt-5 divide-y divide-border">{audit?.length ? audit.map(entry => <div key={entry.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="font-bold">{entry.providerName || "Centre d’intégrations"}</span><span className="text-muted-foreground">· {entry.action === "connection_prepared" ? "Accès préparé" : entry.action === "connection_disabled" ? "Connexion désactivée" : entry.action}</span></div><span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}{entry.actorName ? ` · ${entry.actorName}` : ""}</span></div>) : <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground"><XCircle className="h-4 w-4" />Aucune action d’intégration enregistrée pour le moment.</div>}</div></section></div></DashboardLayout>;
}

function OverviewCard({ icon: Icon, value, label }: { icon: typeof PlugZap; value: number | string; label: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div><div><p className="font-editorial text-2xl font-semibold">{value}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div></div></div>;
}
