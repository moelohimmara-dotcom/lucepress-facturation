import { Button } from "@/components/ui/button";
import { downloadPdfFromElement } from "@/lib/pdf";
import { trpc } from "@/lib/trpc";
import { formatGnf } from "@shared/billing";
import { formatCompanyBankLine, formatCompanyDocumentFooter, formatCompanyLegalLine, formatCompanyRegistrationLine, LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { calculateQuotePaymentSchedule } from "@shared/paymentSchedule";
import { CheckCircle2, Download, FileText, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useParams, useSearch } from "wouter";

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("fr-GN") : "—";
}

export default function GuestDocumentPage() {
  const params = useParams<{ token: string }>();
  const search = useSearch();
  const token = params.token || "";
  const wantDownload = useMemo(() => new URLSearchParams(search).get("download") === "1", [search]);
  const [downloadAttempted, setDownloadAttempted] = useState(false);

  const { data, isLoading, error, refetch } = trpc.guest.getDocument.useQuery(
    { token },
    { enabled: token.length >= 32, retry: false },
  );

  const respond = trpc.guest.respondToQuote.useMutation({
    onSuccess: result => {
      toast.success(result.status === "accepte" ? "Devis accepté. Merci." : "Devis refusé. Lucepres en a été informé.");
      refetch();
    },
    onError: err => toast.error(err.message),
  });

  useEffect(() => {
    if (!wantDownload || downloadAttempted || !data?.document) return;
    setDownloadAttempted(true);
    void (async () => {
      try {
        await downloadPdfFromElement("lucepress-guest-document", data.document.number);
        toast.success("Téléchargement du PDF lancé.");
      } catch {
        toast.error("Le PDF n’a pas pu être généré automatiquement. Utilisez le bouton Télécharger.");
      }
    })();
  }, [wantDownload, downloadAttempted, data?.document]);

  if (isLoading) {
    return (
      <GuestShell>
        <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </GuestShell>
    );
  }

  if (error || !data) {
    return (
      <GuestShell>
        <section className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800"><ShieldCheck className="h-7 w-7" /></div>
          <h1 className="font-editorial mt-5 text-2xl font-semibold">Lien indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{error?.message || "Ce lien est invalide ou a expiré."}</p>
        </section>
      </GuestShell>
    );
  }

  const document = data.document;
  const company = data.company;
  const kindLabel = document.kind === "facture" ? "Facture" : "Devis";
  const legalLine = formatCompanyLegalLine(company);
  const registrationLine = formatCompanyRegistrationLine(company);
  const bankLine = formatCompanyBankLine(company);
  const schedule = document.kind === "devis" ? calculateQuotePaymentSchedule(document.total, document.depositPercent) : null;

  async function onDownload() {
    try {
      await downloadPdfFromElement("lucepress-guest-document", document.number);
      toast.success("PDF téléchargé.");
    } catch {
      toast.error("Le PDF n’a pas pu être généré.");
    }
  }

  return (
    <GuestShell>
      <main className="mx-auto max-w-5xl pb-12">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Consultation sécurisée</p>
            <h1 className="font-editorial mt-2 text-3xl font-semibold">{kindLabel} {document.number}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Document transmis par {company.legalName || LUCEPRES_PUBLIC_PROFILE.legalName}. Lien personnel valable jusqu’au {formatDate(data.share.expiresAt)}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onDownload} className="h-10 rounded-xl border-border font-bold">
              <Download className="mr-2 h-4 w-4" />Télécharger PDF
            </Button>
            {document.canRespond && (
              <>
                <Button
                  variant="outline"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ token, decision: "refuse" })}
                  className="h-10 rounded-xl border-rose-200 text-rose-800 font-bold"
                >
                  <XCircle className="mr-2 h-4 w-4" />Refuser
                </Button>
                <Button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ token, decision: "accepte" })}
                  className="h-10 rounded-xl bg-primary font-bold text-primary-foreground"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />Accepter le devis
                </Button>
              </>
            )}
          </div>
        </header>

        {!document.canRespond && document.kind === "devis" && (
          <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${document.status === "accepte" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : document.status === "refuse" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-border bg-muted/40 text-muted-foreground"}`}>
            Statut actuel : {document.status === "accepte" ? "Accepté" : document.status === "refuse" ? "Refusé" : document.status.replaceAll("_", " ")}
          </div>
        )}

        <article id="lucepress-guest-document" className="card-shadow mx-auto max-w-[210mm] bg-white text-[#183a35]">
          <div className="border-b-[10px] border-[#153f38] p-8 sm:p-12">
            <div className="flex flex-col justify-between gap-6 sm:flex-row">
              <div>
                <p className="font-editorial text-3xl font-semibold tracking-tight">{company.legalName || LUCEPRES_PUBLIC_PROFILE.legalName}</p>
                <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4b746d]">Hydraulique · Travaux · Services</p>
              </div>
              <div className="sm:text-right">
                <p className="font-editorial text-3xl font-semibold">{kindLabel}</p>
                <p className="mt-2 font-mono text-sm font-bold text-[#1e6051]">{document.number}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-8 p-8 sm:grid-cols-2 sm:p-12">
            <section>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#4b746d]">Destinataire</p>
              <p className="mt-3 text-sm font-extrabold">{document.clientName}</p>
              {document.contactName && <p className="mt-1 text-sm">{document.contactName}</p>}
              {document.clientAddress && <p className="mt-1 max-w-xs whitespace-pre-line text-sm leading-6 text-slate-600">{document.clientAddress}</p>}
            </section>
            <section className="sm:text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#4b746d]">Informations</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-4 sm:justify-end"><dt className="text-slate-500">Date d’émission</dt><dd className="font-bold">{formatDate(document.issueDate)}</dd></div>
                {document.kind === "devis" && document.validUntil && <div className="flex justify-between gap-4 sm:justify-end"><dt className="text-slate-500">Valide jusqu’au</dt><dd className="font-bold">{formatDate(document.validUntil)}</dd></div>}
                {document.kind === "facture" && document.dueDate && <div className="flex justify-between gap-4 sm:justify-end"><dt className="text-slate-500">Échéance</dt><dd className="font-bold">{formatDate(document.dueDate)}</dd></div>}
                {document.projectName && <div className="flex justify-between gap-4 sm:justify-end"><dt className="text-slate-500">Chantier</dt><dd className="font-bold">{document.projectName}</dd></div>}
              </dl>
            </section>
          </div>
          <div className="px-8 pb-8 sm:px-12">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-[#eef5f1] text-[#28534b]">
                  <tr>
                    <th className="px-3 py-3 font-extrabold sm:px-4">Désignation</th>
                    <th className="px-2 py-3 text-right font-extrabold">Qté</th>
                    <th className="hidden px-2 py-3 text-right font-extrabold sm:table-cell">PU</th>
                    <th className="px-3 py-3 text-right font-extrabold sm:px-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {document.lines.map(line => (
                    <tr key={line.id} className="border-t border-slate-200">
                      <td className="px-3 py-3.5 leading-5 sm:px-4">{line.description}<span className="ml-1 text-slate-400">({line.unit})</span></td>
                      <td className="px-2 py-3.5 text-right font-mono">{Number(line.quantity)}</td>
                      <td className="hidden px-2 py-3.5 text-right font-mono sm:table-cell">{new Intl.NumberFormat("fr-GN").format(line.unitPrice)}</td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold sm:px-4">{new Intl.NumberFormat("fr-GN").format(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto mt-5 max-w-xs space-y-2 border-b border-[#153f38] pb-4 text-sm">
              <div className="flex justify-between text-slate-600"><span>Sous-total</span><span className="font-mono">{formatGnf(document.subtotal)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Taxes</span><span className="font-mono">{formatGnf(document.taxTotal)}</span></div>
              {document.discountAmount > 0 && <div className="flex justify-between text-slate-600"><span>Remise · {document.discountPercent}%</span><span className="font-mono">− {formatGnf(document.discountAmount)}</span></div>}
              <div className="mt-3 flex justify-between text-base font-extrabold"><span>Total TTC</span><span className="font-mono text-[#1e6051]">{formatGnf(document.total)}</span></div>
              {document.kind === "facture" && (
                <>
                  <div className="flex justify-between text-slate-600"><span>Déjà encaissé</span><span className="font-mono">{formatGnf(document.paidAmount)}</span></div>
                  <div className="flex justify-between font-extrabold"><span>Solde dû</span><span className="font-mono text-[#1e6051]">{formatGnf(document.balanceDue)}</span></div>
                </>
              )}
            </div>
            {schedule && (
              <section className="mt-8 rounded-xl border border-[#d8e7df] bg-[#f6faf8] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#4b746d]">Échéancier proposé</p>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div><p className="font-extrabold">Acompte · {schedule.depositPercent}%</p><p className="mt-1 font-mono text-sm text-[#1e6051]">{formatGnf(schedule.depositAmount)}</p></div>
                  <div><p className="font-extrabold">Solde · {schedule.balancePercent}%</p><p className="mt-1 font-mono text-sm text-[#1e6051]">{formatGnf(schedule.balanceAmount)}</p></div>
                </div>
              </section>
            )}
            {bankLine && (
              <section className="mt-8 rounded-xl border border-[#d8e7df] bg-[#f6faf8] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#4b746d]">Règlement</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{bankLine}</p>
                {company.paymentInstructions && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-600">{company.paymentInstructions}</p>}
              </section>
            )}
            {document.notes && (
              <section className="mt-8 rounded-xl bg-[#f8faf9] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#4b746d]">Notes</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{document.notes}</p>
              </section>
            )}
            <footer className="mt-12 border-t border-slate-200 pt-5 text-center text-[10px] font-medium tracking-wide text-slate-400">
              <p>{formatCompanyDocumentFooter(company.documentFooter)}</p>
              {legalLine && <p className="mt-1">{legalLine}</p>}
              {registrationLine && <p className="mt-1">{registrationLine}</p>}
            </footer>
          </div>
        </article>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Accès limité à ce document — aucune autre donnée Lucepres n’est exposée.
        </p>
      </main>
    </GuestShell>
  );
}

function GuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f7f5] text-foreground">
      <div className="border-b border-border bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="font-editorial text-lg font-semibold tracking-tight">{LUCEPRES_PUBLIC_PROFILE.legalName}</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Espace invité</p>
        </div>
      </div>
      <div className="px-4 pt-6">{children}</div>
    </div>
  );
}
