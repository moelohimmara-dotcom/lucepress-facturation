/**
 * Résolution de l'IP client pour les compteurs anti-brute-force.
 *
 * PIÈGE À ÉVITER
 * --------------
 * L'app tourne derrière un reverse proxy (Caddy/nginx → `https://lucepress.
 * 213.156.135.139.sslip.io`). Deux erreurs symétriques sont possibles :
 *
 *  a) Lire `req.ip` sans `trust proxy` → toutes les requêtes semblent venir de
 *     l'IP du proxy (127.0.0.1). Tous les utilisateurs partagent alors UN seul
 *     compteur : le premier attaquant bloque tout le monde (déni de service),
 *     et le quota par IP devient inutilisable.
 *
 *  b) Faire aveuglément confiance à `X-Forwarded-For` → l'en-tête est fourni par
 *     le client. Un attaquant envoie `X-Forwarded-For: <aléatoire>` à chaque
 *     essai et obtient un compteur neuf à chaque fois : le quota IP ne sert plus
 *     à rien.
 *
 * COMPROMIS RETENU
 * ----------------
 * On ne lit `X-Forwarded-For` que si l'opérateur a explicitement déclaré être
 * derrière un proxy de confiance (`TRUST_PROXY=1`). On prend alors l'entrée la
 * PLUS À DROITE parmi celles ajoutées par nos proxies — c.-à-d. celle écrite par
 * notre propre proxy — et non la première, qui est contrôlable par le client.
 *
 * Le quota par e-mail (défense primaire) reste efficace même si la résolution
 * d'IP est dégradée : c'est la raison du double compteur.
 */

import type { Request } from "express";

/** Nombre de proxies de confiance devant l'app (0 = exposition directe). */
function trustedProxyHops(): number {
  const raw = (process.env.TRUST_PROXY ?? "").trim();
  if (!raw || raw === "0" || raw.toLowerCase() === "false") return 0;
  if (raw === "1" || raw.toLowerCase() === "true") return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function resolveClientIp(req: Pick<Request, "headers" | "ip" | "socket">): string {
  const hops = trustedProxyHops();

  if (hops > 0) {
    const header = req.headers?.["x-forwarded-for"];
    const raw = Array.isArray(header) ? header.join(",") : header;
    if (typeof raw === "string" && raw.length > 0) {
      const chain = raw
        .split(",")
        .map(part => part.trim())
        .filter(Boolean);
      // L'entrée écrite par NOTRE proxy est la `hops`-ième en partant de la fin.
      const index = chain.length - hops;
      const candidate = chain[index >= 0 ? index : 0];
      if (candidate) return normalize(candidate);
    }
  }

  return normalize(req.ip ?? req.socket?.remoteAddress ?? "unknown");
}

/** `::ffff:1.2.3.4` et `1.2.3.4` doivent partager le même compteur. */
function normalize(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) return trimmed.slice("::ffff:".length);
  return trimmed || "unknown";
}
