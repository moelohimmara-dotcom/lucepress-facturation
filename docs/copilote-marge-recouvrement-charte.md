# Charte du Copilote IA de marge et recouvrement

> **Décision validée.** Lucepress retient un orchestrateur IA unique à outils métier contrôlés. Sa première spécialisation est le **Copilote de marge et recouvrement**. À son lancement, toute validation d’action est réservée à un administrateur.

## 1. Mandat

Le Copilote transforme les données déjà présentes dans Lucepress — encaissements, coûts, budget initial, seuil de marge, créances et promesses de paiement — en une lecture opérationnelle compréhensible. Il explique les alertes, établit un ordre de traitement et prépare les prochaines actions. Il n’est ni comptable autonome, ni système de paiement, ni expéditeur autonome de messages.

| À faire | À ne jamais faire |
|---|---|
| Expliquer une marge sous seuil avec les chiffres source. | Modifier un coût, un budget, un seuil ou une facture. |
| Prioriser les retards, promesses échues et promesses à venir. | Enregistrer une promesse ou qualifier un paiement. |
| Préparer un brouillon de relance clair et adapté. | Envoyer un e-mail, message WhatsApp ou courrier. |
| Signaler les données insuffisantes ou contradictoires. | Inventer une valeur, une échéance, une preuve ou un justificatif. |
| Soumettre une action envisagée à l’administrateur. | Contourner une approbation, un rôle ou une intégration désactivée. |

## 2. Périmètre de la première version

La première version reste **lecture seule**. Elle peut consulter, dans le périmètre autorisé de l’administrateur : la rentabilité par chantier, les coûts et encaissements agrégés, les créances, les promesses de paiement, l’historique client pertinent et les documents strictement nécessaires à l’explication. Elle peut produire quatre résultats : un briefing, une analyse d’alerte, un plan de recouvrement et un brouillon de relance.

Tout brouillon doit afficher le libellé **« Brouillon IA — relecture administrateur obligatoire »**. Le brouillon peut être copié ou placé dans la file d’approbation, mais ne devient jamais une communication sortante sans une action explicite d’un administrateur.

## 3. Outils métier autorisés

L’orchestrateur ne dispose pas d’un accès direct à la base de données. Il appelle uniquement des outils serveur typés et testés, dans une liste blanche.

| Outil conceptuel | Données retournées | Autorisation | Écriture |
|---|---|---|---|
| `lire_rentabilite_chantier` | Encaissements, coûts, marge, budget, prévision, seuil et écart. | Administrateur. | Non. |
| `lire_creances_prioritaires` | Factures impayées, retards, soldes, promesses échues ou à venir. | Administrateur. | Non. |
| `lire_contexte_client` | Coordonnées utiles, historique de relance et documents rattachés. | Administrateur, accès minimal. | Non. |
| `preparer_relance` | Brouillon, motifs factuels, ton choisi et champs à confirmer. | Administrateur. | Non. |
| `soumettre_approbation` | Demande d’action interne avec diff et justification. | Administrateur. | Oui, mais sans effet commercial/externe. |

Les outils recevront uniquement des identifiants validés et le contexte nécessaire. Les calculs de marge, de solde, de retard et de priorité continuent à être exécutés par les fonctions métier déterministes de Lucepress, jamais par le modèle.

## 4. Règles de priorisation

L’algorithme de priorisation est volontairement explicable et déterministe. L’IA le traduit en recommandations ; elle ne le remplace pas.

| Priorité | Règle factuelle | Restitution du Copilote |
|---|---|---|
| **Critique** | Une promesse de paiement est échue et un solde reste dû. | Mettre en tête du briefing ; proposer une relance ferme à approuver. |
| **Haute** | Une facture est en retard sans promesse valide. | Expliquer les jours de retard et proposer une relance. |
| **Haute** | La marge réalisée est calculée et inférieure au seuil du chantier. | Identifier coûts, encaissements, écart à la prévision et contrôles proposés. |
| **Préventive** | Une promesse de paiement arrive à échéance sous sept jours. | L’afficher dans « Promesses à venir » et suggérer un suivi préparatoire. |
| **À compléter** | Budget initial absent, devis accepté absent, ou encaissement insuffisant pour un taux de marge. | Indiquer exactement quelle donnée manque ; ne pas simuler une marge prévue. |

À priorité équivalente, les créances sont triées par ancienneté de retard, puis par solde restant. Les chantiers en marge sous seuil sont triés par écart négatif à la cible et, ensuite, par montant de marge négative.

## 5. Cycle d’orchestration

```text
Demande administrateur
        ↓
Vérification d’identité, de rôle et de portée
        ↓
Classification : briefing / analyse / plan / brouillon
        ↓
Collecte minimale via les outils autorisés
        ↓
Calcul et contrôle des faits par le serveur
        ↓
Réponse structurée : constats, sources, hypothèses, priorité, action proposée
        ↓
Si action sensible : file d’approbation administrateur
        ↓
Journal d’audit de l’exécution et de la décision
```

La boucle est bornée : au plus quatre consultations métier par demande, un délai maximal, et aucune nouvelle requête de donnée si elle n’est pas nécessaire à la question. Si plusieurs clients ou chantiers correspondent, le Copilote demande une clarification au lieu de choisir arbitrairement.

## 6. Contrat de sortie de l’IA

Chaque réponse opérationnelle est contrôlée avec un schéma structuré avant affichage. Elle comprend l’intention reconnue, les identifiants de sources consultées, les constats factuels, les données manquantes, le niveau de priorité, les hypothèses, le niveau de confiance et l’action proposée. Si le schéma est invalide, la réponse n’est pas utilisée ; l’application affiche une demande de reformulation ou une erreur sûre.

Les chiffres visibles proviennent des réponses déterministes du serveur. Le modèle peut les reformuler, mais ne peut ni les recalculer comme source d’autorité, ni introduire de montant absent des données consultées.

## 7. Validation et audit

L’administrateur est le seul rôle approbateur au lancement. Une approbation doit afficher l’objet concerné, la version des données, les valeurs avant/après si une écriture est envisagée, la justification, le brouillon d’action et le périmètre d’impact. Le journal conserve l’utilisateur, la demande, la politique appliquée, les outils consultés, les identifiants de sources, le résultat, la décision et l’horodatage.

Les canaux externes restent désactivés tant que leurs secrets ne sont pas configurés et que leur activation n’est pas confirmée. Même après activation, toute communication ou écriture externe passe par la file d’approbation et une clé d’idempotence.

## 8. Première interface à construire

Le Copilote apparaîtra d’abord dans le cockpit commercial, avec trois demandes guidées : **« Expliquer mes marges sous seuil »**, **« Préparer les relances prioritaires »** et **« Faire le briefing de recouvrement »**. Chaque réponse montrera les sources, la priorité, les données manquantes et une carte de brouillon si une relance est suggérée. Aucune modification ne sera disponible dans cette première interface.

## 9. Critères d’acceptation

La première itération sera considérée prête lorsque l’administrateur pourra obtenir un briefing fiable à partir des données existantes, comprendre pourquoi une marge ou une créance est prioritaire, préparer sans envoyer une relance et consulter l’historique de la demande. Les tests devront confirmer l’absence d’accès côté client aux secrets, le respect du rôle administrateur, le blocage des écritures, l’exactitude des priorités et l’étiquetage obligatoire des brouillons IA.

La prochaine décision fonctionnelle consiste à confirmer si les **justificatifs de coûts PDF/images** seront exclus de la première version ou analysés uniquement après validation explicite de l’administrateur. La recommandation est de les exclure d’abord pour concentrer l’itération sur les données financières déjà structurées.
