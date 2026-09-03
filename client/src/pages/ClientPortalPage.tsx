import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { downloadPdfFromElement } from "@/lib/pdf";
import { trpc } from "@/lib/trpc";
import { formatGnf } from "@shared/billing";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { isStaffRole } from "@shared/roles";
import { ArrowLeft, CalendarDays, CheckCircle2, Download, FileText, Loader2, ReceiptText, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import React, { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("fr-GN") : "Non renseignée";
}

function quoteStatusLabel(status: string) {
  if (status === "accepte") return "Accepté";
  if (status === "refuse") return "Refusé";
  return "En attente de votre réponse";
}

function quoteStatusClass(status: string) {
  if (status === "accepte") return "bg-emerald-100 text-emerald-800";
  if (status === "refuse") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

export default function ClientPortalPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const { data: overview, isLoading } = trpc.billing.clientPortal.overview.useQuery(undefined, { enabled: isAuthenticated });
  const staffUser = isStaffRole(user?.role);

  if (loading) return <PortalShell><CenteredLoader /></PortalShell>;
  if (!user) {
    return (
      <PortalShell>
        <section className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="h-7 w-7" /></div>
          <h1 className="font-editorial mt-5 text-3xl font-semibold">Consultez vos documents</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Connectez-vous avec l’adresse e-mail renseignée sur votre fiche client pour accéder à vos devis et factures Lucepres.</p>
          <Button onClick={() => startLogin()} className="mt-7 h-11 rounded-xl bg-primary font-bold text-primary-foreground">Accéder à mon portail</Button>
        </section>
      </PortalShell>
    );
  }
  if (selectedQuoteId) return <ClientQuoteDetail quoteId={selectedQuoteId} onBack={() => setSelectedQuoteId(null)} />;
  if (selectedInvoiceId) return <ClientInvoiceDetail invoiceId={selectedInvoiceId} onBack={() => setSelectedInvoiceId(null)} />;

  const quotes = overview?.quotes ?? [];
  const invoices = overview?.invoices ?? [];

  return (
    <PortalShell>
      <main className="mx-auto max-w-5xl pb-10">
        <header className="mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Espace client sécurisé</p>
            <h1 className="font-editorial mt-2 text-3xl font-semibold">Mes documents</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Acceptez ou refusez vos devis, consultez vos factures et annoncez une date de règlement si besoin.
            </p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-primary/[0.035] px-4 py-3 text-xs font-semibold text-primary">
            Connecté : {user.email ?? "e-mail non renseigné"}
          </div>
        </header>
        {isLoading ? (
          <CenteredLoader />
        ) : !overview?.client ? (
          <section className="card-shadow rounded-2xl border border-border bg-card p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <h2 className="font-editorial mt-4 text-2xl font-semibold">{staffUser ? "Aperçu du portail client" : "Compte client à associer"}</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {staffUser
                ? "Vous êtes connecté avec un compte interne. Le portail n’affiche les documents que pour un client dont l’e-mail correspond à son compte. Invitez-le depuis sa fiche (Clients → Inviter au portail)."
                : "Aucune fiche client ne correspond à l’adresse e-mail utilisée. Contactez Lucepres pour faire associer votre adresse à votre dossier."}
            </p>
            {staffUser && (
              <Button onClick={() => setLocation("/clients")} className="mt-6 h-10 rounded-xl bg-primary font-bold text-primary-foreground">
                <UsersRound className="mr-2 h-4 w-4" />Ouvrir les fiches clients
              </Button>
            )}
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Dossier client</p>
              <p className="font-editorial mt-2 text-2xl font-semibold">{overview.client.companyName}</p>
              <p className="mt-2 text-xs text-muted-foreground">Les documents affichés sont strictement limités à ce dossier client.</p>
            </section>

            <section className="card-shadow mt-6 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <h2 className="font-editorial text-xl font-semibold">Devis à traiter</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{quotes.length} devis disponible{quotes.length > 1 ? "s" : ""}</p>
                </div>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              {quotes.length ? (
                <div className="divide-y divide-border">
                  {quotes.map(quote => (
                    <article key={quote.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-extrabold text-primary">{quote.number}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${quoteStatusClass(quote.status)}`}>{quoteStatusLabel(quote.status)}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Émis le {formatDate(quote.issueDate)} · Valide jusqu’au {formatDate(quote.validUntil)}
                          {quote.projectName ? ` · ${quote.projectName}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <p className="font-mono text-sm font-extrabold">{formatGnf(quote.total)}</p>
                        <Button onClick={() => setSelectedQuoteId(quote.id)} className="h-9 rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                          <FileText className="mr-2 h-4 w-4" />Consulter
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyQuotes />
              )}
            </section>

            <section className="card-shadow mt-6 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <h2 className="font-editorial text-xl font-semibold">Historique des factures</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{invoices.length} facture{invoices.length > 1 ? "s" : ""} disponible{invoices.length > 1 ? "s" : ""}</p>
                </div>
                <ReceiptText className="h-5 w-5 text-primary" />
              </div>
              {invoices.length ? (
                <div className="divide-y divide-border">
                  {invoices.map(invoice => (
                    <article key={invoice.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-extrabold text-primary">{invoice.number}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${invoice.balanceDue > 0 ? invoice.isOverdue ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {invoice.balanceDue > 0 ? invoice.isOverdue ? "En retard" : "Solde à régler" : "Réglée"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Émise le {formatDate(invoice.issueDate)} · Échéance : {formatDate(invoice.dueDate)}
                          {invoice.projectName ? ` · ${invoice.projectName}` : ""}
                        </p>
                        {invoice.paymentPromise && (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/[0.06] px-2.5 py-1 text-[11px] font-bold text-primary">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Règlement annoncé pour le {formatDate(invoice.paymentPromise.promisedDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-right">
                          <p className="font-mono text-sm font-extrabold">{formatGnf(invoice.total)}</p>
                          {invoice.balanceDue > 0 && <p className="mt-1 text-[11px] font-semibold text-primary">Solde : {formatGnf(invoice.balanceDue)}</p>}
                        </div>
                        <Button onClick={() => setSelectedInvoiceId(invoice.id)} className="h-9 rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                          <FileText className="mr-2 h-4 w-4" />Consulter
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyInvoices />
              )}
            </section>
          </>
        )}
      </main>
    </PortalShell>
  );
}

function ClientQuoteDetail({ quoteId, onBack }: { quoteId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: quote, isLoading } = trpc.billing.clientPortal.quote.useQuery({ id: quoteId });
  const [isExporting, setIsExporting] = useState(false);
  const respond = trpc.billing.clientPortal.respondToQuote.useMutation({
    onSuccess: result => {
      utils.billing.clientPortal.quote.invalidate({ id: quoteId });
      utils.billing.clientPortal.overview.invalidate();
      toast.success(result.status === "accepte" ? `Devis ${result.number} accepté.` : `Devis ${result.number} refusé.`);
    },
    onError: error => toast.error(error.message),
  });

  async function downloadPdf() {
    setIsExporting(true);
    try {
      await downloadPdfFromElement("client-portal-quote", `devis-${quote?.number ?? quoteId}`);
      toast.success("Votre devis PDF a été téléchargé.");
    } catch {
      toast.error("Le PDF n’a pas pu être généré. Réessayez dans un instant.");
    } finally {
      setIsExporting(false);
    }
  }

  const awaitingDecision = quote?.status === "envoye";

  return (
    <PortalShell>
      <main className="mx-auto max-w-5xl pb-10">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={onBack} className="w-fit px-0 text-primary"><ArrowLeft className="mr-2 h-4 w-4" />Retour à mes documents</Button>
          {quote && <Button onClick={downloadPdf} disabled={isExporting} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground"><Download className="mr-2 h-4 w-4" />{isExporting ? "Génération…" : "Télécharger PDF"}</Button>}
        </header>
        {isLoading ? (
          <CenteredLoader />
        ) : !quote ? (
          <section className="rounded-2xl border border-border bg-card p-10 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-3 text-sm font-extrabold">Ce devis n’est pas disponible pour votre compte.</p>
          </section>
        ) : (
          <>
            {awaitingDecision && (
              <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6">Ce devis attend votre décision. Lucepres en sera informé via le suivi client.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ documentId: quote.id, decision: "refuse" })}
                    className="h-10 rounded-xl border-rose-200 text-rose-800"
                  >
                    <XCircle className="mr-2 h-4 w-4" />Refuser
                  </Button>
                  <Button
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ documentId: quote.id, decision: "accepte" })}
                    className="h-10 rounded-xl bg-primary font-bold text-primary-foreground"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />{respond.isPending ? "Enregistrement…" : "Accepter le devis"}
                  </Button>
                </div>
              </section>
            )}
            <article id="client-portal-quote" className="card-shadow overflow-hidden rounded-2xl border border-border bg-white text-[#183a35]">
              <div className="border-b-[8px] border-[#153f38] p-6 sm:p-10">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <img src="/manus-storage/lucepress-emblem_bfa24e8e.png" alt="Emblème Lucepres" className="h-14 w-14 rounded-2xl bg-[#edf5f0] p-2" />
                    <div>
                      <p className="font-editorial text-3xl font-semibold">{LUCEPRES_PUBLIC_PROFILE.legalName}</p>
                      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4b746d]">Devis client</p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-mono text-base font-extrabold text-[#1e6051]">{quote.number}</p>
                    <p className="mt-1 text-xs text-slate-500">Émis le {formatDate(quote.issueDate)}</p>
                    <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${quoteStatusClass(quote.status)}`}>{quoteStatusLabel(quote.status)}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-7 p-6 sm:grid-cols-2 sm:p-10">
                <section>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4b746d]">Destinataire</p>
                  <p className="mt-2 text-sm font-extrabold">{quote.clientName}</p>
                  {quote.contactName && <p className="mt-1 text-sm text-slate-600">{quote.contactName}</p>}
                </section>
                <section className="sm:text-right">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4b746d]">Validité</p>
                  <p className="mt-2 text-sm">Valide jusqu’au : <strong>{formatDate(quote.validUntil)}</strong></p>
                </section>
              </div>
              <div className="px-6 pb-6 sm:px-10 sm:pb-10">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#eef5f1] text-[#28534b]">
                      <tr><th className="px-3 py-3">Désignation</th><th className="px-3 py-3 text-right">Qté</th><th className="px-3 py-3 text-right">Total</th></tr>
                    </thead>
                    <tbody>
                      {quote.lines.map(line => (
                        <tr key={line.id} className="border-t border-slate-200">
                          <td className="px-3 py-3">{line.description}</td>
                          <td className="px-3 py-3 text-right">{Number(line.quantity)}</td>
                          <td className="px-3 py-3 text-right font-mono font-bold">{formatGnf(line.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ml-auto mt-5 max-w-xs space-y-2 border-b border-[#153f38] pb-4 text-sm">
                  <TotalLine label="Total TTC" value={formatGnf(quote.total)} strong />
                </div>
                <footer className="mt-10 flex items-center justify-center gap-2 border-t border-slate-200 pt-5 text-center text-[10px] text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />Document consulté dans votre espace client sécurisé.
                </footer>
              </div>
            </article>
          </>
        )}
      </main>
    </PortalShell>
  );
}

function ClientInvoiceDetail({ invoiceId, onBack }: { invoiceId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: invoice, isLoading } = trpc.billing.clientPortal.invoice.useQuery({ id: invoiceId });
  const [isExporting, setIsExporting] = useState(false);
  const [promiseDate, setPromiseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [promiseNote, setPromiseNote] = useState("");
  const paymentPromise = trpc.billing.clientPortal.createPaymentPromise.useMutation({
    onSuccess: () => {
      utils.billing.clientPortal.invoice.invalidate({ id: invoiceId });
      utils.billing.clientPortal.overview.invalidate();
      toast.success("Votre promesse de paiement a été enregistrée.");
    },
    onError: error => toast.error(error.message),
  });
  async function downloadPdf() {
    setIsExporting(true);
    try {
      await downloadPdfFromElement("client-portal-invoice", `facture-${invoice?.number ?? invoiceId}`);
      toast.success("Votre facture PDF a été téléchargée.");
    } catch {
      toast.error("Le PDF n’a pas pu être généré. Réessayez dans un instant.");
    } finally {
      setIsExporting(false);
    }
  }
  function submitPromise(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    paymentPromise.mutate({ documentId: invoice.id, promisedDate: promiseDate, note: promiseNote || undefined });
  }

  return (
    <PortalShell>
      <main className="mx-auto max-w-5xl pb-10">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={onBack} className="w-fit px-0 text-primary"><ArrowLeft className="mr-2 h-4 w-4" />Retour à mes documents</Button>
          {invoice && <Button onClick={downloadPdf} disabled={isExporting} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground"><Download className="mr-2 h-4 w-4" />{isExporting ? "Génération…" : "Télécharger PDF"}</Button>}
        </header>
        {isLoading ? (
          <CenteredLoader />
        ) : !invoice ? (
          <section className="rounded-2xl border border-border bg-card p-10 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-3 text-sm font-extrabold">Cette facture n’est pas disponible pour votre compte.</p>
          </section>
        ) : (
          <article id="client-portal-invoice" className="card-shadow overflow-hidden rounded-2xl border border-border bg-white text-[#183a35]">
            <div className="border-b-[8px] border-[#153f38] p-6 sm:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <img src="/manus-storage/lucepress-emblem_bfa24e8e.png" alt="Emblème Lucepres" className="h-14 w-14 rounded-2xl bg-[#edf5f0] p-2" />
                  <div>
                    <p className="font-editorial text-3xl font-semibold">{LUCEPRES_PUBLIC_PROFILE.legalName}</p>
                    <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4b746d]">Facture client</p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="font-mono text-base font-extrabold text-[#1e6051]">{invoice.number}</p>
                  <p className="mt-1 text-xs text-slate-500">Émise le {formatDate(invoice.issueDate)}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-7 p-6 sm:grid-cols-2 sm:p-10">
              <section>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4b746d]">Destinataire</p>
                <p className="mt-2 text-sm font-extrabold">{invoice.clientName}</p>
                {invoice.contactName && <p className="mt-1 text-sm text-slate-600">{invoice.contactName}</p>}
              </section>
              <section className="sm:text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4b746d]">Règlement</p>
                <p className="mt-2 text-sm">Échéance : <strong>{formatDate(invoice.dueDate)}</strong></p>
                <p className="mt-1 text-sm">Statut : <strong>{invoice.balanceDue > 0 ? invoice.isOverdue ? "En retard" : "Solde à régler" : "Réglée"}</strong></p>
              </section>
            </div>
            <div className="px-6 pb-6 sm:px-10 sm:pb-10">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#eef5f1] text-[#28534b]"><tr><th className="px-3 py-3">Désignation</th><th className="px-3 py-3 text-right">Qté</th><th className="px-3 py-3 text-right">Total</th></tr></thead>
                  <tbody>
                    {invoice.lines.map(line => (
                      <tr key={line.id} className="border-t border-slate-200">
                        <td className="px-3 py-3">{line.description}</td>
                        <td className="px-3 py-3 text-right">{Number(line.quantity)}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold">{formatGnf(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ml-auto mt-5 max-w-xs space-y-2 border-b border-[#153f38] pb-4 text-sm">
                <TotalLine label="Total TTC" value={formatGnf(invoice.total)} />
                <TotalLine label="Déjà encaissé" value={formatGnf(invoice.paidAmount)} />
                <TotalLine label="Solde dû" value={formatGnf(invoice.balanceDue)} strong />
              </div>
              {invoice.balanceDue > 0 && (
                <form onSubmit={submitPromise} className="mt-7 rounded-xl border border-[#cbdcd5] bg-[#f4f9f6] p-4">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#1e6051]" />
                    <div>
                      <p className="text-sm font-extrabold">Promesse de paiement</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">Indiquez la date de règlement prévue. Cette information alimente le suivi commercial mais ne constitue pas un paiement.</p>
                    </div>
                  </div>
                  {invoice.paymentPromise && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#1e6051]">Dernière date annoncée : {formatDate(invoice.paymentPromise.promisedDate)}</p>}
                  <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                    <input aria-label="Date prévue de règlement" type="date" min={new Date().toISOString().slice(0, 10)} value={promiseDate} onChange={event => setPromiseDate(event.target.value)} className="h-10 rounded-lg border border-[#cbdcd5] bg-white px-3 text-sm" required />
                    <input aria-label="Note de promesse de paiement" maxLength={500} value={promiseNote} onChange={event => setPromiseNote(event.target.value)} className="h-10 rounded-lg border border-[#cbdcd5] bg-white px-3 text-sm" placeholder="Note facultative" />
                    <Button type="submit" disabled={paymentPromise.isPending} className="h-10 rounded-lg bg-[#1e6051] text-xs font-bold text-white">{paymentPromise.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
                  </div>
                </form>
              )}
              {invoice.payments.length > 0 && (
                <section className="mt-7">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4b746d]">Paiements enregistrés</p>
                  <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
                    {invoice.payments.map(payment => (
                      <div key={payment.id} className="flex justify-between gap-3 p-3 text-xs">
                        <span>{formatDate(payment.paidAt)}</span>
                        <strong className="font-mono text-emerald-700">+ {formatGnf(payment.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <footer className="mt-10 flex items-center justify-center gap-2 border-t border-slate-200 pt-5 text-center text-[10px] text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5" />Document consulté dans votre espace client sécurisé.
              </footer>
            </div>
          </article>
        )}
      </main>
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-grid min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <img src="/manus-storage/lucepress-emblem_bfa24e8e.png" alt="Lucepres" className="h-9 w-9 rounded-xl bg-secondary p-1.5" />
            <div>
              <p className="font-editorial text-lg font-semibold">Lucepres</p>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-primary">Portail client</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary"><ShieldCheck className="h-4 w-4" />Accès restreint</div>
        </div>
      </header>
      <div className="px-5 pt-7">{children}</div>
    </div>
  );
}
function CenteredLoader() { return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>; }
function EmptyInvoices() { return <div className="p-10 text-center"><ReceiptText className="mx-auto h-7 w-7 text-primary/50" /><p className="mt-3 text-sm font-extrabold">Aucune facture disponible</p><p className="mt-1 text-xs text-muted-foreground">Vos prochaines factures apparaitront ici après émission par Lucepres.</p></div>; }
function EmptyQuotes() { return <div className="p-10 text-center"><FileText className="mx-auto h-7 w-7 text-primary/50" /><p className="mt-3 text-sm font-extrabold">Aucun devis disponible</p><p className="mt-1 text-xs text-muted-foreground">Les devis envoyés par Lucepres apparaîtront ici pour acceptation ou refus.</p></div>; }
function TotalLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-3 ${strong ? "text-base font-extrabold text-[#1e6051]" : "text-slate-600"}`}><span>{label}</span><span className="font-mono">{value}</span></div>;
}
