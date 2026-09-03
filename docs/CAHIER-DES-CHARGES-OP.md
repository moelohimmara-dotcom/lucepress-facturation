# Cahier des charges — Lucepress Gestion OP

**Version :** 1.0 · **Date :** 2026-09-03  
**Statut :** Approuvé pour exécution (démo client non encore payeur)

## 1. Contexte

Lucepress Gestion est le cockpit commercial-financier de **Lucepres Sarl** (Guinée, GNF) : devis → facture → encaissement → créances → marge chantier.

Ce CDC vise une version **OP (opérationnelle)** pour démonstration et usage interne, avec **WhatsApp Business** et **paiements intégrés** (Orange Money, MTN MoMo, Wave) **volontairement en sourdine**.

## 2. Objectifs

### Montrer en démo
- Devis → facture (acompte/solde) → **e-mail SMTP** → paiement **manuel** GNF → créances → marge
- Rôles admin / directeur / cadre utilisables
- Relance **envoyée par e-mail** (plus seulement brouillon)

### Ne pas montrer / ne pas activer
- Connexion WhatsApp Business
- Paiement en un clic Orange Money / MTN / Wave
- Formulation UI : badge **« Bientôt »**, pas de CTA trompeur

## 3. Personas

| Rôle | Besoin |
|------|--------|
| **Admin** | Paramètres, utilisateurs, intégrations (lecture sourdine), tout le commercial |
| **Directeur** | Pilotage commercial + créances + marges sans 403 |
| **Cadre** | Devis, factures, paiements, relances e-mail |
| **Client (portail)** | Voir factures, promesse de paiement |

## 4. Exigences fonctionnelles

### P0
1. **RBAC réel** — alignement UI / tRPC ; plus de menu visible puis 403
2. **Envoi e-mail** documents (SMTP) fiable
3. **Relance e-mail** — bouton « Envoyer par e-mail » après génération IA
4. **UX fiable** — loading/erreur aperçu, UTF-8, logo, libellés FR
5. **Déploiement** — script VPS reproductible
6. **Sourdine** WhatsApp / paiement intégré

### P1
1. Portail client dans la navigation + lien dans e-mails documents
2. Paiements manuels renforcés (`mobile_money` = saisie référence, pas API)
3. Journal d’audit des envois e-mail / changements de statut
4. IA : brouillon → envoyer par e-mail après relecture

### Phase 2 (hors périmètre actuel)
WhatsApp, APIs MoMo, offline PWA, multi-tenant SaaS, SYSCOHADA/DGI.

## 5. Critères d’acceptation

- [ ] Directeur et cadre consultent dashboard / devis / factures sans FORBIDDEN
- [ ] Admin seul gère utilisateurs et paramètres société
- [ ] Relance : générer → envoyer SMTP → activité client enregistrée
- [ ] Intégrations WhatsApp / paiement : badge « Bientôt », pas d’activation
- [ ] Portail client accessible depuis le menu
- [ ] `scripts/deploy-vps` documenté et utilisable
- [ ] WhatsApp / gateway MoMo absents du pitch démo

## 6. Contraintes techniques

- Stack : React + Vite + Express + tRPC + Drizzle/MySQL + PM2
- Messaging : SMTP only ; adapter WhatsApp stub désactivé
- Ne pas réintroduire OAuth Manus / admin anonyme

## 7. Références

- Diagnostic produit (canvas)
- Plan d’exécution sprints A–D
- ADRs : RBAC, messaging SMTP-first
