import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { LucepresMark } from "@/components/LucepresMark";
import "./lucepress-landing.css";

const NAV_LINKS = [
  { label: "Métiers", href: "#metiers" },
  { label: "Parcours", href: "#parcours" },
  { label: "Accès", href: "#cta" },
  { label: "Contact", href: `mailto:${LUCEPRES_PUBLIC_PROFILE.email}` },
] as const;

const SECTEURS = [
  {
    id: "forage",
    name: "Forage",
    lead: "Du trou d’essai au tubage, tu chiffres ce qui tient sur le terrain.",
    body: "Profondeur, diamètre, essais de pompage, tubage — chaque poste a son unité et son prix. Tu prépares le devis pendant que le chantier avance, tu factures sans tout retaper dans Excel.",
    note: "Utile quand un forage Kindia ou Coyah se transforme en plusieurs avenants.",
    image: "/landing/secteur-forage.png",
    imageAlt: "Chantier de forage tubulaire en Guinée, forêt et sol latéritique",
  },
  {
    id: "btp",
    name: "BTP",
    lead: "Gros œuvre et finitions : un devis clair pour chaque lot.",
    body: "Maçonnerie, ferraillage, couverture, second œuvre — tu sépares les lots, tu gardes les quantités, tu suis ce qui est livré. Le client voit le même fil que toi : devis, avenant, facture.",
    note: "Pensé pour les chantiers Conakry où le papier ne suit pas le rythme du béton.",
    image: "/landing/secteur-btp.png",
    imageAlt: "Chantier BTP avec structure béton et échafaudages à Conakry",
  },
  {
    id: "hydraulique",
    name: "Hydraulique",
    lead: "L’eau qui arrive — et le paiement qui suit.",
    body: "Pompes, réservoirs, réseaux, adduction : tu devises les équipements et la pose, tu relances les collectivités et les bailleurs. Les montants en GNF restent lisibles d’un bout à l’autre.",
    note: "Pour les projets ruraux comme urbains, où le délai de règlement compte autant que le débit.",
    image: "/landing/secteur-hydraulique.png",
    imageAlt: "Infrastructure hydraulique et château d’eau en zone rurale",
  },
  {
    id: "maintenance",
    name: "Maintenance",
    lead: "Interventions courtes, suivi long — sans perdre la créance.",
    body: "Entretien de pompes, groupes, réseaux : tu notes l’intervention, tu factures le forfait ou la journée, tu rappelles si le solde traîne. L’atelier te montre ce qui reste ouvert.",
    note: "Idéal quand les petites interventions se multiplient et que WhatsApp ne suffit plus.",
    image: "/landing/secteur-maintenance.png",
    imageAlt: "Technicien en maintenance sur équipement de chantier",
  },
] as const;

const FUNNEL = [
  {
    n: "01",
    title: "Le chantier déborde le papier",
    text: "Devis épars, relances oubliées, montants GNF perdus entre WhatsApp et Excel.",
  },
  {
    n: "02",
    title: "Un fil devis → facture → créances",
    text: "Tu prépares, tu envoies, tu relances. L’atelier te dit quoi faire ensuite.",
  },
  {
    n: "03",
    title: "Tu ouvres ton espace",
    text: "Connexion sécurisée pour le staff. Invitation par e-mail — pas d’inscription ouverte.",
  },
] as const;

const FOOTER_COLS = [
  {
    title: "Produit",
    links: [
      { label: "Se connecter — devis", href: "/login" },
      { label: "Se connecter — factures", href: "/login" },
      { label: "Se connecter — créances", href: "/login" },
    ],
  },
  {
    title: "Équipe",
    links: [
      { label: "Se connecter", href: "/login" },
      { label: "Écrire", href: `mailto:${LUCEPRES_PUBLIC_PROFILE.email}` },
      { label: "Appeler", href: `tel:${LUCEPRES_PUBLIC_PROFILE.phone.replace(/\s/g, "")}` },
    ],
  },
] as const;

const HERO_VIDEO = "https://pub-1e5b4001b36b47e28e6a2fb775966a79.r2.dev/templates/monsoon/hero.mp4";
const easeOut = [0.23, 1, 0.32, 1] as const;

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(!reduceMotion);
  const contactMailto = `mailto:${LUCEPRES_PUBLIC_PROFILE.email}?subject=${encodeURIComponent("Échange Lucepres Gestion")}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduceMotion) {
      video.pause();
      setVideoPlaying(false);
      return;
    }
    void video.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
  }, [reduceMotion]);

  const fade = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { y: 0 } }
      : {
          initial: { opacity: 1, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.65, delay, ease: easeOut },
        };

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;
    if (video.paused) {
      void video.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
    } else {
      video.pause();
      setVideoPlaying(false);
    }
  };

  return (
    <div className="lp">
      <a href="#main-content" className="lp-skip">
        Aller au contenu principal
      </a>

      <div className="lp-nav-wrap">
        <nav className="lp-nav" aria-label="Principale">
          <a className="lp-brand" href="#top" aria-label={`${LUCEPRES_PUBLIC_PROFILE.displayName} — accueil`}>
            <LucepresMark size="sm" tone="ghost" className="lp-mark" />
            <span className="lp-brand-text" translate="no">{LUCEPRES_PUBLIC_PROFILE.displayName}</span>
          </a>
          <div className="lp-nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <Link href="/login" className="lp-nav-cta">
            Se connecter
          </Link>
        </nav>
      </div>

      <main id="main-content" className="lp-main">
        <section className="lp-hero" id="top" aria-label="Accueil">
          <video
            ref={videoRef}
            className="lp-hero-video"
            src={HERO_VIDEO}
            autoPlay={!reduceMotion}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            onError={(event) => {
              event.currentTarget.setAttribute("data-failed", "true");
            }}
          />
          <div className="lp-hero-fallback" aria-hidden="true" />
          <div className="lp-hero-overlay" aria-hidden="true" />
          <div className="lp-hero-veil" aria-hidden="true" />
          <div className="lp-hero-glow" aria-hidden="true" />

          <div className="lp-hero-content">
            <motion.p className="lp-hero-brand" translate="no" {...fade(0.08)}>
              {LUCEPRES_PUBLIC_PROFILE.displayName}
            </motion.p>

            <motion.h1 className="lp-hero-title" {...fade(0.2)}>
              Du premier devis au paiement encaissé.
            </motion.h1>

            <motion.p className="lp-hero-sub" {...fade(0.32)}>
              Devis, créances et relances en GNF — pensé pour les chantiers d’hydraulique, de BTP et de
              maintenance. Tu gagnes du temps sur le papier, tu gardes le cap sur la trésorerie.
            </motion.p>

            <motion.div className="lp-hero-actions" {...fade(0.44)}>
              <motion.div whileHover={reduceMotion ? undefined : { scale: 1.03 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
                <Link href="/login" className="lp-btn lp-btn-primary">
                  Accéder à l’espace
                </Link>
              </motion.div>
              <motion.div whileHover={reduceMotion ? undefined : { scale: 1.03 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
                <a className="lp-btn lp-btn-glass" href={contactMailto}>
                  Écrire à l’équipe
                </a>
              </motion.div>
            </motion.div>
          </div>

          {!reduceMotion ? (
            <button
              type="button"
              className="lp-video-toggle"
              onClick={toggleVideo}
              aria-pressed={videoPlaying}
              aria-label={videoPlaying ? "Mettre la vidéo en pause" : "Lancer la vidéo du paysage"}
            >
              {videoPlaying ? "Pause le paysage" : "Lancer le paysage"}
            </button>
          ) : null}
        </section>

        <section className="lp-sectors" id="metiers" aria-labelledby="metiers-title">
          <div className="lp-sectors-intro">
            <p className="lp-section-kicker">Sur le terrain</p>
            <h2 id="metiers-title" className="lp-section-title">
              Quatre métiers, un même fil commercial
            </h2>
            <p className="lp-section-lead">
              Forage, BTP, hydraulique, maintenance — chaque secteur a son rythme. L’atelier parle le tien.
            </p>
          </div>

          <div className="lp-sectors-list">
            {SECTEURS.map((secteur, index) => (
              <article
                key={secteur.id}
                className={`lp-sector${index % 2 === 1 ? " lp-sector-flip" : ""}`}
                id={secteur.id}
              >
                <figure className="lp-sector-media">
                  <img
                    src={secteur.image}
                    alt={secteur.imageAlt}
                    width={1280}
                    height={720}
                    sizes="(max-width: 840px) 100vw, 50vw"
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                </figure>
                <div className="lp-sector-copy">
                  <h3 className="lp-sector-name">{secteur.name}</h3>
                  <p className="lp-sector-lead">{secteur.lead}</p>
                  <p className="lp-sector-body">{secteur.body}</p>
                  <p className="lp-sector-note">{secteur.note}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-below" id="parcours" aria-labelledby="parcours-title">
          <div className="lp-below-intro">
            <p className="lp-section-kicker">Un seul fil</p>
            <h2 id="parcours-title" className="lp-section-title">
              Trois gestes pour encaisser plus vite
            </h2>
            <p className="lp-section-lead">
              Accès réservé à l’équipe — le parcours mène à la connexion, pas à une inscription publique.
            </p>
          </div>

          <ol className="lp-funnel">
            {FUNNEL.map((step) => (
              <li className="lp-funnel-row" key={step.n}>
                <span className="lp-funnel-n" aria-hidden="true">{step.n}</span>
                <div className="lp-funnel-body">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-cta-wrap" id="cta" aria-labelledby="cta-title">
          <div className="lp-cta">
            <div className="lp-cta-copy">
              <p className="lp-section-kicker lp-section-kicker-left">Prêt quand tu l’es</p>
              <h2 id="cta-title">Ouvre ton espace Lucepres</h2>
              <p>Connecte-toi en quelques minutes. Devis, créances et relances sur un seul fil.</p>
              <div className="lp-hero-actions lp-hero-actions-start">
                <Link href="/login" className="lp-btn lp-btn-primary">
                  Accéder à l’espace
                </Link>
                <a className="lp-btn lp-btn-quiet" href={contactMailto}>
                  Parler à l’équipe
                </a>
              </div>
            </div>
            <aside className="lp-cta-aside">
              <LucepresMark size="md" tone="ghost" className="lp-cta-mark" />
              <p className="lp-cta-quote">
                Tes devis, tes créances — une seule lumière.
              </p>
              <p className="lp-cta-cite">
                {LUCEPRES_PUBLIC_PROFILE.legalName} · {LUCEPRES_PUBLIC_PROFILE.positioning}
              </p>
            </aside>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <a
              className="lp-brand lp-brand-footer"
              href="#top"
              aria-label={`${LUCEPRES_PUBLIC_PROFILE.displayName} — retour en haut`}
            >
              <LucepresMark size="sm" tone="ghost" className="lp-mark" />
              <span className="lp-brand-text" translate="no">{LUCEPRES_PUBLIC_PROFILE.displayName}</span>
            </a>
            <p>
              L’atelier de gestion commerciale pour les chantiers ambitieux de Guinée.
            </p>
            <p className="lp-footer-contact">
              <a href={`tel:${LUCEPRES_PUBLIC_PROFILE.phone.replace(/\s/g, "")}`}>{LUCEPRES_PUBLIC_PROFILE.phone}</a>
              <a href={`mailto:${LUCEPRES_PUBLIC_PROFILE.email}`}>{LUCEPRES_PUBLIC_PROFILE.email}</a>
            </p>
          </div>

          <nav className="lp-footer-cols" aria-label="Pied de page">
            {FOOTER_COLS.map((col) => (
              <div className="lp-footer-col" key={col.title}>
                <h4>{col.title}</h4>
                {col.links.map((link) =>
                  link.href.startsWith("/") ? (
                    <Link key={link.label} href={link.href} className="lp-footer-link">
                      {link.label}
                    </Link>
                  ) : (
                    <a key={link.label} href={link.href} className="lp-footer-link">
                      {link.label}
                    </a>
                  ),
                )}
              </div>
            ))}
          </nav>
        </div>
        <p className="lp-copyright">
          © {new Date().getFullYear()} {LUCEPRES_PUBLIC_PROFILE.legalName} · {LUCEPRES_PUBLIC_PROFILE.location}
        </p>
      </footer>
    </div>
  );
}
