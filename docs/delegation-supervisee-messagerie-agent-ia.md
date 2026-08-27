# Délégation supervisée de messagerie pour l’agent IA Lucepress

> **Objectif retenu.** L’agent peut préparer et, dans un cadre explicitement autorisé, exécuter des messages clients ou prospects. Il ne reçoit pas une autonomie générale : il agit seulement lorsqu’une **politique active**, une **autorisation valide**, une **condition métier vérifiée** et un **canal réellement configuré** coïncident.

## 1. Le bon principe : déléguer un cadre, pas un pouvoir illimité

Le bon modèle n’est pas « l’IA peut envoyer ». Le bon modèle est : **un responsable habilité définit avec précision ce que l’agent peut faire, pendant combien de temps, pour quels contacts, avec quelles limites et selon quelles règles de retrait**. L’IA rédige et personnalise le message ; un moteur de politiques déterministe décide si l’envoi est autorisé.

Ainsi, une relance peut être envoyée automatiquement lorsque tous les critères suivants sont vrais : facture impayée, contact autorisé, modèle de message approuvé, fenêtre horaire ouverte, plafond non atteint, aucune opposition active, autorisation non expirée et canal connecté. Si un seul critère échoue, l’envoi est bloqué et, si nécessaire, présenté à un responsable.

## 2. Trois modèles de délégation possibles

| Approche | Fonctionnement pour l’utilisateur | Contrôle | Valeur | Mise en place |
|---|---|---|---|---|
| **A. Campagne approuvée** | Le responsable approuve une campagne précise : audience, texte, période et limite. L’agent programme et envoie uniquement dans ce cadre. | Très élevé ; chaque campagne est bornée. | Excellent pour les relances de factures et suivis de devis. | Le plus simple et le plus prudent pour démarrer. |
| **B. Délégation limitée dans le temps** | Un administrateur autorise l’agent à envoyer certains types de messages pendant une période donnée, sous plafonds stricts. | Élevé ; l’autorisation peut être suspendue ou révoquée instantanément. | Permet un vrai gain de temps au quotidien. | Nécessite une bonne interface d’autorisations et de suivi. |
| **C. Délégation à deux validateurs** | Certaines opérations sensibles — envoi groupé, nouveau modèle, segment de prospects — exigent deux accords distincts avant exécution. | Maximum ; principe des quatre yeux. | Adapté aux campagnes commerciales à impact élevé. | Plus exigeant, à réserver aux usages stratégiques. |

Ces trois modèles peuvent coexister. La décision importante est de ne jamais passer directement de l’absence d’automatisation à une autonomie globale. Lucepress peut activer d’abord des campagnes approuvées, ajouter ensuite une délégation temporaire pour les relances répétitives, puis utiliser la double validation pour les campagnes plus larges.

## 3. Cas d’usage autorisables

| Cas d’usage | Déclencheur déterministe | Action que l’agent prépare | Niveau d’autorisation conseillé |
|---|---|---|---|
| **Relance avant échéance** | Facture ouverte, échéance dans X jours. | Rappel courtois avec référence et solde. | Campagne approuvée ou délégation limitée. |
| **Relance de retard** | Facture impayée après échéance, sans promesse valide. | Message de suivi et proposition de prise de contact. | Campagne approuvée au départ. |
| **Suivi de promesse** | Promesse à venir dans X jours ou promesse échue. | Rappel factuel de la date annoncée. | Campagne approuvée ; validation renforcée si promesse échue. |
| **Suivi de devis** | Devis envoyé, sans décision après X jours. | Relance commerciale non agressive. | Délégation limitée après tests. |
| **Confirmation de rendez-vous** | Rendez-vous créé et contact consentant. | Confirmation ou rappel standardisé. | Délégation limitée. |
| **Prospection** | Contact enregistré avec base de contact et préférence de communication valides. | Message de premier contact approuvé. | Double validation et plafonds très stricts. |
| **Réponse à une demande entrante** | Message client reçu et classé comme information simple. | Brouillon de réponse ; jamais envoi automatique au lancement. | Relecture humaine obligatoire. |

Les actions suivantes restent exclues de toute délégation : accepter une remise, modifier un engagement contractuel, confirmer une livraison litigieuse, reconnaître une responsabilité, négocier un règlement, enregistrer un paiement, transmettre un document sensible, supprimer des données ou envoyer à un contact sans base de communication autorisée.

## 4. Les champs de configuration à offrir aux responsables

### 4.1 Autorisation de délégation

Chaque autorisation est une fiche indépendante, affichée dans un centre « Délégations de l’agent ». Elle ne modifie jamais les droits généraux d’un utilisateur.

| Champ | Exemple | Règle de sécurité |
|---|---|---|
| **Nom de l’autorisation** | « Relances factures – septembre » | Obligatoire, unique et lisible dans l’audit. |
| **Statut** | Brouillon, à approuver, active, suspendue, expirée, révoquée. | Active seulement après l’accord requis. |
| **Responsable propriétaire** | Directeur général ou administrateur. | Seul le propriétaire ou un administrateur peut modifier/révoquer. |
| **Périmètre fonctionnel** | Relance de retard, suivi de devis, rappel de promesse. | Liste blanche ; aucun périmètre libre ou implicite. |
| **Population autorisée** | Clients débiteurs, devis envoyés, prospects consentants. | Segment enregistré et prévisualisable avant activation. |
| **Canal** | E-mail, WhatsApp Business, SMS. | Disponible uniquement si le canal est configuré et activé. |
| **Modèles autorisés** | Modèles de relance versionnés. | Une nouvelle version invalide l’autorisation jusqu’à ré-approbation. |
| **Validité** | Du 1er au 30 septembre. | Expiration automatique ; pas de durée illimitée par défaut. |
| **Fréquence** | 1 message / client / 7 jours. | Contrôle déterministe avant mise en file. |
| **Plafond** | 20 messages/jour, 80 par campagne. | Blocage net lorsque le plafond est atteint. |
| **Fenêtre d’envoi** | Lundi–vendredi, 09:00–17:00, fuseau défini. | Hors fenêtre : report ou blocage, jamais envoi immédiat. |
| **Niveau de revue** | Aucune après activation, revue d’échantillon, double approbation. | Dépend du risque et du volume. |
| **Motif métier** | « Réduire les impayés à risque ». | Visible dans chaque message et rapport d’audit. |

### 4.2 Politique de contenu

Le responsable choisit un **modèle approuvé** ; l’IA ne peut personnaliser que les zones prévues, telles que le nom, la référence, le solde vérifié, l’échéance ou un lien sécurisé. Elle ne peut pas inventer une menace, une pénalité, une date, une remise ou une condition commerciale.

| Champ | Effet |
|---|---|
| **Ton** | Courtois, professionnel, ferme ou commercial. |
| **Langue** | Français par défaut ; autre langue uniquement sur choix explicite. |
| **Variables autorisées** | Champs issus du serveur : numéro, solde, date, chantier, interlocuteur. |
| **Expressions interdites** | Menaces, promesses non autorisées, indications juridiques ou financières non validées. |
| **Lien autorisé** | PDF de facture, portail client ou lien de paiement vérifié ; pas de lien libre injecté par l’IA. |
| **Signature** | Signature Lucepress approuvée et versionnée. |

### 4.3 Gestion des habilitations

Au lieu d’ajouter seulement des rôles globaux, la solution doit gérer des **capacités fines** par utilisateur ou fonction.

| Capacité | Administrateur | Directeur général habilité | Responsable commercial habilité | Agent IA |
|---|---:|---:|---:|---:|
| Configurer les canaux et politiques | Oui | Oui si délégué | Non | Non |
| Créer une campagne | Oui | Oui | Oui, selon périmètre | Brouillon seulement |
| Approuver une campagne standard | Oui | Oui si délégué | Optionnel, selon règle | Non |
| Activer une délégation | Oui | Oui si délégué | Non | Non |
| Suspendre immédiatement un envoi | Oui | Oui | Oui si campagne propriétaire | Non |
| Consulter l’audit complet | Oui | Oui | Selon périmètre | Non |
| Produire un message | Oui, à la demande | Oui, à la demande | Oui, à la demande | Oui, dans un modèle autorisé |
| Envoyer un message | Via politique active | Via politique active | Via politique active | Seulement si toutes les politiques valident |

La première version peut garder l’administrateur comme unique approbateur, puis déléguer certaines capacités à un directeur général ou à un responsable par un écran explicite. Une délégation ne peut jamais donner plus de pouvoir que celui détenu par l’utilisateur qui l’accorde.

## 5. Règles de sécurité avant chaque envoi

Avant de créer une tâche d’envoi, le moteur doit effectuer tous les contrôles ci-dessous. Ils sont déterministes, tracés et non négociables.

1. **Canal actif.** L’intégration concernée est réellement activée, avec secrets valides ; sinon l’agent crée au plus un brouillon.
2. **Autorisation active.** L’autorisation existe, son statut est actif, sa fenêtre de validité n’est pas expirée et son propriétaire n’a pas été désactivé.
3. **Correspondance de portée.** Le contact, le type de message, le canal, le modèle, le segment et le motif correspondent exactement à l’autorisation.
4. **État métier encore vrai.** Une facture n’est relancée que si son solde reste dû ; une promesse n’est suivie que si elle est encore pertinente ; un devis n’est suivi que s’il n’est pas accepté, refusé ou expiré selon la politique.
5. **Préférence de contact.** Le canal est permis par le contact, aucune opposition n’est active et le contact n’est pas sur une liste d’exclusion.
6. **Limites respectées.** Aucun doublon, plafond quotidien/campagne/contact non dépassé, délai minimal depuis le dernier message respecté.
7. **Contenu sûr.** Le message rendu utilise un modèle approuvé, des variables vérifiées, la bonne signature et aucun texte interdit.
8. **Moment approprié.** L’envoi se situe dans la plage autorisée ; l’heure est interprétée selon le fuseau choisi pour l’autorisation.
9. **Contrôle de volume.** Les campagnes volumineuses passent par une phase d’échantillon et, lorsqu’elle est requise, une seconde approbation.
10. **Arrêt d’urgence.** Une suspension, révocation ou erreur répétée stoppe immédiatement les tâches restantes non envoyées.

## 6. Cycle de vie sûr d’une campagne ou délégation

```text
Brouillon de règle ou campagne
        ↓
Prévisualisation de l’audience, des conditions et de 3 messages exemples
        ↓
Simulation sans envoi : volumes, exclusions et raisons de blocage
        ↓
Approbation du responsable habilité (double accord si politique sensible)
        ↓
Activation avec date de fin, plafonds et bouton de suspension
        ↓
Mise en file à l’heure prévue après contrôles individuels
        ↓
Envoi idempotent, journalisation et suivi de livraison
        ↓
Rapport, exceptions et révocation automatique à échéance
```

Le système ne doit pas se fonder sur un minuteur dans le navigateur ou le serveur. Les exécutions planifiées doivent passer par un mécanisme durable côté application, capable de survivre aux redémarrages, avec tâches idempotentes et contrôles répétés au moment exact de l’envoi. Pour un message unique qui nécessite une rédaction IA, le modèle est appelé dans l’exécution planifiée ; la décision d’envoyer demeure toutefois intégralement déterministe.

## 7. Double validation et niveaux de responsabilité

La double validation ne doit pas alourdir les relances unitaires approuvées, mais doit protéger les décisions à exposition élevée.

| Situation | Approbation minimale | Contrôle complémentaire |
|---|---|---|
| Relance d’une facture unique depuis un modèle existant | Une approbation administrateur au niveau de la campagne/délégation. | Journalisation de chaque envoi. |
| Délégation de relances pendant 30 jours | Administrateur ou directeur général autorisé. | Date d’expiration, plafonds, révocation instantanée. |
| Nouveau modèle de message client | Administrateur. | Test d’aperçu et versionnement. |
| Campagne de plus de 20 contacts | Deux responsables distincts. | Échantillon initial de 3 à 5 messages et surveillance des échecs. |
| Prospection ou nouveau segment | Deux responsables distincts. | Preuve de base de communication, limite journalière basse. |
| Modification de canal, secret ou politique globale | Administrateur uniquement. | Journal d’audit renforcé et session récente. |

## 8. Journalisation et tableau de supervision

Le tableau de contrôle doit répondre clairement à quatre questions : **qui a autorisé quoi, à qui l’agent a écrit, pourquoi, et avec quel résultat**. Chaque événement conserve l’identifiant de politique, sa version, le modèle, la version du texte généré, les données métier utilisées, la décision des contrôles, l’identité du responsable, l’horodatage, la référence externe de livraison et les éventuelles erreurs.

| Vue | Informations essentielles |
|---|---|
| **Délégations actives** | Propriétaire, périmètre, date de fin, plafond consommé, bouton Suspendre. |
| **File programmée** | Contact, motif, horaire, modèle, état des contrôles, action Annuler. |
| **Envois récents** | Statut de livraison, lien vers source facture/devis, politique associée. |
| **Exceptions** | Blocages, oppositions, plafond atteint, erreur canal, message à revoir. |
| **Audit** | Export filtrable par période, responsable, canal, client, campagne et décision. |

Une suspension est prioritaire : elle annule les messages non envoyés de son périmètre sans effacer l’historique. Une révocation met fin à la délégation et exige une nouvelle approbation avant toute réactivation.

## 9. Éléments de données à prévoir

La future implémentation pourra reposer sur des objets séparés afin que les autorisations soient compréhensibles et révocables sans modifier l’historique : **canaux de messagerie**, **préférences de contact**, **modèles versionnés**, **délégations d’agent**, **campagnes**, **tâches d’envoi**, **décisions d’approbation** et **événements d’audit**. Les octets de pièces jointes restent dans le stockage de fichiers ; la base ne conserve que leurs métadonnées et références.

Les rôles ne doivent pas être simplement « admin / utilisateur ». Il est préférable d’introduire des permissions spécifiques reliées à un utilisateur et, si besoin, à un périmètre : par exemple `agent.delegation.create`, `agent.delegation.approve`, `agent.campaign.activate`, `agent.messaging.pause` et `agent.audit.read`.

## 10. Proposition de lancement progressif

| Phase | Ce qui est activé | Ce qui reste bloqué |
|---|---|---|
| **1. Simulation** | Préparation de messages, simulation de campagne, aperçu audience et raisons de blocage. | Tout envoi réel. |
| **2. Relances programmées approuvées** | Factures en retard et promesses à suivre, modèles approuvés, administrateur unique. | Prospection, réponses entrantes et envois en volume. |
| **3. Délégation temporaire** | Relances répétitives dans une plage, plafonds et arrêt d’urgence. | Nouveau texte libre et canaux non configurés. |
| **4. Double validation** | Devis à suivre, campagnes ciblées et prospection consentante. | Toute délégation sans date de fin ou sans audit. |
| **5. Autonomie assistée avancée** | Agent capable de proposer, planifier et exécuter les tâches relevant d’autorisations existantes. | Décisions contractuelles, financières, litigieuses ou non prévues par une politique. |

## 11. Recommandations concrètes pour Lucepress

La première capacité d’envoi réel devrait être **la relance programmée de facture** via une campagne approuvée. C’est le cas d’usage le plus objectif : solde, échéance, promesse et historique sont déjà structurés dans l’application. Avant tout envoi, l’interface doit fonctionner plusieurs semaines en mode simulation pour vérifier les destinataires, le ton et la fréquence.

La seconde capacité peut être le suivi de devis, puis seulement la prospection consentante sous double validation. L’analyse de messages entrants ou de justificatifs reste préférable en brouillon tant que les règles de confidentialité, de ton et de classification ne sont pas éprouvées.

## 12. Arbitrages à confirmer ensemble

1. Souhaitez-vous commencer avec les **relances de factures** uniquement, ou inclure dès la première version le **suivi de devis** ?
2. À quel plafond initial souhaitez-vous limiter une campagne : **10**, **20** ou **50** messages par jour ?
3. La délégation automatique doit-elle toujours expirer au bout de **30 jours**, ou acceptez-vous 90 jours pour certaines campagnes ?
4. Qui doit pouvoir activer une délégation : administrateur seulement, ou directeur général et responsable commercial après attribution explicite ?
5. Pour les canaux réels, souhaitez-vous préparer d’abord l’e-mail, WhatsApp Business, ou les deux — sachant qu’aucun envoi réel ne sera possible sans l’activation sécurisée du connecteur correspondant ?

## 13. Paramètres validés par Lucepress

Les choix suivants sont désormais la politique de référence pour la première version de messagerie déléguée.

| Paramètre | Décision validée | Garde-fou appliqué |
|---|---|---|
| **Cas d’usage initial** | Relances de factures **et** suivi de devis. | Les réponses aux messages entrants, la prospection et les négociations restent en brouillon à valider. |
| **Plafond organisationnel** | Au plus **60 messages par jour**. | Un plafond par contact et par campagne s’ajoute au plafond global ; une limite atteinte bloque la tâche, sans report silencieux. |
| **Durée maximale d’une délégation** | Jusqu’à **90 jours** par campagne ou autorisation. | Pas de renouvellement automatique ; toute prolongation recrée une approbation explicite. |
| **Responsables habilitables** | Directeur général et responsable commercial, après attribution explicite. | L’administrateur attribue, réduit ou retire chaque capacité ; personne ne peut s’accorder ses propres droits. |
| **Canaux à préparer** | E-mail et WhatsApp Business. | Les deux restent en mode préparation sans secrets, vérification et activation sécurisée du canal concerné. |

### 13.1 Politique de capacité à 60 messages/jour

Un volume de 60 messages par jour nécessite une supervision proportionnée. Le plafond s’applique à l’organisation, mais aussi à chaque politique, campagne et contact. Pour prévenir la répétition ou une erreur d’audience, la règle initiale proposée est de ne pas contacter un même destinataire plus d’une fois sur le même motif dans une période de sept jours, sauf si une réponse explicite du client ou une décision administrateur le justifie.

Les campagnes qui prévoient plus de 20 destinataires conservent une double validation : un premier responsable approuve le contenu et l’audience, un second confirme l’activation. Avant le premier envoi réel, une campagne passe par une simulation et un échantillon limité à cinq messages de test destinés à des contacts autorisés. Toute erreur de livraison répétée, opposition de contact ou dépassement de fréquence suspend les messages restant à envoyer.

### 13.2 Habilitations du directeur général et du responsable commercial

Le directeur général et le responsable commercial peuvent recevoir des capacités distinctes, définies par l’administrateur. La délégation est limitée à un périmètre, une durée, des canaux et des modèles de messages déterminés.

| Capacité | Directeur général habilité | Responsable commercial habilité | Administrateur |
|---|---:|---:|---:|
| Créer une campagne de relance ou suivi de devis | Oui | Oui, dans son portefeuille autorisé | Oui |
| Approuver un modèle existant et l’audience | Oui | Oui, si attribution explicite | Oui |
| Activer une délégation de campagne | Oui, si l’attribution le permet | Oui, si l’attribution le permet | Oui |
| Approuver une campagne supérieure à 20 messages | Peut être premier ou second validateur | Peut être premier ou second validateur, jamais seul | Oui |
| Créer ou modifier une politique globale | Non | Non | Oui |
| Attribuer, modifier ou retirer les habilitations | Non | Non | Oui |
| Suspendre une campagne de son périmètre | Oui | Oui | Oui |
| Consulter l’audit global | Oui si attribué | Seulement son périmètre | Oui |

Le principe est qu’une même personne ne peut pas créer, approuver et activer seule une campagne à double validation. Un responsable peut préparer son propre brouillon, mais un autre responsable habilité doit approuver la campagne avant activation. L’administrateur conserve un droit de suspension et de révocation prioritaire.

### 13.3 Activation conditionnelle de l’e-mail et de WhatsApp Business

La préparation simultanée des deux canaux ne les rend pas actifs. Chaque canal suit son propre cycle : configuration sécurisée de ses secrets, vérification technique, envoi test à des destinataires désignés, revue du résultat par l’administrateur, puis activation explicite. Une autorisation ou une campagne choisit un canal déterminé ; l’agent ne bascule pas automatiquement de l’e-mail vers WhatsApp, ni l’inverse.

Si l’e-mail ou WhatsApp n’est pas activé, le système peut continuer à simuler les messages, à préparer les brouillons et à identifier les envois à venir. Il ne crée aucune communication sortante et signale clairement que le canal est indisponible. Cela maintient la capacité de supervision sans laisser croire qu’une intégration externe est active.

### 13.4 Périmètre de la première livraison fonctionnelle

La première livraison doit proposer : la création d’une campagne de relance de facture ou de suivi de devis, les réglages de validité jusqu’à 90 jours, le plafond de 60 messages/jour, les modèles approuvés, la simulation d’audience, la double validation au-delà de 20 messages, la suspension instantanée, et le tableau d’audit. L’agent peut proposer et préparer les messages au sein de ce périmètre ; l’envoi réel ne sera activé qu’après la mise en place séparée et sécurisée du connecteur e-mail ou WhatsApp Business.
