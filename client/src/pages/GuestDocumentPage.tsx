import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatGnf } from "@shared/billing";
import { formatCompanyBankLine, formatCompanyDocumentFooter, formatCompanyLegalLine, formatCompanyRegistrationLine, LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { calculateQuotePaymentSchedule } from "@shared/paymentSchedule";
import { CheckCircle2, Download, FileText, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
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
    if (!wantDownload || token.length < 32) return;
    window.location.href = `/api/d/${token}.pdf`;
  }, [wantDownload, token]);

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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200"><ShieldCheck className="h-7 w-7" /></div>
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

  function onDownload() {
    window.location.href = `/api/d/${token}.pdf`;
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
            <Button variant="outline" onClick={() => { window.location.href = `/api/d/${token}.docx`; }} className="h-10 rounded-xl border-border font-bold">
              <Download className="mr-2 h-4 w-4" />Télécharger Word
            </Button>
            {document.canRespond && (
              <>
                <Button
                  variant="outline"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ token, decision: "refuse" })}
                  className="h-10 rounded-xl border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-bold"
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
          <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${document.status === "accepte" ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200" : document.status === "refuse" ? "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200" : "border-border bg-muted/40 text-muted-foreground"}`}>
            Statut actuel : {document.status === "accepte" ? "Accepté" : document.status === "refuse" ? "Refusé" : document.status.replaceAll("_", " ")}
          </div>
        )}

        <article id="lucepress-guest-document" className="card-shadow mx-auto max-w-[210mm] overflow-hidden rounded-2xl border border-[#e4ddcb] bg-white text-[#243530]">
          <div className="relative bg-gradient-to-br from-[#153f38] to-[#0f2d28] p-8 text-white sm:p-12">
            <span className="absolute inset-x-0 bottom-0 h-[5px] bg-[#d4a24e]" />
            <div className="flex items-center gap-3">
              <span className="font-editorial flex h-11 w-11 items-center justify-center rounded-xl bg-white text-2xl font-bold italic text-[#153f38]">L</span>
              <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-white/75">{company.legalName || LUCEPRES_PUBLIC_PROFILE.legalName} · Hydraulique · Travaux · Services</span>
            </div>
            <div className="mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#d4a24e]">{kindLabel}</p>
                <h1 className="font-editorial mt-2.5 text-3xl font-semibold tracking-tight">Votre {kindLabel.toLowerCase()} est disponible</h1>
              </div>
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <div className="flex items-center gap-2"><span className="text-xs text-white/70">N°</span><span className="font-mono text-sm font-bold tracking-tight">{document.number}</span></div>
              </div>
            </div>
          </div>
          <div className="grid gap-8 p-8 sm:grid-cols-2 sm:p-12">
            <section>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#63706b]">Facturé à</p>
              <p className="mt-2.5 text-base font-bold text-[#243530]">{document.clientName}</p>
              {document.contactName && <p className="mt-0.5 text-sm">{document.contactName}</p>}
              {document.clientAddress && <p className="mt-0.5 max-w-xs whitespace-pre-line text-sm leading-6 text-[#63706b]">{document.clientAddress}</p>}
            </section>
            <section>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#63706b]">Détails du document</p>
              <dl className="mt-2.5 overflow-hidden rounded-xl border border-[#e4ddcb] bg-[#fbf8f1]">
                <GuestInfoRow label="Date d’émission" value={formatDate(document.issueDate)} />
                {document.kind === "devis" && document.validUntil && <GuestInfoRow label="Valide jusqu’au" value={formatDate(document.validUntil)} />}
                {document.kind === "facture" && document.dueDate && <GuestInfoRow label="Échéance" value={formatDate(document.dueDate)} />}
                {document.projectName && <GuestInfoRow label="Chantier" value={document.projectName} />}
              </dl>
            </section>
          </div>
          <div className="px-8 pb-8 sm:px-12">
            {document.kind === "facture" && (
              <div className="mb-7 flex items-center justify-between rounded-2xl border border-[#ecd9a8] bg-gradient-to-br from-[#fbf3e2] to-[#fbf8f1] px-6 py-5">
                <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#63706b]">Solde dû</span>
                <span className="font-mono text-2xl font-extrabold text-[#153f38]">{formatGnf(document.balanceDue)}</span>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-[#e8f2ee] text-[#28534b]">
                  <tr>
                    <th className="px-3 py-3 font-extrabold sm:px-4">Désignation</th>
                    <th className="px-2 py-3 text-right font-extrabold">Qté</th>
                    <th className="hidden px-2 py-3 text-right font-extrabold sm:table-cell">PU</th>
                    <th className="px-3 py-3 text-right font-extrabold sm:px-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {document.lines.map(line => (
                    <tr key={line.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3.5 leading-5 sm:px-4">{line.description}<span className="ml-1 text-slate-400">({line.unit})</span></td>
                      <td className="px-2 py-3.5 text-right font-mono text-[#63706b]">{Number(line.quantity)}</td>
                      <td className="hidden px-2 py-3.5 text-right font-mono text-[#63706b] sm:table-cell">{new Intl.NumberFormat("fr-GN").format(line.unitPrice)}</td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold sm:px-4">{new Intl.NumberFormat("fr-GN").format(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto mt-6 w-full max-w-[320px] space-y-2 text-sm">
              <div className="flex justify-between text-[#63706b]"><span>Sous-total</span><span className="font-mono">{formatGnf(document.subtotal)}</span></div>
              <div className="flex justify-between text-[#63706b]"><span>Taxes</span><span className="font-mono">{formatGnf(document.taxTotal)}</span></div>
              {document.discountAmount > 0 && <div className="flex justify-between text-[#63706b]"><span>Remise · {document.discountPercent}%</span><span className="font-mono">− {formatGnf(document.discountAmount)}</span></div>}
              <div className="mt-3 flex justify-between border-t-2 border-[#153f38] pt-3 text-base font-extrabold"><span>Total TTC</span><span className="font-mono text-[#153f38]">{formatGnf(document.total)}</span></div>
              {document.kind === "facture" && (
                <>
                  <div className="flex justify-between text-[#63706b]"><span>Déjà encaissé</span><span className="font-mono">{formatGnf(document.paidAmount)}</span></div>
                  <div className="flex justify-between font-extrabold"><span>Solde dû</span><span className="font-mono text-[#153f38]">{formatGnf(document.balanceDue)}</span></div>
                </>
              )}
            </div>
            {(schedule || bankLine || document.notes) && (
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {schedule && (
                  <section className="rounded-xl border border-[#e4ddcb] bg-[#fbf8f1] p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#63706b]">Échéancier proposé</p>
                    <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                      <div><p className="font-extrabold">Acompte · {schedule.depositPercent}%</p><p className="mt-1 font-mono text-sm text-[#153f38]">{formatGnf(schedule.depositAmount)}</p></div>
                      <div><p className="font-extrabold">Solde · {schedule.balancePercent}%</p><p className="mt-1 font-mono text-sm text-[#153f38]">{formatGnf(schedule.balanceAmount)}</p></div>
                    </div>
                  </section>
                )}
                {bankLine && (
                  <section className="rounded-xl border border-[#e4ddcb] bg-[#fbf8f1] p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#63706b]">Règlement</p>
                    <p className="mt-2 text-xs leading-5 text-[#63706b]">{bankLine}</p>
                    {company.paymentInstructions && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#63706b]">{company.paymentInstructions}</p>}
                  </section>
                )}
                {document.notes && (
                  <section className="rounded-xl border border-[#e4ddcb] bg-[#fbf8f1] p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#63706b]">Conditions &amp; garanties</p>
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#63706b]">{document.notes}</p>
                  </section>
                )}
              </div>
            )}
            <footer className="mt-10 rounded-b-2xl bg-[#e8f2ee] px-8 py-7 text-center sm:px-12">
              <span className="mx-auto mb-3 block h-[3px] w-12 rounded bg-[#d4a24e]" />
              <p className="font-editorial text-sm font-medium italic text-[#153f38]">{formatCompanyDocumentFooter(company.documentFooter)}</p>
              {(legalLine || registrationLine) && <p className="mt-3 text-[11px] leading-relaxed text-[#4a5752]">{[legalLine, registrationLine].filter(Boolean).join(" · ")}</p>}
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
    <div className="min-h-screen bg-[#f4ede0] text-foreground">
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

function GuestInfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-[#e4ddcb] px-5 py-3 last:border-b-0"><dt className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#63706b]">{label}</dt><dd className="font-bold text-[#243530]">{value}</dd></div>;
}
