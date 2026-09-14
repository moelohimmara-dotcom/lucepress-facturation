import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatGnf } from "@shared/billing";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowUpRight, FilePlus2, FileText, ReceiptText, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Kind = "devis" | "facture";

const statusStyle: Record<string, string> = {
  brouillon: "bg-stone-100 text-stone-600", a_envoyer: "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200", envoye: "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200",
  accepte: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200", refuse: "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200", partiellement_paye: "bg-violet-100 text-violet-800",
  paye: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200", en_retard: "bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200", annule: "bg-slate-100 dark:bg-slate-950/70 text-slate-600",
};

export function humanStatus(status: string) { return status.replaceAll("_", " "); }

export default function DocumentsPage({ kind }: { kind: Kind }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const { data: documents = [], isLoading } = trpc.billing.documents.list.useQuery({ kind });
  const filtered = useMemo(() => documents.filter(document => `${document.number} ${document.clientName} ${document.projectName || ""}`.toLowerCase().includes(query.toLowerCase())), [documents, query]);
  const deleteDocument = trpc.billing.documents.delete.useMutation({ onSuccess: () => { utils.billing.documents.list.invalidate(); utils.billing.dashboard.invalidate(); utils.billing.receivables.invalidate(); toast.success("Document supprimé."); }, onError: error => toast.error(error.message) });
  const overdueCount = documents.filter(document => document.isOverdue).length;
  const label = kind === "devis" ? "Devis" : "Factures";
  const Icon = kind === "devis" ? FileText : ReceiptText;
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl pb-10 stagger-rise">
        <PageHeader kicker="Gestion commerciale" title={label} description={<>Créez, suivez et faites évoluer vos {kind === "devis" ? "propositions commerciales" : "demandes de règlement"}.</>} actions={<Button onClick={() => setLocation(`/${kind}/nouveau`)} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/15"><FilePlus2 className="mr-2 h-4 w-4" />{kind === "devis" ? "Nouveau devis" : "Nouvelle facture"}</Button>} />
        <div className="lucepress-panel mt-6 flex h-11 max-w-md items-center gap-2 rounded-xl px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un numéro ou un client" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div>
        {kind === "facture" && overdueCount > 0 && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/70 p-4 text-red-900 dark:text-red-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-extrabold">{overdueCount} facture{overdueCount > 1 ? "s" : ""} en retard</p><p className="mt-1 text-xs leading-5">Les lignes concernées sont mises en évidence. Ouvrez une facture pour enregistrer un règlement ou consulter le solde dû.</p></div></div>}
        <section className="card-shadow mt-5 overflow-hidden rounded-2xl border border-border bg-card"><div className="hidden grid-cols-[1.1fr_1.5fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/50 px-6 py-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground md:grid"><span>Document</span><span>Client · Chantier</span><span>Statut</span><span className="text-right">Montant TTC</span><span /></div>{isLoading ? <div className="p-12 text-center text-sm text-muted-foreground">Chargement des documents…</div> : filtered.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div><h2 className="mt-4 text-sm font-extrabold">Aucun {kind} pour le moment</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Créez votre premier document pour le retrouver ici avec son statut et son montant.</p></div> : <div>{filtered.map(document => <div key={document.id} role="button" tabIndex={0} onClick={() => setLocation(`/documents/${document.id}`)} onKeyDown={event => { if (event.key === "Enter") setLocation(`/documents/${document.id}`); }} className={`grid w-full cursor-pointer gap-3 border-b border-border px-5 py-4 text-left transition-colors last:border-0 md:grid-cols-[1.1fr_1.5fr_1fr_1fr_auto] md:items-center md:gap-4 md:px-6 ${document.isOverdue ? "bg-red-50/70 hover:bg-red-50 dark:bg-red-950/70" : "hover:bg-muted/40"}`}><div><p className="font-mono text-xs font-bold text-primary">{document.number}</p><p className="mt-1 text-xs text-muted-foreground">Émis le {new Date(document.issueDate).toLocaleDateString("fr-GN")}</p></div><div><p className="text-sm font-extrabold">{document.clientName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{document.projectName || "Sans chantier associé"}</p></div><div className="flex flex-wrap gap-1.5"><Badge className={`w-fit border-0 px-2.5 py-1 text-[10px] font-extrabold capitalize ${statusStyle[document.status] || statusStyle.brouillon}`}>{humanStatus(document.status)}</Badge>{document.isOverdue && <Badge className="border-0 bg-red-600 px-2.5 py-1 text-[10px] font-extrabold text-white"><AlertTriangle className="mr-1 h-3 w-3" />Retard</Badge>}</div><div className="text-left md:text-right"><p className="font-mono text-sm font-bold">{formatGnf(document.total)}</p>{kind === "facture" && <p className={`mt-1 text-[11px] font-bold ${document.balanceDue > 0 ? "text-red-700 dark:text-red-200" : "text-emerald-700 dark:text-emerald-200"}`}>Solde : {formatGnf(document.balanceDue)}</p>}</div><div className="flex items-center justify-end gap-1"><ArrowUpRight className="hidden h-4 w-4 text-muted-foreground md:block" /><AlertDialog><AlertDialogTrigger asChild><button type="button" aria-label={`Supprimer ${document.number}`} onClick={event => event.stopPropagation()} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/70"><Trash2 className="h-4 w-4" /></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer {document.number} ?</AlertDialogTitle><AlertDialogDescription>Le document sera définitivement supprimé avec ses lignes, paiements et liens de partage. Cette action ne peut pas être annulée.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conserver</AlertDialogCancel><AlertDialogAction onClick={() => deleteDocument.mutate({ id: document.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>)}</div>}</section>
      </div>
    </DashboardLayout>
  );
}
