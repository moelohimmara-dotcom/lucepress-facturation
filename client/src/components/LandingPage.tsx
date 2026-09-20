import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { LucepresMark } from "@/components/LucepresMark";
import "./lucepress-landing.css";

const NAV_LINKS = [
  { label: "Parcours", href: "#parcours" },
  { label: "Accès", href: "#cta" },
  { label: "Contact", href: `mailto:${LUCEPRES_PUBLIC_PROFILE.email}` },
] as const;

const METIERS = ["Forage", "BTP", "Hydraulique", "Maintenance"] as const;

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
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.75, delay, ease: easeOut },
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
        <motion.nav
          className="lp-nav"
          aria-label="Principale"
          initial={reduceMotion ? false : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
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
        </motion.nav>
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
            <motion.span className="lp-eyebrow" {...fade(0.08)}>
              Gestion commerciale · {LUCEPRES_PUBLIC_PROFILE.location}
            </motion.span>

            <motion.p className="lp-hero-brand" translate="no" {...fade(0.16)}>
              {LUCEPRES_PUBLIC_PROFILE.displayName}
            </motion.p>

            <motion.h1 className="lp-hero-title" {...fade(0.24)}>
              Du premier devis au paiement encaissé.
            </motion.h1>

            <motion.p className="lp-hero-sub" {...fade(0.36)}>
              Devis, créances et relances en GNF — pensé pour les chantiers d’hydraulique, de BTP et de
              maintenance. Tu gagnes du temps sur le papier, tu gardes le cap sur la trésorerie.
            </motion.p>

            <motion.div className="lp-hero-actions" {...fade(0.48)}>
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

          <motion.div className="lp-strip" {...fade(0.62)}>
            <div className="lp-strip-inner">
              <div className="lp-strip-head">
                <p className="lp-strip-label">Terrain Lucepres</p>
                {!reduceMotion ? (
                  <button
                    type="button"
                    className="lp-video-toggle"
                    onClick={toggleVideo}
                    aria-pressed={videoPlaying}
                  >
                    {videoPlaying ? "Pause le paysage" : "Lancer le paysage"}
                  </button>
                ) : null}
              </div>
              <div className="lp-strip-row" role="list">
                {METIERS.map((name) => (
                  <span key={name} className="lp-strip-item" role="listitem">
                    {name}
                  </span>
                ))}
                <span className="lp-strip-item lp-strip-item-muted" role="listitem">GNF · fr-GN</span>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="lp-below" id="parcours" aria-labelledby="parcours-title">
          <p className="lp-section-kicker">Un seul fil</p>
          <h2 id="parcours-title" className="lp-section-title">
            Trois gestes pour encaisser plus vite
          </h2>
          <p className="lp-section-lead">
            Accès réservé à l’équipe — le parcours mène à la connexion, pas à une inscription publique.
          </p>

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

          <div className="lp-cta" id="cta">
            <div className="lp-cta-copy">
              <p className="lp-section-kicker lp-section-kicker-left">Prêt quand tu l’es</p>
              <h2>Ouvre ton espace Lucepres</h2>
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
                Vos devis, vos créances — une seule lumière.
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

          <div className="lp-footer-cols">
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
          </div>
        </div>
        <p className="lp-copyright">
          © {new Date().getFullYear()} {LUCEPRES_PUBLIC_PROFILE.legalName} · {LUCEPRES_PUBLIC_PROFILE.location}
        </p>
      </footer>
    </div>
  );
}
