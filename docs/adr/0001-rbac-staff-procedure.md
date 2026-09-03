# ADR-0001: RBAC via staffProcedure (admin / directeur / cadre)

**Date**: 2026-09-03  
**Status**: accepted  
**Deciders**: Équipe produit Lucepress OP

## Context

L’UI exposait les mêmes menus pour admin, directeur et cadre, mais la majorité des procédures tRPC étaient protégées par `adminProcedure`. Les rôles directeur et cadre recevaient donc des **403** sur devis, factures, créances, etc. — bloquant la démo opérationnelle multi-profils.

## Decision

Introduire `staffProcedure` (admin | directeur | cadre) pour les parcours commerciaux et financiers OP. Réserver `adminProcedure` aux utilisateurs, templates e-mail, intégrations et paramètres société sensibles. Filtrer la navigation front avec `canAccessPath` / `ADMIN_ONLY_PATHS`.

## Alternatives Considered

### Alternative 1: Tout passer en protectedProcedure
- **Pros**: Simple
- **Cons**: Aucune distinction de rôle côté API
- **Why not**: Contredit le modèle RH Lucepres (admin vs direction vs cadre)

### Alternative 2: Matrice fine par procédure (ACL complète)
- **Pros**: Granularité maximale
- **Cons**: Coût élevé pour la phase démo
- **Why not**: Reporté ; la matrice à 3 niveaux suffit pour P0

## Consequences

### Positive
- Directeur / cadre peuvent enchaîner devis → e-mail → paiement → relance
- Nav et API alignées (moins de 403 silencieux)

### Negative
- Cadre a accès large au commercial ; pas de cloisonnage chantier-par-chantier

### Risks
- Fuite de routes admin dans la nav si `ADMIN_ONLY_PATHS` non tenu à jour — mitigation : revue lors d’ajout de menu
