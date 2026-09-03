# Pilot smoke 48 h — Lucepres Gestion

Objectif : qu’**une ou deux personnes** puissent utiliser l’app **dès aujourd’hui** pendant **48 heures**, sans formation longue.

Prod : https://lucepress.213.156.135.139.sslip.io

## Avant d’inviter (5 min, admin)

1. Connexion admin.
2. **Paramètres** → vérifier SMTP (bandeau / statut e-mail OK). Sans SMTP : devis/factures/relances ne partent pas.
3. Créer **1 compte staff** (cadre ou directeur) pour le second testeur, ou partager le même compte si solo.
4. Optionnel : inviter **1 client portail** sur une fiche client pour tester acceptation de devis.

## Parcours du jour 1 (30–45 min)

Point d’entrée unique : menu **Aujourd’hui** (`/`).

| Étape | Action | Où |
| --- | --- | --- |
| 1 | Ajouter un client (nom + e-mail) | Clients |
| 2 | Créer un devis (assistant IA ou manuel), puis **envoyer** | Devis → document |
| 3 | Ouvrir **Aujourd’hui** : la carte « En attente client » ou « Envoyer le devis » doit apparaître / disparaître | Aujourd’hui |
| 4 | (Si portail) Client accepte/refuse le devis | Portail client |
| 5 | Convertir en facture (acompte ou totale) | Document devis accepté |
| 6 | Ouvrir **Créances** : solde, rappel, ou promesse | Créances |
| 7 | Depuis **Aujourd’hui**, cliquer une carte urgente → dialogue de suivi | Aujourd’hui → Créances |

## File « Aujourd’hui » — ce qui apparaît

Une carte = une décision. Priorité :

1. SMTP indisponible / premier client manquant  
2. Factures en retard / promesses dépassées  
3. Rappels du jour  
4. Devis à envoyer / devis acceptés à facturer  
5. Devis envoyés en attente client  

CTA rapides en tête de page : **Nouveau devis**, **Créances**, **Relances**.

## Jour 2 — usage réel

- Traiter la file le matin (vider les urgents).
- Envoyer 1–2 relances depuis **Créances** (lot possible) si SMTP OK.
- Ne pas s’appuyer sur **Agent IA** pour l’envoi client : simulation uniquement pendant le pilot.

## Critères de succès du test

- [ ] Connexion staff OK  
- [ ] Client + devis créés  
- [ ] E-mail devis reçu (ou échec SMTP visible et corrigé)  
- [ ] Carte Aujourd’hui cohérente après chaque action  
- [ ] Au moins un suivi créance (rappel / statut)  
- [ ] Feedback oral : « je sais quoi faire en ouvrant l’app »

## Hors scope 48 h

WhatsApp, Mobile Money, envoi agent IA vers clients réels, refonte complète ERP.

## Après le pilot

Noter frictions (surtout : trop de clics, cartes manquantes, SMTP). Ensuite : journal d’audit + bascule progressive agent → validation inbox.
