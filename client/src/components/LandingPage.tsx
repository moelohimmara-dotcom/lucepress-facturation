import { Button } from "@/components/ui/button";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import {
  ArrowRight,
  FileText,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { LucepresMark } from "./LucepresMark";

const trustBadges = [
  { icon: ShieldCheck, label: "Espace sécurisé" },
  { icon: WalletCards, label: "Montants en GNF" },
  { icon: MapPin, label: "Pensé pour la Guinée" },
  { icon: Sparkles, label: "Agent IA intégré" },
] as const;

const primaryFeatures = [
  {
    icon: Sparkles,
    title: "Devis en 5 étapes guidées",
    description: "Décris ton chantier, l'assistant IA prépare un brouillon complet. Tu relis, tu valides, tu envoies. Sans te perdre dans un long formulaire.",
    tag: "Nouveau",
  },
  {
    icon: UsersRound,
    title: "Portail client",
    description: "Tes clients consultent et acceptent leurs devis en toute autonomie, sur un lien sécurisé. Fini les allers-retours par téléphone.",
    tag: "Autonome",
  },
] as const;

const standardFeatures = [
  {
    icon: FileText,
    title: "Devis & factures",
    description: "Crée, envoie et suis tes documents. Du brouillon au paiement, tout reste dans un seul espace.",
  },
  {
    icon: ReceiptText,
    title: "Créances & relances",
    description: "Vois d'un coup d'œil qui doit quoi, relance en un clic, garde le cap sur les paiements attendus.",
  },
  {
    icon: WalletCards,
    title: "Pilotage financier",
    description: "Compare les coûts réels et la marge encaissée à la prévision, chantier par chantier.",
  },
  {
    icon: Wrench,
    title: "Catalogue métier",
    description: "Hydraulique, hygiène, maintenance : un catalogue prêt à compléter avec tes prix.",
  },
] as const;

const steps = [
  { number: "01", label: "Enregistre tes clients", detail: "Manuellement ou par extraction IA depuis un e-mail.", icon: UsersRound },
  { number: "02", label: "Crée tes devis", detail: "Assistant IA ou saisie guidée en 5 étapes, puis envoi par e-mail.", icon: FileText },
  { number: "03", label: "Suis les paiements", detail: "Créances, relances et marges, en un coup d'œil chaque matin.", icon: WalletCards },
] as const;

function goToLogin(setLocation: (path: string) => void) {
  setLocation("/login");
}

export function LandingPage() {
  const [, setLocation] = useLocation();

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
          onClick={() => goToLogin(setLocation)}
          className="h-10 rounded-xl border-border bg-card/80 font-bold backdrop-blur"
        >
          Se connecter
        </Button>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-5 pt-8 text-center sm:px-8 sm:pt-14">
        <p className="lucepress-kicker">{LUCEPRES_PUBLIC_PROFILE.positioning} · {LUCEPRES_PUBLIC_PROFILE.location}</p>
        <h1 className="font-editorial mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Du premier devis<br className="hidden sm:block" /> au paiement encaissé.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Lucepres réunit la création de devis, le suivi des créances et un agent IA — pensé pour les chantiers d'hydraulique, de BTP et de maintenance en Guinée. Tu gagnes du temps sur le papier, tu gardes le cap sur la trésorerie.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => goToLogin(setLocation)}
            className="h-12 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-150 active:scale-[0.97]"
          >
            Accéder à l'espace
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <a
            href="#fonctions"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-card/60 px-5 text-sm font-bold text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"
          >
            Voir comment ça marche
          </a>
        </div>

        <ul className="mx-auto mt-9 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs font-bold text-muted-foreground">
          {trustBadges.map((badge) => (
            <li key={badge.label} className="inline-flex items-center gap-1.5">
              <badge.icon className="h-4 w-4 text-primary" aria-hidden />
              {badge.label}
            </li>
          ))}
        </ul>
      </main>

      <ProductMockup />

      <section id="fonctions" aria-labelledby="features-title" className="relative z-10 mx-auto mt-20 max-w-6xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <p className="lucepress-kicker">Tout l'atelier</p>
          <h2 id="features-title" className="font-editorial mt-3 text-3xl font-semibold tracking-tight">Ce qui change ton quotidien</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Chaque fonction de Lucepres vise une décision claire : valider, envoyer, suivre.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {primaryFeatures.map((feature) => (
            <article
              key={feature.title}
              className="lucepress-panel stagger-rise relative flex flex-col rounded-[1.5rem] p-7 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <feature.icon className="h-6 w-6" aria-hidden />
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary">{feature.tag}</span>
              </div>
              <h3 className="font-editorial mt-5 text-xl font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {standardFeatures.map((feature) => (
            <article
              key={feature.title}
              className="lucepress-panel rounded-[1.35rem] p-5 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="font-editorial mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="steps-title" className="relative z-10 mx-auto mt-20 max-w-4xl px-5 sm:px-8">
        <div className="lucepress-panel rounded-[1.5rem] p-8 sm:p-10">
          <div className="mb-8 text-center">
            <p className="lucepress-kicker">En trois gestes</p>
            <h2 id="steps-title" className="font-editorial mt-3 text-3xl font-semibold tracking-tight">Du premier client au paiement encaissé</h2>
          </div>
          <ol className="grid gap-6 sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.number} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <step.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-extrabold">{step.label}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="relative z-10 mx-auto mt-20 max-w-4xl px-5 pb-20 text-center sm:px-8">
        <div className="lucepress-panel rounded-[1.5rem] bg-primary p-10 text-primary-foreground sm:p-14">
          <h2 id="cta-title" className="font-editorial text-3xl font-semibold leading-tight sm:text-4xl">
            Commence dès aujourd'hui.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-primary-foreground/80">
            Connecte-toi pour accéder à tes devis, factures et chantiers. Ta file de décisions du matin t'attend.
          </p>
          <Button
            onClick={() => goToLogin(setLocation)}
            className="mt-7 h-12 rounded-xl bg-primary-foreground px-6 text-sm font-bold text-primary shadow-lg transition-transform duration-150 active:scale-[0.97]"
          >
            Accéder à l'espace Lucepres
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border bg-background/80 px-5 py-8 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <span>{LUCEPRES_PUBLIC_PROFILE.legalName} · {LUCEPRES_PUBLIC_PROFILE.location}</span>
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
            <a href={`tel:${LUCEPRES_PUBLIC_PROFILE.phone.replace(/\s/g, "")}`} className="font-bold hover:text-primary">{LUCEPRES_PUBLIC_PROFILE.phone}</a>
            <a href={`mailto:${LUCEPRES_PUBLIC_PROFILE.email}`} className="font-bold hover:text-primary">{LUCEPRES_PUBLIC_PROFILE.email}</a>
          </div>
          <span>{LUCEPRES_PUBLIC_PROFILE.documentFooter}</span>
        </div>
      </footer>
    </div>
  );
}

function ProductMockup() {
  return (
    <section aria-label="Aperçu du tableau de bord" className="relative z-10 mx-auto mt-14 max-w-5xl px-5 sm:px-8">
      <div className="lucepress-panel overflow-hidden rounded-[1.5rem] p-3 shadow-2xl shadow-primary/10 sm:p-4">
        <div className="rounded-xl border border-border bg-background/80 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="lucepress-kicker">Aujourd'hui</p>
              <p className="font-editorial mt-1 text-lg font-semibold">Ta file de décisions</p>
            </div>
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Rechercher…
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Encaissé", value: "8 450 000 GNF", tone: "text-emerald-600", bg: "bg-emerald-500/10" },
              { label: "En attente", value: "3 120 000 GNF", tone: "text-amber-600", bg: "bg-amber-500/10" },
              { label: "En retard", value: "980 000 GNF", tone: "text-red-600", bg: "bg-red-500/10" },
            ].map((card) => (
              <div key={card.label} className={`rounded-xl ${card.bg} p-4`}>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className={`font-mono mt-1.5 text-sm font-extrabold ${card.tone}`}>{card.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[
              { kind: "Devis", number: "DEV-2026-0042", client: "Entreprise Kankan", status: "À envoyer", tone: "text-amber-600" },
              { kind: "Facture", number: "FAC-2026-0018", client: "BTP Conakry", status: "En attente", tone: "text-amber-600" },
              { kind: "Créance", number: "FAC-2026-0011", client: "Hydraulique Nzérékoré", status: "En retard", tone: "text-red-600" },
            ].map((row) => (
              <div key={row.number} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-extrabold text-primary">{row.kind}</span>
                  <span className="truncate text-xs font-bold">{row.number}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{row.client}</span>
                </div>
                <span className={`shrink-0 text-[11px] font-extrabold ${row.tone}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Aperçu illustratif du tableau de bord — les montants sont fictifs.</p>
    </section>
  );
}
