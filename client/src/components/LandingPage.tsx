import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { startPlanetScene } from "@/lib/ascendPlanet";
import "./ascend-landing.css";

const DASH_BAR_HEIGHTS = [62, 88, 47, 95, 71, 80, 58];
const DASH_ROWS = [
  { label: "Nouveaux devis", w: 90 },
  { label: "Devis validés", w: 72 },
  { label: "Factures émises", w: 48 },
  { label: "Encaissé", w: 34 },
] as const;

const METIERS = ["Forage", "BTP", "Hydraulique", "Maintenance"] as const;

const FEATURES = [
  { Icon: IconWorkflow, title: "Devis en 5 étapes guidées", text: "Décris ton chantier, l'assistant IA prépare un brouillon complet. Tu relis, tu valides, tu envoies — sans te perdre dans un long formulaire." },
  { Icon: IconAnalytics, title: "Pilotage en direct", text: "Tes encaissements, créances et marges chantier par chantier, sur un seul tableau de bord qui te dit quoi faire ensuite." },
  { Icon: IconLeads, title: "Portail client", text: "Tes clients consultent et acceptent leurs devis en toute autonomie sur un lien sécurisé. Fini les allers-retours par téléphone." },
  { Icon: IconBolt, title: "Relances en un clic", text: "Déclenche une relance dès qu'une facture approche l'échéance — en quelques secondes, pas en quelques jours." },
  { Icon: IconShield, title: "Sécurité entreprise", text: "Espace sécurisé, rôles par équipe et montants en GNF. Une sécurité discrète qui grandit avec tes collaborateurs." },
  { Icon: IconGlobe, title: "Pensé pour la Guinée", text: "Multi-chantiers, formatage GNF fr-GN et latences adaptées là où tes chantiers se trouvent." },
] as const;

const STATS = [
  { value: "GNF", label: "Tout en franc guinéen" },
  { value: "1 fil", label: "Devis → facture → créances" },
  { value: "Équipe", label: "Accès réservé Lucepres" },
  { value: "E-mail", label: "Relances et invitations SMTP" },
] as const;

const FOOTER_COLS: Array<{
  title: string;
  links: Array<{ label: string; href?: string; action?: "login" }>;
}> = [
  {
    title: "Produit",
    links: [
      { label: "Devis", action: "login" },
      { label: "Factures", action: "login" },
      { label: "Créances", action: "login" },
    ],
  },
  {
    title: "Équipe",
    links: [
      { label: "Se connecter", action: "login" },
      { label: "Contact", href: `mailto:${LUCEPRES_PUBLIC_PROFILE.email}` },
      { label: "Téléphone", href: `tel:${LUCEPRES_PUBLIC_PROFILE.phone.replace(/\s/g, "")}` },
    ],
  },
];

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cleanupScene: (() => void) | undefined;
    let lenis: { destroy: () => void } | undefined;
    let observer: IntersectionObserver | undefined;

    if (canvasRef.current && !reduceMotion) {
      startPlanetScene(canvasRef.current).then((fn) => {
        cleanupScene = fn;
        root.classList.add("planet-ready");
      });
    } else {
      root.classList.add("planet-ready");
    }

    if (!reduceMotion) {
      import(/* @vite-ignore */ "https://unpkg.com/lenis@1.3.23/dist/lenis.mjs")
        .then((mod: any) => {
          const Lenis = mod.default ?? mod;
          const instance = new Lenis({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.5 });
          lenis = instance;
          let rafId = 0;
          const raf = (t: number) => {
            instance.raf(t);
            rafId = requestAnimationFrame(raf);
          };
          rafId = requestAnimationFrame(raf);
          (instance as any)._rafId = rafId;
        })
        .catch(() => {});
    }

    const revealEls = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (reduceMotion) {
      revealEls.forEach((el) => el.classList.add("in"));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
      );
      revealEls.forEach((el) => observer!.observe(el));
    }

    root.querySelectorAll<HTMLElement>(".dash-bar").forEach((bar, i) => {
      bar.style.animationDelay = `${i * 90}ms`;
    });

    return () => {
      cleanupScene?.();
      if (lenis) {
        cancelAnimationFrame((lenis as any)._rafId);
        lenis.destroy();
      }
      observer?.disconnect();
    };
  }, []);

  const goLogin = () => setLocation("/login");
  const contactMailto = `mailto:${LUCEPRES_PUBLIC_PROFILE.email}?subject=${encodeURIComponent("Échange Lucepres Gestion")}`;

  return (
    <div className="ascend-landing" ref={rootRef}>
      <div className="planet-fallback" aria-hidden />
      <canvas className="planet-canvas" ref={canvasRef} aria-hidden />
      <div className="page" id="top">
        <header className="hero">
          <nav className="nav">
            <a className="brand" href="#top" aria-label={`${LUCEPRES_PUBLIC_PROFILE.displayName} — accueil`}>
              <span className="brand-mark" aria-hidden>▲</span>
              <span>{LUCEPRES_PUBLIC_PROFILE.displayName}</span>
            </a>
            <div className="nav-links">
              <a href="#features">Fonctions</a>
              <a href="#solutions">Solutions</a>
              <a href={contactMailto}>Contact</a>
            </div>
            <button type="button" className="btn btn-ghost" onClick={goLogin}>
              Se connecter
            </button>
          </nav>

          <div className="hero-inner">
            <p className="hero-brand" data-reveal style={{ "--rd": "0ms" } as React.CSSProperties}>
              {LUCEPRES_PUBLIC_PROFILE.displayName}
            </p>
            <p className="hero-kicker" data-reveal style={{ "--rd": "40ms" } as React.CSSProperties}>
              Gestion commerciale · {LUCEPRES_PUBLIC_PROFILE.location}
            </p>
            <h1 className="hero-title" data-reveal style={{ "--rd": "80ms" } as React.CSSProperties}>
              Du premier devis<br />au <em>paiement</em> encaissé.
            </h1>
            <p className="hero-sub" data-reveal style={{ "--rd": "180ms" } as React.CSSProperties}>
              Lucepres réunit la création de devis, le suivi des créances et un agent IA — pensé pour les chantiers
              d'hydraulique, de BTP et de maintenance en Guinée. Tu gagnes du temps sur le papier, tu gardes le cap sur la trésorerie.
            </p>
            <div className="hero-actions" data-reveal style={{ "--rd": "300ms" } as React.CSSProperties}>
              <button type="button" className="btn btn-primary" onClick={goLogin}>
                Accéder à l'espace
                <IconArrow />
              </button>
              <a className="btn btn-outline" href={contactMailto}>
                Écrire à l'équipe
              </a>
            </div>
          </div>

          <div className="metiers" data-reveal style={{ "--rd": "420ms" } as React.CSSProperties}>
            <p className="metiers-label">Terrain Lucepres</p>
            <div className="metiers-row">
              {METIERS.map((name) => (
                <span className="metier" key={name}>{name}</span>
              ))}
            </div>
          </div>
        </header>

        <section className="section features" id="features" aria-labelledby="features-title">
          <div className="section-head">
            <span className="eyebrow" data-reveal>Tout l'atelier en orbite</span>
            <h2 id="features-title" data-reveal style={{ "--rd": "80ms" } as React.CSSProperties}>
              Une seule plateforme pour tout ton moteur commercial
            </h2>
            <p data-reveal style={{ "--rd": "160ms" } as React.CSSProperties}>
              Arrête d'empiler les outils. Lucepres réunit la capture, l'automatisation et l'analyse sur une seule surface
              que toute ton équipe prend plaisir à utiliser.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map(({ Icon, title, text }, i) => (
              <article
                className="card"
                key={title}
                data-reveal
                style={{ "--rd": `${i * 90}ms` } as React.CSSProperties}
              >
                <div className="card-icon"><Icon /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section showcase" id="solutions" aria-labelledby="solutions-title">
          <div className="showcase-grid">
            <div className="showcase-copy">
              <span className="eyebrow" data-reveal>Conçu pour la cadence</span>
              <h2 id="solutions-title" data-reveal style={{ "--rd": "90ms" } as React.CSSProperties}>
                Vois toute ta trésorerie avancer en direct
              </h2>
              <p data-reveal style={{ "--rd": "180ms" } as React.CSSProperties}>
                Chaque devis, chaque facture, chaque encaissement — rendu en direct. Lucepres te donne l'altitude pour
                repérer ce qui marche et les commandes pour accélérer aussitôt.
              </p>
              <div className="hero-actions" data-reveal style={{ "--rd": "270ms" } as React.CSSProperties}>
                <button type="button" className="btn btn-primary" onClick={goLogin}>
                  Explorer la plateforme
                  <IconArrow />
                </button>
              </div>
            </div>
            <div className="dashboard" data-reveal style={{ "--rd": "160ms" } as React.CSSProperties}>
              <div className="dash-top">
                <span className="dash-title">Trésorerie · aperçu</span>
                <span className="dash-live">
                  <span className="dot" aria-hidden />
                  Live
                </span>
              </div>
              <div className="dash-bars" role="img" aria-label="Aperçu illustratif du tableau de bord en GNF">
                {DASH_BAR_HEIGHTS.map((ht, i) => (
                  <div className="dash-bar grow" key={i} style={{ height: `${ht}%` }} />
                ))}
              </div>
              <div className="dash-rows">
                {DASH_ROWS.map((row) => (
                  <RowFragment key={row.label} label={row.label} w={row.w} />
                ))}
              </div>
            </div>
          </div>

          <div className="stats">
            {STATS.map((stat, i) => (
              <div
                className="stat"
                key={stat.label}
                data-reveal
                style={{ "--rd": `${i * 80}ms` } as React.CSSProperties}
              >
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section cta" id="cta" aria-labelledby="cta-title">
          <div className="cta-card">
            <span className="eyebrow" data-reveal style={{ "--rd": "60ms" } as React.CSSProperties}>Prêt quand tu l'es</span>
            <h2 id="cta-title" data-reveal style={{ "--rd": "140ms" } as React.CSSProperties}>
              Ouvre ton espace Lucepres
            </h2>
            <p data-reveal style={{ "--rd": "220ms" } as React.CSSProperties}>
              Connecte-toi en quelques minutes. Accès réservé à l'équipe Lucepres — devis, créances et relances sur un seul fil.
            </p>
            <div className="hero-actions" data-reveal style={{ "--rd": "300ms" } as React.CSSProperties}>
              <button type="button" className="btn btn-primary" onClick={goLogin}>
                Accéder à l'espace
                <IconArrow />
              </button>
              <a className="btn btn-outline" href={contactMailto}>
                Parler à l'équipe
              </a>
            </div>
          </div>

          <footer className="footer">
            <div className="footer-brand">
              <a className="brand" href="#top">
                <span className="brand-mark" aria-hidden>▲</span>
                <span>{LUCEPRES_PUBLIC_PROFILE.displayName}</span>
              </a>
              <p>L'atelier de gestion commerciale pour les chantiers ambitieux de Guinée.</p>
              <p>
                <a href={`tel:${LUCEPRES_PUBLIC_PROFILE.phone.replace(/\s/g, "")}`}>{LUCEPRES_PUBLIC_PROFILE.phone}</a>
                <br />
                <a href={`mailto:${LUCEPRES_PUBLIC_PROFILE.email}`}>{LUCEPRES_PUBLIC_PROFILE.email}</a>
              </p>
            </div>
            <div className="footer-cols">
              {FOOTER_COLS.map((col) => (
                <div className="footer-col" key={col.title}>
                  <h4>{col.title}</h4>
                  {col.links.map((link) =>
                    link.action === "login" ? (
                      <button type="button" className="footer-link" key={link.label} onClick={goLogin}>
                        {link.label}
                      </button>
                    ) : (
                      <a key={link.label} href={link.href}>
                        {link.label}
                      </a>
                    ),
                  )}
                </div>
              ))}
            </div>
          </footer>

          <p className="copyright">
            © {new Date().getFullYear()} {LUCEPRES_PUBLIC_PROFILE.legalName} · {LUCEPRES_PUBLIC_PROFILE.documentFooter}
          </p>
        </section>
      </div>
    </div>
  );
}

function RowFragment({ label, w }: { label: string; w: number }) {
  return (
    <>
      <span>{label} {w}%</span>
      <div className="dash-track">
        <div className="dash-fill fill" style={{ "--w": `${w}%` } as React.CSSProperties} />
      </div>
    </>
  );
}

function SvgBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function IconWorkflow() {
  return (
    <SvgBase>
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="15" y="15" width="6" height="6" rx="1.2" />
      <path d="M6 9v3a3 3 0 0 0 3 3h3" />
    </SvgBase>
  );
}
function IconAnalytics() {
  return (
    <SvgBase>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4" />
      <path d="M13 16V8" />
      <path d="M18 16v-7" />
    </SvgBase>
  );
}
function IconLeads() {
  return (
    <SvgBase>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SvgBase>
  );
}
function IconShield() {
  return (
    <SvgBase>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </SvgBase>
  );
}
function IconBolt() {
  return (
    <SvgBase>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </SvgBase>
  );
}
function IconGlobe() {
  return (
    <SvgBase>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" />
    </SvgBase>
  );
}
function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
