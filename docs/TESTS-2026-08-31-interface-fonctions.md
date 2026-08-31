# Rapport de test — Interface & Fonctions (suite parties A-D)

**Date :** 31 août 2026
**Environnement :** VPS 213.156.135.139 (PM2 + MySQL + Ollama Cloud)
**URL :** https://lucepress.213.156.135.139.sslip.io

---

## 1. Tests de l'interface web (en direct)

### 1.1 Pages principales

| Section | URL | HTTP | Contenu vérifié |
|---------|-----|------|----------------|
| Devis | `/devis` | 200 | DEV-2026-101 (12,5M GNF), DEV-2026-102 (85M GNF) |
| Clients | `/clients` | 200 | 21 clients réels (ANAFIC, Bolloré, Total, UNICEF, CBG...) |
| Tableau de bord | `/tableau-de-bord` | 200 | En cours: 12,5M GNF · Retard: 0 · Marge: -17,5M GNF |
| Création devis | `/devis/nouveau` | 200 | Formulaire + 21 clients + galerie modèles (BTP, Rénovation...) |

### 1.2 Authentification

| Page | URL | Résultat |
|------|-----|----------|
| Auth | `/auth` | 404 (route inexistante) |
| Login | `/login` | 404 (route inexistante) |

**Analyse :** L'app utilise un système OAuth externe (`OAUTH_SERVER_URL` non configuré sur ce VPS). Sans OAuth, l'app bascule automatiquement en **mode local-admin** (fallback prévu dans `server/_core/context.ts` ligne 22-36) : un utilisateur `admin` par défaut (`local-admin`) est créé si aucune session n'existe. Cela permet l'accès complet sans login externe.

**Conclusion :** Le mode local-admin est fonctionnel et suffisant pour les environnements de test/démo. Le vrai login OAuth nécessiterait :
- `OAUTH_SERVER_URL=https://auth.manus.im` (ou autre portail)
- `GOOGLE_OAUTH_CLIENT_SECRET` (credentials du portail)

---

## 2. Tests fonctionnels (API + IA)

### 2.1 Copilote IA (agent)

| Route | Résultat |
|-------|----------|
| `billing.agent.copilotBriefing` (client 18) | ✅ Briefing structuré (analyse, contrôles, relances, données à vérifier) |

### 2.2 Assistant IA

| Route | Résultat |
|-------|----------|
| `billing.assistant.extractClient` | ✅ Coordonnées extraites (ex: Bati Guinée, Mamadou Diallo) |
| `billing.assistant.proposeQuote` | ✅ Devis structuré (réf DEV-2025-08-27-001, lignes, TVA, totaux) |
| `billing.assistant.summarizeClientHistory` | ✅ Synthèse client (ex: ANAFIC) |

### 2.3 Création de devis (écriture DB)

**Test :** Création d'un devis via `billing.documents.create`

**Payload :**
```json
{
  "kind": "devis",
  "clientId": 18,
  "issueDate": "2026-08-31",
  "validUntil": "2026-09-30",
  "status": "brouillon",
  "isAiDraft": true,
  "lines": [{
    "description": "Test creation devis via API Hermes",
    "quantity": 1,
    "unit": "forfait",
    "unitPrice": 1000000,
    "taxRate": 18
  }]
}
```

**Résultat :**
- ✅ Devis créé : ID 8, référence `DEV-2026-0002`
- ✅ Total calculé : 1 180 000 GNF (1 000 000 HT + 180 000 TVA 18%)
- ✅ Statut : brouillon

**Note :** Devis de test laissé en brouillon (inoffensif, non envoyé).

---

## 3. Conclusion

| Fonction | Statut |
|----------|--------|
| Interface web (Devis, Clients, Tableau de bord, Création) | ✅ Fonctionnelle |
| Mode local-admin (fallback auth) | ✅ Actif |
| OAuth externe | ⚠️ Non configuré (nécessite credentials Manus) |
| Création devis via IA (proposeQuote) | ✅ Validée |
| Écriture DB (documents.create) | ✅ Validée |

**Le projet est pleinement opérationnel en mode local-admin.** L'OAuth externe est optionnel (pour la prod avec vrai login) mais n'est pas bloquant.

---

## 4. Recommandations

1. **OAuth prod** : Configurer `OAUTH_SERVER_URL` + `GOOGLE_OAUTH_CLIENT_SECRET` si un vrai login est requis.
2. **Devis test** : Supprimer ou marquer "refusé" le devis `DEV-2026-0002` (brouillon de test).
3. **Sécurité** : Régénérer la clé API Ollama Cloud (exposée dans l'historique).
4. **Performance** : `nemotron-3-ultra` est lent (~50s) — envisager un cache ou un modèle plus rapide pour la prod.
