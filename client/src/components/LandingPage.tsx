import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { LucepresMark } from "./LucepresMark";

const features = [
  {
    icon: FileText,
    title: "Devis éclair",
    description: "Transformez un besoin de chantier en devis complet et validé, avec l'assistant IA ou à la main.",
  },
  {
    icon: ReceiptText,
    title: "Factures & créances",
    description: "Émettez, suivez les encaissements et gardez le cap sur les paiements attendus.",
  },
  {
    icon: WalletCards,
    title: "Pilotage financier",
    description: "Comparez les coûts réels et la marge encaissée à la prévision, par chantier.",
  },
  {
    icon: Bot,
    title: "Agent IA",
    description: "Relances, synthèses d'historique et extraction de coordonnées — en mode simulation sécurisée.",
  },
  {
    icon: UsersRound,
    title: "Portail client",
    description: "Vos clients consultent et acceptent leurs devis en toute autonomie, sur lien sécurisé.",
  },
  {
    icon: Wrench,
    title: "Catalogue métier",
    description: "Hydraulique, hygiène, maintenance : un catalogue prêt à compléter avec vos prix.",
  },
] as const;

const steps = [
  { number: "01", label: "Enregistrez vos clients", detail: "Manuellement ou par extraction IA d'un e-mail." },
  { number: "02", label: "Créez vos devis", detail: "Assistant IA ou saisie guidée, puis envoi par e-mail." },
  { number: "03", label: "Suivez les paiements", detail: "Créances, relances et marges, en un coup d'œil." },
] as const;

export function LandingPage() {
  const [, setLocation] = useLocation();
  const { data: mailStatus } = trpc.billing.mailStatus.useQuery();

  return (
    <div className="surface-grid relative min-h-screen overflow-hidden bg-background">
      <div className="lucepress-ornament pointer-events-none absolute inset-0 opacity-30" aria-hidden />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <LucepresMark />
          <span className="font-editorial text-xl font-semibold tracking-tight">{LUCEPRES_PUBLIC_PROFILE.displayName}</span>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation("/login")}
          className="h-10 rounded-xl border-border bg-card/80 font-bold backdrop-blur"
        >
          Se connecter
        </Button>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-5 pt-10 text-center sm:px-8 sm:pt-16">
        <p className="lucepress-kicker">{LUCEPRES_PUBLIC_PROFILE.positioning} · {LUCEPRES_PUBLIC_PROFILE.location}</p>
        <h1 className="font-editorial mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Vos devis, vos créances,<br className="hidden sm:block" /> une seule lumière.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Lucepres réunit la gestion commerciale, le pilotage financier et un agent IA — pensé pour les chantiers d'hydraulique, de BTP et de maintenance en Guinée.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => setLocation("/login")}
            className="h-12 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-150 active:scale-[0.97]"
          >
            Accéder à l'espace Lucepres
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <a
            href="#fonctions"
            className="inline-flex h-12 items-center rounded-xl px-4 text-sm font-bold text-muted-foreground hover:text-primary"
          >
            Découvrir les fonctions
          </a>
        </div>

        {mailStatus?.smtpConfigured === false && (
          <p className="mt-6 text-xs text-muted-foreground">
            Espace sécurisé · {LUCEPRES_PUBLIC_PROFILE.legalName}
          </p>
        )}
      </main>

      <section id="fonctions" className="relative z-10 mx-auto mt-20 max-w-6xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <p className="lucepress-kicker">Tout l'atelier</p>
          <h2 className="font-editorial mt-3 text-3xl font-semibold tracking-tight">Six gestes, un seul tableau</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Chaque fonction de Lucepres vise une décision claire : valider, envoyer, suivre.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="lucepress-panel rounded-[1.35rem] p-6 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="font-editorial mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-20 max-w-4xl px-5 sm:px-8">
        <div className="lucepress-panel rounded-[1.5rem] p-8 sm:p-10">
          <div className="mb-8 text-center">
            <p className="lucepress-kicker">En trois gestes</p>
            <h2 className="font-editorial mt-3 text-3xl font-semibold tracking-tight">Du premier client au suivi des paiements</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <span className="font-editorial text-lg font-bold">{step.number}</span>
                </div>
                <h3 className="mt-4 text-sm font-extrabold">{step.label}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-20 max-w-4xl px-5 text-center sm:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" />Devis & factures</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" />Portail client sécurisé</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" />Calendrier des échéances</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" />Agent IA en simulation</span>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-20 max-w-4xl px-5 pb-20 text-center sm:px-8">
        <div className="lucepress-panel rounded-[1.5rem] bg-primary p-10 text-primary-foreground sm:p-14">
          <h2 className="font-editorial text-3xl font-semibold leading-tight sm:text-4xl">
            Commencez dès aujourd'hui.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-primary-foreground/80">
            Connectez-vous pour accéder à vos devis, factures et chantiers.
          </p>
          <Button
            onClick={() => setLocation("/login")}
            className="mt-7 h-12 rounded-xl bg-primary-foreground px-6 text-sm font-bold text-primary shadow-lg transition-transform duration-150 active:scale-[0.97]"
          >
            Accéder à l'espace Lucepres
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border bg-background/80 px-5 py-8 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <span>{LUCEPRES_PUBLIC_PROFILE.legalName} · {LUCEPRES_PUBLIC_PROFILE.location}</span>
          <span>{LUCEPRES_PUBLIC_PROFILE.documentFooter}</span>
        </div>
      </footer>
    </div>
  );
}
