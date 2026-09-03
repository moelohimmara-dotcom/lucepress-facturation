# Backlog Phase 2 — Après engagement / paiement client

Document de backlog uniquement. **Ne pas démarrer** tant que le client n’a pas payé / donné le feu vert.

## Canaux & paiements (priorité business)

| Item | Description | Dépendances |
|------|-------------|-------------|
| WhatsApp Business | Templates Meta, envoi devis/relances, webhook delivery | Compte Meta, secrets, flag activation |
| Orange Money API | Lien / push paiement, webhook confirmation | Contrat OM, sandbox |
| MTN MoMo API | Idem | Contrat MTN |
| Wave (si pertinent) | Idem zone | Contrat Wave |

## Produit & plateforme

| Item | Description |
|------|-------------|
| Offline-first PWA | Cache devis/factures, sync différée |
| Multi-tenant self-serve | Inscription PME, isolation stricte, billing |
| Mentions DGI / OHADA | NIF, TVA 18 %, numérotation audit |
| Export comptable SYSCOHADA | Pour expert-comptable |
| Acceptation devis côté client | Signature / accept dans le portail |

## Non-objectifs Phase 2

- Devenir Odoo (stock / RH / achats complets)
- Refonte Next.js / microservices sans besoin métier clair
