import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  CLIENT_ACTIVITY_TYPE_LABELS,
  CLIENT_ACTIVITY_TYPES,
  type ClientActivityType,
} from "@shared/clientActivityTypes";
import { AlertTriangle, Filter, Loader2, Mail, ScrollText, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleString("fr-GN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function typeTone(type: string) {
  if (type === "email_envoye") return "border-sky-200 bg-sky-50 text-sky-900";
  if (type === "statut_document") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (type === "relance_preparee") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function StaffAuditPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | ClientActivityType>("all");
  const [period, setPeriod] = useState("30");
  const { data = [], isLoading, error } = trpc.billing.audit.list.useQuery(
    type === "all" ? { limit: 250 } : { limit: 250, type },
  );

  const entries = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const limitMs = period === "all" ? 0 : Date.now() - Number(period) * 86_400_000;
    return data.filter(entry => {
      if (limitMs && new Date(entry.createdAt).getTime() < limitMs) return false;
      if (!lower) return true;
      const haystack = `${entry.title} ${entry.description ?? ""} ${entry.clientName} ${entry.documentNumber ?? ""} ${entry.actorName ?? ""}`.toLowerCase();
      return haystack.includes(lower);
    });
  }, [data, period, search]);

  const emailCount = data.filter(entry => entry.type === "email_envoye").length;
  const statusCount = data.filter(entry => entry.type === "statut_document").length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl py-10">
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-extrabold">Accès réservé à la direction</p>
              <p className="mt-1 text-xs leading-5">{error.message}</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl pb-10">
        <header className="border-b border-border pb-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Pilotage · Conformité</p>
          <h1 className="font-editorial mt-2 text-3xl font-semibold">Journal d’audit</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Qui a envoyé un e-mail, changé un statut document ou préparé une relance — sur tous les clients.
            Les filtres sont locaux et ne modifient rien.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric icon={ScrollText} value={data.length} label="Événements chargés" />
          <Metric icon={Mail} value={emailCount} label="E-mails envoyés" />
          <Metric icon={ShieldCheck} value={statusCount} label="Changements de statut" />
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} className="h-10 pl-9" placeholder="Client, document, acteur, objet…" />
            </div>
            <select value={type} onChange={event => setType(event.target.value as "all" | ClientActivityType)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
              <option value="all">Tous les types</option>
              {CLIENT_ACTIVITY_TYPES.map(activityType => (
                <option key={activityType} value={activityType}>{CLIENT_ACTIVITY_TYPE_LABELS[activityType]}</option>
              ))}
            </select>
            <select value={period} onChange={event => setPeriod(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="all">Tout l’historique</option>
            </select>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-primary" />
            {entries.length} événement(s) affiché(s), sur {data.length} chargé(s).
          </p>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[150px_1.2fr_0.9fr_0.7fr_0.7fr] gap-4 border-b border-border bg-secondary/60 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Date</span>
            <span>Action</span>
            <span>Client / document</span>
            <span>Auteur</span>
            <span>Type</span>
          </div>
          {entries.length ? entries.map(entry => (
            <article key={entry.id} className="grid gap-2 border-b border-border p-4 last:border-0 md:grid-cols-[150px_1.2fr_0.9fr_0.7fr_0.7fr] md:items-center md:px-5">
              <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
              <div>
                <p className="text-sm font-extrabold">{entry.title}</p>
                {entry.description && <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>}
              </div>
              <div>
                <button type="button" onClick={() => setLocation(`/clients`)} className="text-left text-xs font-bold text-primary hover:underline">{entry.clientName}</button>
                {entry.documentId && entry.documentNumber && (
                  <button type="button" onClick={() => setLocation(`/documents/${entry.documentId}`)} className="mt-1 block text-left text-[11px] font-semibold text-muted-foreground hover:text-primary hover:underline">
                    {entry.documentNumber}
                  </button>
                )}
              </div>
              <p className="text-xs font-bold">{entry.actorName || "Système"}</p>
              <Badge variant="outline" className={`w-fit ${typeTone(entry.type)}`}>
                {CLIENT_ACTIVITY_TYPE_LABELS[entry.type as ClientActivityType] ?? entry.type}
              </Badge>
            </article>
          )) : (
            <div className="p-10 text-center">
              <ScrollText className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-3 text-sm font-extrabold">Aucun événement ne correspond aux filtres.</p>
              <p className="mt-1 text-xs text-muted-foreground">Envoyez un devis ou changez un statut pour alimenter ce journal.</p>
            </div>
          )}
        </section>
      </main>
    </DashboardLayout>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof ScrollText; value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="font-editorial mt-5 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}
