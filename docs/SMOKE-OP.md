# Smoke OP — parcours démo (manuel)

À exécuter après deploy (`scripts/deploy-vps.sh`) sur un compte **cadre** ou **directeur** (pas seulement admin).

1. **Login** avec rôle cadre → nav sans Intégrations / Agent IA ; pas d’erreur 403 sur Devis / Factures / Créances.
2. **Devis** → créer ou ouvrir → **Envoyer par e-mail** (SMTP) → statut `envoye` + activité client.
3. Accepter le devis (staff) → facture acompte → **Enregistrer un paiement** (mode Mobile Money + référence libre) → activité « Paiement manuel enregistré ».
4. Facture avec solde en retard → **Relances** → générer modèle → **Envoyer par e-mail** → activité « Relance envoyée par e-mail ».
5. **Portail client** (compte user même e-mail que fiche client) → voir factures / promesse.
6. **Intégrations** (admin) → bandeau « Canaux premium en sourdine » ; WhatsApp / MoMo sans CTA d’activation trompeur.
7. Healthcheck : `GET /api/health` (ou URL `HEALTH_URL` du script deploy).
