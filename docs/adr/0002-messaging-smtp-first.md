# ADR-0002: Messaging SMTP-first ; WhatsApp & MoMo API en sourdine

**Date**: 2026-09-03  
**Status**: accepted  
**Deciders**: Équipe produit Lucepress OP

## Context

Le client de démo n’a pas encore payé. WhatsApp Business et les gateways Orange Money / MTN MoMo / Wave ne doivent pas être le pitch central ni être activés en production. Le canal opérationnel immédiat est l’**e-mail SMTP** (documents, invites, relances) ; les paiements restent **manuels** (mode `mobile_money` = saisie libre de référence).

## Decision

Canal d’envoi OP = SMTP uniquement (`sendMail` / `sendByEmail` / `sendReminderEmail`). Adapter WhatsApp présent éventuel mais **non branché UI** et non activable. Paiements intégrés MoMo/Orange : UI `Bientôt`, pas d’API. Phase 2 documentée dans `docs/BACKLOG-PHASE2-POST-PAIEMENT.md`.

## Alternatives Considered

### Alternative 1: Activer WhatsApp pour impressionner en démo
- **Pros**: Différenciation Afrique
- **Cons**: Engagement Meta, templates, risque de promesse non tenue
- **Why not**: Client non payeur ; sourdine volontaire

### Alternative 2: Intégrer Orange Money immédiatement
- **Pros**: Encaissement digital
- **Cons**: Contrats opérateurs, webhooks, KYC
- **Why not**: Hors périmètre OP ; saisie manuelle suffit pour la démo cash

## Consequences

### Positive
- Démo crédible bout-en-bout sans dépendances opérateurs
- Relances = envoi réel + activité client

### Negative
- Pas de delivery WhatsApp ni de lien de paiement one-click

### Risks
- Confusion si UI montre encore des CTA WhatsApp/MoMo — mitigation : badges `Bientôt` et copy explicite
