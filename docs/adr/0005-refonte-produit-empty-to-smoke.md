# ADR-0005: Refonte produit — empty → démo SMOKE

**Date**: 2026-09-19  
**Status**: accepted  
**Deciders**: Équipe produit Lucepress

## Context

La base Supabase est neuve (schéma + admin). L’infra dual Cloudflare/Netlify est en place. Sans données métier, la démo SMOKE (devis → facture → paiement → créances) est impossible.

## Decision

Livrer un **bootstrap démo un-clic** (`billing.bootstrapDemo`) + renforcer le guide de démarrage / tour sur le parcours cash-loop OP. Pas de rewrite UI globale dans ce lot.

Le jeu de données utilise le mot `demo` dans les libellés pour rester purgable via la console Données.

## Consequences

### Positive
- Tenant vide → parcours Créances / Aujourd’hui / Relances utilisable en &lt; 1 min.
- Aligné CDC OP / SMOKE-OP / PILOT-48H.

### Negative
- Données fictives à ne pas confondre avec la prod réelle ; purge console requise avant usage réel.
