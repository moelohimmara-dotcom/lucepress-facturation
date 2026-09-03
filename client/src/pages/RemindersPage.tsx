import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { formatGnf } from "@shared/billing";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bot, Check, Copy, Mail, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function RemindersPage() {
  const { data: invoices = [], isLoading } = trpc.billing.documents.list.useQuery({ kind: "facture" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tone, setTone] = useState<"courtois" | "ferme">("courtois");
  const [copied, setCopied] = useState(false);
  const overdueInvoices = useMemo(() => invoices.filter(invoice => invoice.isOverdue && invoice.balanceDue > 0), [invoices]);
  const { data: selectedDetail } = trpc.billing.documents.get.useQuery(
    { id: selectedId! },
    { enabled: selectedId != null },
  );
  const { data: mailStatus } = trpc.billing.mailStatus.useQuery();
  const smtpReady = mailStatus?.smtpConfigured === true;
  const clientEmail = selectedDetail?.clientEmail?.trim() || "";
  const generate = trpc.billing.assistant.generateReminder.useMutation({
    onSuccess: () => { setCopied(false); toast.success("Modèle de relance préparé. Relisez-le avant envoi."); },
    onError: error => toast.error(error.message),
  });
  const sendEmail = trpc.billing.assistant.sendReminderEmail.useMutation({
    onSuccess: result => toast.success(`Relance envoyée à ${result.to}.`),
    onError: error => toast.error(error.message),
  });
  const reminder = generate.data?.reminder;

  async function copyReminder() {
    if (!reminder) return;
    const text = `${reminder.subject}\n\n${reminder.greeting}\n\n${reminder.body}\n\n${reminder.closing}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Le modèle a été copié.");
  }

  function sendReminder() {
    if (!reminder || !selectedId) return;
    sendEmail.mutate({
      documentId: selectedId,
      subject: reminder.subject,
      greeting: reminder.greeting,
      body: reminder.body,
      closing: reminder.closing,
    });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Recouvrement assisté</p>
            <h1 className="font-editorial mt-2 text-3xl font-semibold">Relances de factures</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Préparez un e-mail de relance, relisez-le, puis envoyez-le par SMTP. WhatsApp reste désactivé pour cette version.
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Mail className="h-5 w-5" />
          </div>
        </header>
        {mailStatus?.smtpConfigured === false && (
          <section className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">SMTP non configuré : vous pouvez préparer et copier la relance, mais l’envoi e-mail est indisponible.</p>
          </section>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="card-shadow overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-700"><AlertTriangle className="h-4 w-4" /></div>
                <div>
                  <h2 className="text-sm font-extrabold">Factures à relancer</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Sélectionnez une échéance dépassée.</p>
                </div>
              </div>
            </div>
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Chargement des factures…</p>
            ) : overdueInvoices.length ? (
              <div className="divide-y divide-border">
                {overdueInvoices.map(invoice => (
                  <button
                    key={invoice.id}
                    onClick={() => { setSelectedId(invoice.id); setCopied(false); generate.reset(); }}
                    className={`w-full p-5 text-left transition-colors ${selectedId === invoice.id ? "bg-red-50 ring-1 ring-inset ring-red-200" : "hover:bg-muted/40"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-bold text-primary">{invoice.number}</p>
                        <p className="mt-1 text-sm font-extrabold">{invoice.clientName}</p>
                        <p className="mt-1 text-xs text-red-700">Échéance dépassée{invoice.dueDate ? ` · ${new Date(invoice.dueDate).toLocaleDateString("fr-GN")}` : ""}</p>
                      </div>
                      <p className="font-mono text-sm font-extrabold text-red-700">{formatGnf(invoice.balanceDue)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Check className="h-5 w-5" /></div>
                <h2 className="mt-4 text-sm font-extrabold">Aucune relance nécessaire</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Aucune facture impayée en retard n’est actuellement détectée.</p>
              </div>
            )}
          </section>
          <section className="card-shadow overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Bot className="h-4 w-4" /></div>
                <div>
                  <h2 className="text-sm font-extrabold">Modèle d’e-mail IA</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Brouillon à contrôler. L’envoi SMTP est manuel et journalisé sur la fiche client.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <ToneButton selected={tone === "courtois"} onClick={() => setTone("courtois")}>Courtois</ToneButton>
                <ToneButton selected={tone === "ferme"} onClick={() => setTone("ferme")}>Plus ferme</ToneButton>
              </div>
              <Button
                onClick={() => selectedId && generate.mutate({ documentId: selectedId, tone })}
                disabled={!selectedId || generate.isPending}
                className="mt-4 h-10 rounded-xl bg-primary font-bold text-primary-foreground"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {generate.isPending ? "Préparation…" : "Générer le modèle"}
              </Button>
            </div>
            {reminder ? (
              <div className="p-5">
                <div className="rounded-xl border border-border bg-muted/25 p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Objet</p>
                  <p className="mt-2 text-sm font-extrabold">{reminder.subject}</p>
                  <div className="mt-5 space-y-3 whitespace-pre-line text-sm leading-6 text-foreground">
                    <p>{reminder.greeting}</p>
                    <p>{reminder.body}</p>
                    <p>{reminder.closing}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Ton : {reminder.tone}. Destinataire : {clientEmail || "e-mail client manquant"}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={copyReminder} className="h-9 rounded-lg border-border text-xs font-bold">
                      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                      {copied ? "Copié" : "Copier"}
                    </Button>
                    <Button
                      onClick={sendReminder}
                      disabled={sendEmail.isPending || !clientEmail || !smtpReady}
                      title={!smtpReady ? "SMTP non configuré" : !clientEmail ? "E-mail client manquant" : "Envoyer la relance par e-mail"}
                      className="h-9 rounded-lg bg-primary text-xs font-bold text-primary-foreground"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {sendEmail.isPending ? "Envoi…" : "Envoyer par e-mail"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[330px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Sparkles className="h-5 w-5" /></div>
                <h2 className="mt-4 text-sm font-extrabold">Préparez une relance adaptée</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Sélectionnez une facture en retard, choisissez le ton souhaité, puis générez un brouillon personnalisé.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ToneButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`h-8 rounded-lg border px-3 text-xs font-bold ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
