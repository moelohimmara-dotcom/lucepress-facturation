# Activation ultérieure des intégrations externes

Le Centre d’intégrations est actuellement volontairement en **mode préparatoire sécurisé**. Les fournisseurs, capacités, demandes d’approbation et tableaux de suivi sont disponibles ; aucune requête OAuth ni aucun webhook entrant ne peut cependant déclencher de flux externe tant que les secrets correspondants ne sont pas configurés côté serveur.

## Google Workspace

L’activation demandera un client OAuth créé dans Google Cloud, l’activation des API Google retenues et une URI de redirection HTTPS strictement identique à celle déclarée dans Google Cloud. Le serveur devra recevoir `GOOGLE_OAUTH_CLIENT_SECRET` via la gestion sécurisée des secrets. Le callback, l’échange du code et l’activation finale devront rester côté serveur ; seule une référence opaque vers le coffre de secrets peut être enregistrée en base.

## WhatsApp Business

L’activation demandera `WHATSAPP_APP_SECRET` pour vérifier la signature HMAC des événements et `WHATSAPP_WEBHOOK_VERIFY_TOKEN` pour le défi de configuration du webhook. Le journal Lucepres ne doit conserver que l’identifiant d’événement, son type, l’état de signature, l’état de traitement et une synthèse non sensible : jamais le contenu des messages ni les secrets.

## Exploitation

Avant de rendre un flux actif, préparez la connexion concernée dans l’interface, renseignez les secrets dans la gestion sécurisée, vérifiez l’URI ou l’URL de callback, puis testez le parcours avec un compte fournisseur de test. Toute écriture externe doit continuer à passer par la file d’approbations avant exécution.

## Plan de validation lors de l’activation

| Domaine | Scénario | Résultat attendu |
| --- | --- | --- |
| OAuth Google | Autorisation acceptée avec un `state` valide et non expiré | Le code est échangé côté serveur, une référence opaque est créée dans le coffre, la connexion passe par l’état de vérification. |
| OAuth Google | `state` manquant, modifié, réutilisé ou expiré | Le callback est refusé sans échange de code et une trace d’audit de refus est enregistrée. |
| OAuth Google | Retour fournisseur avec `error=access_denied` | La session est marquée en échec, la connexion demeure inactive et aucun secret n’est persisté. |
| OAuth Google | Secret client absent | Le callback répond avec indisponibilité contrôlée, sans redirection ni appel à Google. |
| WhatsApp | Vérification initiale avec jeton correct | Le défi est renvoyé uniquement lorsque le jeton attendu correspond. |
| WhatsApp | Signature HMAC valide | L’événement est dédupliqué par son identifiant, les métadonnées non sensibles sont journalisées et le tableau de bord s’actualise. |
| WhatsApp | Signature absente ou invalide | L’événement est rejeté, aucun contenu de message n’est conservé et le compteur de rejets est mis à jour. |
| WhatsApp | Même identifiant d’événement reçu deux fois | Le journal n’ajoute pas de doublon et conserve le dernier état de traitement. |
| Approbations | Écriture approuvée puis refusée | Chaque décision est nominative, auditable et l’opération ne peut être exécutée qu’après approbation. |
