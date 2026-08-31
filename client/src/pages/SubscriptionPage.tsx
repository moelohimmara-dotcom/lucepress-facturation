import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Clock, CreditCard, Download, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatGnf } from "@shared/billing";
import { downloadSubscriptionReceiptPdf } from "@/lib/subscriptionReceipt";

const PLANS = [
  {
    id: "trial" as const,
    name: "Essai gratuit",
    price: 0,
    period: "48 heures",
    icon: Clock,
    features: [
      "Toutes les fonctionnalités",
      "Devis et factures illimités",
      "Portail client",
      "Sans carte bancaire",
    ],
    cta: "Essai en cours",
    disabled: true,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 150_000,
    period: "mois",
    icon: Zap,
    features: [
      "Jusqu'à 5 utilisateurs",
      "Devis et factures illimités",
      "Envoi d'e-mails de relance",
      "Portail client",
      "Tableau de bord financier",
      "Support par e-mail",
    ],
    cta: "S'abonner",
    highlighted: true,
  },
  {
    id: "enterprise" as const,
    name: "Entreprise",
    price: null,
    period: "sur devis",
    icon: Sparkles,
    features: [
      "Utilisateurs illimités",
      "Agent IA et automatisations",
      "Intégrations API & MCP",
      "Support prioritaire",
      "Formation personnalisée",
    ],
    cta: "Nous contacter",
    disabled: true,
  },
];

export default function SubscriptionPage() {
  const { data, isLoading } = trpc.subscription.status.useQuery();
  const checkout = trpc.subscription.checkout.useMutation({
    onSuccess: result => {
      window.location.href = result.checkoutUrl;
    },
    onError: error => toast.error(error.message),
  });
  const [downloadingReceipt, setDownloadingReceipt] = useState<number | null>(null);

  async function handleDownloadReceipt(sub: NonNullable<typeof data>["subscriptions"][number]) {
    if (!sub.paidAt || !sub.expiresAt || !sub.monerooPaymentId) return;
    setDownloadingReceipt(sub.id);
    try {
      await downloadSubscriptionReceiptPdf({
        invoiceNumber: `REC-${String(sub.id).padStart(5, "0")}`,
        tenantName: data?.tenant?.name ?? "",
        plan: sub.plan,
        amount: sub.amount,
        currency: sub.currency,
        paidAt: new Date(sub.paidAt).toISOString(),
        expiresAt: new Date(sub.expiresAt).toISOString(),
        monerooPaymentId: sub.monerooPaymentId,
      });
    } catch {
      toast.error("Erreur lors de la génération du reçu.");
    } finally {
      setDownloadingReceipt(null);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const tenant = data?.tenant;
  const isTrial = tenant?.status === "trial";
  const isActive = tenant?.status === "active";
  const isSuspended = tenant?.status === "suspended";
  const trialEndsAt = tenant?.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  const trialExpired = isTrial && trialEndsAt && trialEndsAt < new Date();
  const currentPeriodEnd = tenant?.currentPeriodEnd ? new Date(tenant.currentPeriodEnd) : null;
  const daysUntilExpiry = currentPeriodEnd && currentPeriodEnd > new Date()
    ? Math.ceil((currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const canRenew = isActive || isSuspended;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-border pb-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Administration</p>
          <h1 className="font-editorial mt-2 text-3xl font-semibold">Abonnement</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choisissez le plan adapté à votre activité. Le paiement est sécurisé via Moneroo.
          </p>
        </header>

        {/* Status banner */}
        {isTrial && !trialExpired && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
            <Clock className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">Essai gratuit en cours</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Votre essai se termine le {trialEndsAt?.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à {trialEndsAt?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.
              </p>
            </div>
          </div>
        )}
        {trialExpired && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
            <Clock className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-bold text-destructive">Votre essai est terminé</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Souscrivez à un abonnement pour continuer à utiliser Lucepress.
              </p>
            </div>
          </div>
        )}
        {isActive && currentPeriodEnd && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 p-5">
            <Check className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-700">Abonnement actif — Plan {tenant?.plan === "pro" ? "Pro" : "Entreprise"}</p>
              <p className="mt-0.5 text-xs text-emerald-600">
                {daysUntilExpiry > 0
                  ? `Expire le ${currentPeriodEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} — ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? "s" : ""} restant${daysUntilExpiry > 1 ? "s" : ""}.`
                  : "Votre abonnement a expiré."}
              </p>
            </div>
            {daysUntilExpiry <= 7 && canRenew && (
              <Button
                onClick={() => checkout.mutate({ plan: tenant?.plan === "enterprise" ? "enterprise" : "pro" })}
                disabled={checkout.isPending}
                className="h-9 rounded-xl"
              >
                {checkout.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Renouveler
              </Button>
            )}
          </div>
        )}
        {isSuspended && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
            <Clock className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive">Abonnement expiré</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Votre abonnement a expiré. Renouvelez-le pour reprendre l'utilisation de Lucepress.
              </p>
            </div>
            <Button
              onClick={() => checkout.mutate({ plan: "pro" })}
              disabled={checkout.isPending}
              className="h-9 rounded-xl"
            >
              {checkout.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Renouveler
            </Button>
          </div>
        )}

        {/* Plans */}
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`card-shadow relative flex flex-col rounded-2xl border bg-card p-6 ${
                plan.highlighted ? "border-primary shadow-lg shadow-primary/10" : "border-border"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">
                  Recommandé
                </span>
              )}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <plan.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-bold">{plan.name}</h2>
              <div className="mt-2">
                {plan.price !== null ? (
                  <p className="text-2xl font-extrabold">
                    {formatGnf(plan.price)} <span className="text-sm font-medium text-muted-foreground">GNF / {plan.period}</span>
                  </p>
                ) : (
                  <p className="text-2xl font-extrabold text-muted-foreground">{plan.period}</p>
                )}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                disabled={plan.disabled || (isActive && tenant?.plan === plan.id && daysUntilExpiry > 7) || (plan.id === "trial" && isTrial)}
                onClick={() => plan.id === "pro" && checkout.mutate({ plan: "pro" })}
                className={`mt-6 h-11 w-full rounded-xl font-bold ${
                  plan.highlighted ? "bg-primary text-primary-foreground" : ""
                }`}
                variant={plan.highlighted ? "default" : "outline"}
              >
                {checkout.isPending && plan.id === "pro" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isActive && tenant?.plan === plan.id && daysUntilExpiry > 7
                  ? "Plan actuel"
                  : isSuspended && plan.id === "pro"
                  ? "Renouveler"
                  : plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* Payment history */}
        {data?.subscriptions && data.subscriptions.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Historique des paiements</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">Reçu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.subscriptions.map(sub => (
                    <tr key={sub.id}>
                      <td className="px-4 py-3 font-semibold capitalize">{sub.plan}</td>
                      <td className="px-4 py-3">{formatGnf(sub.amount)} {sub.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          sub.status === "success" ? "bg-emerald-100 text-emerald-700" :
                          sub.status === "pending" ? "bg-amber-100 text-amber-700" :
                          sub.status === "failed" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {sub.status === "success" ? "Payé" : sub.status === "pending" ? "En attente" : sub.status === "failed" ? "Échec" : sub.status === "expired" ? "Expiré" : sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(sub.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sub.status === "success" && sub.monerooPaymentId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            disabled={downloadingReceipt === sub.id}
                            onClick={() => handleDownloadReceipt(sub)}
                          >
                            {downloadingReceipt === sub.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            PDF
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          Paiements sécurisés par Moneroo · Annulez à tout moment
        </div>
      </div>
    </DashboardLayout>
  );
}
