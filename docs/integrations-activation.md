# Activation ultérieure des intégrations externes

Le Centre d’intégrations est actuellement volontairement en **mode préparatoire sécurisé**. Les fournisseurs, capacités, demandes d’approbation et tableaux de suivi sont disponibles ; aucune requête OAuth ni aucun webhook entrant ne peut cependant déclencher de flux externe tant que les secrets correspondants ne sont pas configurés côté serveur.

## Google Workspace

L’activation demandera un client OAuth créé dans Google Cloud, l’activation des API Google retenues et une URI de redirection HTTPS strictement identique à celle déclarée dans Google Cloud. Le serveur devra recevoir `GOOGLE_OAUTH_CLIENT_SECRET` via la gestion sécurisée des secrets. Le callback, l’échange du code et l’activation finale devront rester côté serveur ; seule une référence opaque vers le coffre de secrets peut être enregistrée en base.

## WhatsApp Business

L’activation demandera `WHATSAPP_APP_SECRET` pour vérifier la signature HMAC des événements et `WHATSAPP_WEBHOOK_VERIFY_TOKEN` pour le défi de configuration du webhook. Le journal Lucepres ne doit conserver que l’identifiant d’événement, son type, l’état de signature, l’état de traitement et une synthèse non sensible : jamais le contenu des messages ni les secrets.

## Exploitation

Avant de rendre un flux actif, préparez la connexion concernée dans l’interface, renseignez les secrets dans la gestion sécurisée, vérifiez l’URI ou l’URL de callback, puis testez le parcours avec un compte fournisseur de test. Toute écriture externe doit continuer à passer par la file d’approbations avant exécution.
