# ADR-0004: Dual hosting — Cloudflare prioritaire, Netlify en secours

**Date**: 2026-09-19  
**Status**: accepted  
**Deciders**: Équipe produit Lucepress

## Context

Lucepress Gestion tourne aujourd’hui sur Netlify (SPA Vite + Function Express). Une refonte repart sur une base Supabase neuve. Il faut :

- garder Netlify comme **secours** opérationnel ;
- déployer aussi sur **Cloudflare** ;
- à chaque mise à jour, **servir les deux** plateformes ;
- donner la **priorité** à Cloudflare (trafic utilisateur, domaine principal).

## Decision

1. **Cloudflare = primaire** : domaine public (ou sous-domaine principal) pointe vers Cloudflare Pages + Worker API.
2. **Netlify = secours** : même artefact (frontend + API Express), URL `*.netlify.app` conservée, déploiement systématique en parallèle.
3. **Pipeline unique** : chaque push/`main` (ou tag release) exécute `build` puis **deux deploys** (Cloudflare puis Netlify). Échec d’un côté = alerte, pas de silence.
4. **Même base de données** : les deux plateformes partagent la même `DATABASE_URL` Supabase (pas deux schémas divergents).
5. **API sur Cloudflare (cible)** : Worker natif + Hyperdrive vers Postgres. **Transition** : Worker sert le SPA et proxifie `/api/*` vers Netlify tant qu’Express n’est pas adapté au runtime Workers.

## Alternatives Considered

### Alternative 1: Cloudflare uniquement, abandon Netlify
- **Pros**: un seul hébergeur
- **Cons**: plus de filet de secours pendant la refonte
- **Why not**: exigence explicite de garder Netlify en secours

### Alternative 2: Cloudflare Pages (statique) + proxy API vers Netlify
- **Pros**: rapide à brancher
- **Cons**: Cloudflare dépend encore de Netlify pour l’API ; bascule secours incomplète
- **Why not**: retenu seulement comme **étape de transition** si Hyperdrive n’est pas prêt

### Alternative 3: Deux stacks API divergentes (Hono CF / Express Netlify)
- **Pros**: natif Workers
- **Cons**: double maintenance pendant la refonte
- **Why not**: reporté après stabilisation du dual-deploy ; une seule `createApp()` pour l’instant

## Consequences

### Positive
- Trafic prioritaire sur Cloudflare ; Netlify reste un miroir déployé.
- Un seul build, deux cibles → versions alignées.
- Filet de secours si incident CF (bascule DNS / URL Netlify).

### Negative / risks
- Secrets et variables d’env à synchroniser sur **deux** comptes.
- Postgres depuis Workers nécessite **Hyperdrive** (ou équivalent) ; sans cela l’API CF ne peut pas parler TCP Postgres.
- Coût / complexité CI légèrement accrue.

## Follow-up

- [ ] Créer projet Cloudflare Pages + Worker + Hyperdrive
- [ ] Workflow GitHub `deploy-dual.yml` (CF puis Netlify)
- [ ] Documenter bascule DNS secours
- [ ] Après dual-deploy stable : refonte produit sur la nouvelle base
