# Agent IA Lucepress : propositions de rôles et d’orchestration

> **Principe directeur.** L’agent IA assiste l’équipe de Lucepress dans ses décisions et sa préparation opérationnelle ; il ne devient jamais l’autorité qui engage l’entreprise. Les montants, statuts, échéances, droits et écritures sont calculés et vérifiés par les règles métier du serveur. L’IA produit des explications, des plans et des brouillons à valider.

## 1. Vision recommandée : un copilote orchestrateur supervisé

Lucepress peut adopter un **orchestrateur central** qui comprend la demande formulée par un utilisateur, sélectionne uniquement les outils métier autorisés, rassemble les données nécessaires, contrôle son propre résultat puis présente une action lisible. Cette approche est préférable à un assistant conversationnel libre : elle conserve une trace de chaque information utilisée, limite les données exposées au modèle et transforme les actions sensibles en demandes d’approbation.

| Composant | Responsabilité | Ne doit jamais faire seul |
|---|---|---|
| **Routeur d’intention** | Reconnaître le besoin : devis, chantier, marge, créance, relance ou document. | Lire ou modifier des données sans vérifier le rôle utilisateur. |
| **Planificateur** | Proposer une suite courte d’étapes et les données à consulter. | Appeler un outil non autorisé, contourner une règle ou une approbation. |
| **Exécuteur d’outils** | Lire les données métier avec des paramètres validés et limités. | Exécuter une écriture sans décision humaine explicite. |
| **Vérificateur déterministe** | Recalculer les totaux, vérifier les statuts, dates, droits et seuils. | Confier au modèle le calcul final d’un montant ou d’une règle. |
| **Présentateur** | Montrer le résultat, les sources, l’incertitude et l’action proposée. | Masquer une hypothèse, une donnée manquante ou un échec. |
| **File d’approbation** | Conserver un diff, une justification, un décideur et une date avant exécution. | Déclencher une opération externe sans validation. |

## 2. Trois architectures envisageables

| Proposition | Fonctionnement | Avantages | Limites | Position recommandée |
|---|---|---|---|---|
| **A. Copilote guidé** | L’utilisateur choisit une fonction, puis l’IA prépare une réponse ou un brouillon. | Rapide à livrer, facile à expliquer, très faible risque. | Moins flexible pour les demandes complexes. | Bon point de départ pour les premiers usages. |
| **B. Orchestrateur unique à outils contrôlés** | Un agent classe la demande, établit un plan, appelle une liste blanche d’outils puis demande validation. | Naturel en langage courant, audit complet, bon équilibre valeur/contrôle. | Demande une vraie couche de politiques et de tests. | **Option recommandée pour Lucepress.** |
| **C. Équipe de sous-agents spécialisés** | Un superviseur délègue à des agents Devis, Finance, Recouvrement et Chantier. | Très extensible et adapté à de grands volumes. | Complexité, latence et diagnostic plus difficiles. | À envisager après la stabilisation de l’option B. |

La solution conseillée est l’**option B**, avec des rôles spécialisés au niveau des règles et des outils, sans multiplier immédiatement les agents autonomes. Le passage à l’option C sera justifié lorsque les procédures seront stables, que les volumes d’usage seront réels et que les cas d’échec seront connus.

## 3. Rôles métier proposés

| Rôle IA | Questions qu’il traite | Sortie autorisée | Décision humaine nécessaire |
|---|---|---|---|
| **Assistant commercial** | « Prépare un devis pour un forage à Kindia. » | Brouillon de devis, lignes proposées, informations client manquantes. | Création, modification, envoi ou acceptation du devis. |
| **Analyste de rentabilité** | « Pourquoi la marge du chantier baisse-t-elle ? » | Diagnostic sourcé : encaissements, coûts, écart au budget, seuil. | Modification de budget, seuil, coût ou document. |
| **Assistant recouvrement** | « Que faut-il relancer cette semaine ? » | Liste priorisée et brouillons de relance. | Envoi de tout message et toute promesse de paiement. |
| **Assistant chantier** | « Quels coûts sont anormaux sur ce site ? » | Signalement explicable, pièces justificatives à vérifier, actions proposées. | Qualification d’un coût, suppression ou correction. |
| **Lecteur de documents** | « Résume ce justificatif ou extrait les éléments utiles. » | Extraction structurée avec niveau de confiance et champs à confirmer. | Enregistrement dans le système de gestion. |
| **Assistant de direction** | « Donne-moi le briefing commercial du jour. » | Synthèse de créances, promesses, devis et marges. | Toute action qui en découle. |
| **Opérateur d’intégrations** | « Prépare la synchronisation vers la comptabilité. » | Simulation, prévisualisation du mapping et demande d’approbation. | Activation des intégrations, écritures ou messages externes. |

## 4. Règles algorithmiques : le contrat de confiance

### 4.1 Classification du risque

Chaque demande reçoit un niveau de risque avant que l’agent ne choisisse une action.

| Niveau | Exemple | Politique |
|---|---|---|
| **R0 — Information** | Expliquer l’état d’une créance ou la marge d’un chantier. | Lecture limitée, réponse sourcée, sans modification. |
| **R1 — Brouillon** | Préparer un devis, une relance ou un résumé. | Génération autorisée, statut « à relire », aucune écriture métier. |
| **R2 — Écriture interne** | Créer une facture, modifier un coût, mettre à jour un budget. | Prévisualisation d’un diff et approbation explicite d’un administrateur. |
| **R3 — Action externe** | Envoyer un e-mail, appeler une API comptable, synchroniser un chantier. | Connexion active, secret valide, approbation dédiée, journal complet et mécanisme d’idempotence. |
| **R4 — Interdit** | Effectuer un paiement, promettre un règlement, supprimer en masse, inventer une preuve. | Refus explicite avec explication et proposition d’alternative sûre. |

### 4.2 Règles non négociables

1. **Aucun chiffre n’est inventé.** Les montants, taxes, soldes, marges et jours de retard proviennent des services métier ; les calculs sont repris côté serveur.
2. **Le périmètre est minimal.** L’agent reçoit uniquement les dossiers nécessaires à la demande, filtrés par rôle et rattachement client/chantier.
3. **Toute sortie exploitable est structurée.** Le modèle retourne un schéma strict comprenant au minimum l’intention, les sources, les hypothèses, les champs manquants, le niveau de confiance et la prochaine action proposée.
4. **Tout brouillon est étiqueté.** Un devis, une relance ou une extraction porte visiblement « Brouillon IA — relecture obligatoire » jusqu’à validation.
5. **Toute écriture exige un diff.** Avant validation, l’utilisateur voit les valeurs avant/après, les impacts financiers et l’origine de la proposition.
6. **Les actions sont bornées.** Une exécution dispose d’un nombre maximal d’appels d’outils, d’un délai et d’une liste d’actions autorisées par rôle.
7. **Chaque étape est traçable.** L’historique conserve la requête, la politique appliquée, les identifiants de données consultées, le résultat, le décideur et l’horodatage.
8. **Les intégrations restent désactivées par défaut.** Aucune transmission Google, WhatsApp, Procore, QuickBooks ou autre ne s’effectue sans secrets configurés et activation explicite.

### 4.3 Seuils de confiance et gestion des erreurs

Une faible confiance ne doit pas être traitée comme une erreur silencieuse. Si une pièce est illisible, si le client est ambigu ou si des lignes de devis manquent, l’agent s’arrête et demande une clarification. Les propositions pouvant avoir une conséquence financière ou contractuelle restent en validation humaine, quel que soit le niveau de confiance annoncé par le modèle.

## 5. Orchestration d’une demande

```text
Demande utilisateur
        ↓
Contrôle d’accès + classification du risque
        ↓
Construction du contexte minimal et des sources autorisées
        ↓
Plan court généré par l’orchestrateur
        ↓
Boucle bornée : outil de lecture → vérification serveur → étape suivante
        ↓
Réponse structurée, brouillon ou diff d’action
        ↓
Validation humaine si R2/R3
        ↓
Exécution idempotente + journal d’audit
```

L’agent ne doit pas recevoir un accès SQL direct ni un accès générique au serveur. Les seuls outils disponibles sont des fonctions métier typées, par exemple `consulter_chantier`, `lister_creances`, `analyser_marge`, `preparer_devis`, `preparer_relance` et `soumettre_pour_approbation`. Chaque fonction vérifie l’identité, le rôle, les identifiants et les règles existantes avant de répondre.

## 6. Expériences utilisateur prioritaires

### Scénario 1 : devis de chantier

L’utilisateur décrit un besoin de forage ou de BTP. L’assistant identifie les données manquantes, propose des prestations du catalogue, calcule les montants avec les règles métier et affiche un brouillon complet. L’utilisateur corrige, puis valide le devis. L’agent ne l’envoie jamais seul.

### Scénario 2 : analyse de marge sous seuil

Depuis le module « Coûts & marges », l’utilisateur demande une explication. L’assistant compare les encaissements, coûts réels, budget initial, devis acceptés et seuil configuré. Il cite les postes qui expliquent l’écart et propose des contrôles : pièce manquante, coût inhabituel, ajustement de budget ou relance d’une facture. Les données chiffrées restent calculées de façon déterministe.

### Scénario 3 : recouvrement assisté

L’assistant prépare une revue des factures en retard, des promesses échues et des promesses à venir. Il suggère un ordre de traitement et rédige un message adapté. L’utilisateur relit et confirme chaque relance ; l’envoi reste bloqué tant qu’aucune intégration de communication n’est activée.

## 7. Stratégie de modèles

Le serveur doit consulter le catalogue de modèles disponible au moment de l’exécution plutôt que de figer un identifiant dans le code. Un modèle rapide et économique suffit pour la classification, l’extraction, le résumé et les brouillons courts. Un modèle plus robuste est réservé aux plans multi-étapes ou à l’analyse de documents complexes. Tous les appels restent côté serveur, avec un schéma de sortie strict ; le navigateur ne reçoit jamais de secret.

| Type de tâche | Niveau de modèle | Sortie attendue |
|---|---|---|
| Classification, résumé, extraction | Rapide | JSON strict, sans raisonnement affiché. |
| Devis complexe, diagnostic de marge, plan d’action | Raisonnement renforcé | Plan borné, sources, hypothèses et validation requise. |
| Pièce PDF ou image | Multimodal | Champs extraits, confiance, éléments à confirmer. |
| Évaluation avant action R2/R3 | Vérificateur déterministe d’abord ; IA en second avis | Diff validé ou demande de clarification. |

## 8. Feuille de route proposée

| Étape | Périmètre | Résultat concret | Condition de passage |
|---|---|---|---|
| **1. Socle de confiance** | Charte IA, politiques de risques, journal d’exécution et schémas structurés. | Interface expliquant ce que l’agent peut ou ne peut pas faire. | Règles métier et tests de refus validés. |
| **2. Copilote lecture seule** | Briefing direction, analyse de marge, explication de créances et recherche de données. | Réponses sourcées, aucune écriture. | Tests d’autorisation et de périmètre réussis. |
| **3. Brouillons contrôlés** | Devis, relances et résumés de justificatifs. | Prévisualisations avec relecture obligatoire. | Validation humaine enregistrée et réversible. |
| **4. Orchestration d’actions internes** | Plans multi-étapes et soumissions à la file d’approbation. | Diffs, idempotence et audit par action. | Aucun contournement de validation en test. |
| **5. Proactivité et intégrations** | Alertes préparées, routines opt-in et connecteurs réellement activés. | Recommandations en temps utile, jamais d’envoi aveugle. | Secrets, consentement, règles d’horaires et supervision en place. |

## 9. Arbitrages à décider ensemble

Pour démarrer, je propose de retenir **trois rôles pilotes** : Assistant commercial, Analyste de rentabilité et Assistant recouvrement. Ils couvrent le cycle complet « besoin terrain → devis → exécution → encaissement », valorisent les modules déjà livrés et peuvent rester entièrement sous contrôle humain.

Les décisions à prendre sont les suivantes :

1. Quel rôle doit être lancé en premier : **devis**, **marge** ou **recouvrement** ?
2. Qui peut approuver une action interne : seulement l’administrateur, ou également un responsable commercial/chantier ?
3. Souhaitez-vous des alertes proactives dès la première version, ou uniquement sur demande au départ ?
4. Quelle durée de conservation faut-il prévoir pour le journal d’audit de l’agent ?
5. Les documents de coûts pourront-ils être analysés automatiquement, ou faudra-t-il une confirmation avant toute lecture par l’IA ?

Une fois ces arbitrages établis, la première itération la plus utile consiste à construire le **Copilote de marge et recouvrement** : il ne modifie rien, explique les alertes déjà présentes, prépare les prochaines actions et alimente la file d’approbation existante.
