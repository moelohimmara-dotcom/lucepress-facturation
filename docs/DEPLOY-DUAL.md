# Déploiement dual — Cloudflare (primaire) + Netlify (secours)

Voir [ADR-0004](./adr/0004-dual-hosting-cloudflare-primary.md).

## Rôles

| Plateforme | Rôle | URL typique |
|---|---|---|
| **Cloudflare** | Primaire (trafic, domaine) | `lucepress-gestion.<compte>.workers.dev` puis domaine custom |
| **Netlify** | Secours (miroir) | `https://lucepress-gestion.netlify.app` |

Les deux reçoivent **le même build** à chaque release. Même `DATABASE_URL` Supabase.

## Secrets CI (GitHub → Settings → Secrets)

| Secret | Usage |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Deploy Workers/Pages |
| `CLOUDFLARE_ACCOUNT_ID` | Compte Cloudflare |
| `NETLIFY_AUTH_TOKEN` | Deploy Netlify |
| `NETLIFY_SITE_ID` | `f63d4f0d-4b3c-413f-9b60-da7d2aed95b7` (lucepress-gestion) |

## Variables d’environnement (les deux plateformes)

Aligner au minimum : `DATABASE_URL` (ou Hyperdrive côté CF), `JWT_SECRET`, SMTP_*, PDFSHIFT_* .

Côté Cloudflare : créer un **Hyperdrive** pointant vers le pooler Supabase, puis ajouter dans `wrangler.toml` :

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive_id>"
```

En attendant, configurer le secret Worker `DATABASE_URL` (pooler Supabase) via `wrangler secret put DATABASE_URL`.

## Commandes locales

```bash
pnpm build:netlify
pnpm build:function
pnpm deploy:netlify

pnpm build:cloudflare
pnpm deploy:cloudflare
```

Ou les deux :

```bash
pnpm deploy:dual
```

## Priorité DNS

1. Domaine custom → **Cloudflare** (proxy orange).
2. En incident CF : basculer le CNAME / doc utilisateur vers l’URL Netlify secours.
3. Ne jamais laisser les deux domaines custom diverger de version : le CI déploie toujours les deux.

## Transition API

**État actuel :** le Worker Cloudflare sert le **SPA** et **proxifie** `/api/*` + `/storage/*` vers Netlify (`API_ORIGIN`), car Express (`body-parser` / `iconv-lite`) ne démarre pas encore sur le runtime Workers.

**Cible :** API native sur Cloudflare (Hyperdrive `lucepress-supabase` déjà créé : `1b3c9e2ac4de49c290ce5e068aeaf66e`) après adaptation runtime (Hono ou Conteneurs Node).

En incident Cloudflare : utiliser directement `https://lucepress-gestion.netlify.app` (secours complet).
