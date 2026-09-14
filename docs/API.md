# API — Documentation

Documentation de la surface API de Lucepress. L'app expose une API **tRPC** (montée sur Express) pour les opérations authentifiées, plus quelques **routes Express brutes** (santé, PDF/DOCX invité, upload pièces jointes, proxy de stockage).

> Source de vérité du code : `server/routers.ts` (appRouter tRPC), `server/_core/index.ts` (createApp + routes Express), `server/clientAttachments.ts` (upload). Cette doc décrit l'architecture et les conventions ; pour les schémas d'entrée exacts (Zod), se reporter au code de chaque procédure.

---

## 1. Transports & points de montage

| Type | Chemin base | Mise en œuvre |
| --- | --- | --- |
| tRPC | `/api/trpc` | `createExpressMiddleware({ router: appRouter, createContext })` (`server/_core/index.ts`) |
| Express brut | `/api/*` (voir ci-dessous) | routes déclarées dans `createApp` |
| Proxy stockage | `/storage/*` → `/.netlify/functions/api` | redirect `netlify.toml` |
| Frontend SPA | `/*` → `/index.html` | redirect `netlify.toml` (SPA fallback) |

### Client frontend

Le client React appelle tRPC via `httpBatchLink` (`client/src/main.tsx`) :

```ts
httpBatchLink({ url: "/api/trpc", ... })
```

Type-safe end-to-end : le client importe le type `AppRouter` (`server/routers.ts`) via `client/src/lib/trpc.ts` (`createTRPCReact<AppRouter>()`). Les modifications du routeur côté serveur sont immédiatement détectées à la compilation côté client.

### Format d'appel tRPC (REST)

Les procédures tRPC sont invoquées par le client via les hooks React Query générés (`trpc.<router>.<procedure>.useQuery/useMutation`). En HTTP brut, un appel se fait sur :

```
GET  /api/trpc/<router>.<procedure>?input=<urlencoded-json>
POST /api/trpc/<router>.<procedure>   body = JSON
```

Exemple : `GET /api/trpc/billing.dashboard` (pas d'entrée), `POST /api/trpc/billing.clients.list` (entrée JSON).

---

## 2. Authentification & contexte

- **JWT** (jose v6) posé dans un cookie httpOnly. `createContext` (`server/_core/context.ts`) lit le cookie, vérifie le token et construit `ctx.user`.
- **Multi-tenant** : toute requête DB doit filtrer par tenant via `currentTenant()` ou `peekTenant()` (`server/_core/tenantContext.ts`). Les procédures staff établissent/consomment ce contexte.
- **Rôles** : admin, direction, cadre, client — via `staffProcedure` / `adminProcedure` / `directionProcedure` (voir ADR-0001).
- **CORS** : origines autorisées par `ALLOWED_ORIGINS` (`.env`). `helmet` activé (CSP désactivé pour le SPA).
- **Rate limiting** : plafond req/min par IP sur `/api/` (`API_RATE_LIMIT_MAX`, défaut 2000), via `rateLimit`.

---

## 3. Niveaux de procédure (RBAC)

| Procédure | Accès | Rôle typique |
| --- | --- | --- |
| `publicProcedure` | non authentifié | landing, login, register, guest document |
| `protectedProcedure` | tout utilisateur authentifié (client compris) | portail client |
| `staffProcedure` | staff (admin / direction / cadre) | opérations commerciales |
| `adminProcedure` | admin uniquement | paramètres société, utilisateurs, intégrations |
| `directionProcedure` | direction + admin | journal d'audit, réaffectations |
| `agentOperatorProcedure` | staff autorisé agent IA | délégations, campagnes IA |

> Détails RBAC : [`docs/adr/0001-rbac-staff-procedure.md`](./adr/0001-rbac-staff-procedure.md).

---

## 4. Routeurs tRPC (appRouter)

Cinq routeurs de premier niveau : `guest`, `auth`, `users`, `emailTemplates`, `billing`. Tout le métier commercial est sous `billing`.

### `guest.*` — Portail invité (public)
| Procédure | Type | Description |
| --- | --- | --- |
| `guest.getDocument` | query | Récupère un devis/facture par **token de partage** public |
| `guest.respondToQuote` | mutation | Acceptation/refus d'un devis par le client invité |

### `auth.*` — Authentification
| Procédure | Niveau | Type | Description |
| --- | --- | --- | --- |
| `auth.register` | public | mutation | Création de compte |
| `auth.login` | public | mutation | Connexion (pose le cookie JWT) |
| `auth.me` | public | query | Utilisateur courant |
| `auth.changePassword` | protected | mutation | Changement de mot de passe |
| `auth.logout` | public | mutation | Déconnexion |
| `auth.forgotPassword` | public | mutation | Demande de reset |
| `auth.resetPassword` | public | mutation | Reset effectif |
| `auth.previewInvitation` | public | query | Prévisualiser une invitation |
| `auth.acceptInvitation` | public | mutation | Accepter une invitation |
| `auth.listInvitations` | admin | query | Liste des invitations |
| `auth.invite` | admin | mutation | Inviter un collaborateur |
| `auth.resendInvitation` / `revokeInvitation` / `deleteInvitation` | admin | mutation | Gestion invitations |
| `auth.resetPassword` (admin) | admin | mutation | Reset d'un utilisateur |
| `auth.setRole` / `list` / `get` / `update` / `delete` | admin | — | Gestion utilisateurs |
| `auth.reassign` | direction | mutation | Réaffectation de rôles |
| `auth.googleOauthSessions` | admin | query | Sessions OAuth Google Workspace |

### `users.*` — Comptes collaborateurs (admin)
Liste, création, mise à jour, suppression des comptes internes (RBAC admin).

### `emailTemplates.*` — Modèles d'e-mail (admin)
Gestion des modèles d'e-mail (catalogue `shared/emailTemplates.ts`).

### `billing.*` — Moteur commercial (le cœur métier)

#### Top-level (staff)
| Procédure | Type | Description |
| --- | --- | --- |
| `billing.dashboard` | query | KPIs tableau de bord (encaissé, en attente, en retard, devis) |
| `billing.mailStatus` | query | Statut SMTP configuré |
| `billing.receivables` | query | Tableau des créances |
| `billing.workspaceSearch` | query | Recherche transversale (devis, factures, créances) |

#### `billing.audit` — Journal d'audit
| `audit.list` | direction | query | Journal d'actions staff |

#### `billing.clients` — Clients
| Procédure | Type | Description |
| --- | --- | --- |
| `clients.list` | query | Liste clients |
| `clients.duplicates` | query | Détection de doublons (nom, e-mail, téléphone) |
| `clients.attachments.list` | query | Pièces jointes d'un client |
| `clients.activities.list` | query | Historique d'activité d'un client |
| `clients.activities.createNote` | mutation | Note d'appel/activité |

#### `billing.settings` — Paramètres société
| `settings.get` | staff | `settings.save` | admin | Profil société (adresse, coordonnées, compte bancaire, RIB).

#### `billing.projects` — Chantiers & coûts
| Procédure | Niveau | Description |
| --- | --- | --- |
| `projects.list` | staff | Liste des chantiers |
| `projects.updatePlannedBudget` | staff | Budget prévisionnel |
| `projects.updateFinancialTargets` | staff | Marge minimale cible |
| `projects.costs.list` | staff | Coûts réels d'un chantier |
| `projects.costs.create` / `delete` | staff | Saisie / suppression de coût |
| `projects.costs.attachments.list` / `delete` | staff | Justificatifs de coût |
| `projects.profitability` | staff | Marge encaissée vs prévision, chantier par chantier |

Catégories de coût : `materiaux`, `main_oeuvre`, `transport`, `equipement`, `sous_traitance`, `autre`.

#### `billing.collection` — Recouvrement
| `collection.assignees` | staff | Liste des responsables de recouvrement |

#### `billing.clientPortal` — Portail client (protected, client)
| Procédure | Type | Description |
| --- | --- | --- |
| `clientPortal.overview` | query | Vue d'ensemble du client (par e-mail) |
| `clientPortal.invoice` / `quote` | query | Détail d'une facture / devis du client |
| `clientPortal.respondToQuote` | mutation | Acceptation/refus devis |
| `clientPortal.createPaymentPromise` | mutation | Promesse de paiement |
| `clientPortal.exportFile` / `exportFileFromHtml` | mutation | Export PDF d'un document |

#### `billing.agent` — Cerveau IA (NVIDIA NIM)
| Procédure | Niveau | Description |
| --- | --- | --- |
| `agent.center` | operator | Centre de délégations IA |
| `agent.operators` | admin | Opérateurs IA autorisés |
| `agent.createDelegation` / `submitDelegation` / `approveDelegation` | operator/admin | Cycle de vie délégation |
| `agent.copilotBriefing` | operator | Briefing IA (résumé, alertes marge, priorités recouvrement) |
| `agent.scheduleCampaign` / `simulateCampaign` / `submitCampaign` / `approveCampaign` / `suspendCampaign` / `activateCampaignSimulation` | operator/admin | Campagnes IA planifiées |
| `agent.runTestEmailNow` | operator | Envoi d'e-mail de test |
| `agent.audit` | admin | Audit des actions IA |

#### `billing.integrations` — Intégrations (admin)
| Procédure | Description |
| --- | --- |
| `integrations.list` | Intégrations disponibles |
| `integrations.audit` | Logs d'audit intégrations |
| `integrations.runtimeReadiness` | État runtime |
| `integrations.operationsDashboard` | Tableau de bord ops |
| `integrations.googleOauthSessions` | Sessions OAuth Google |
| `integrations.pendingApprovals` | Approbations en attente |
| `integrations.prepareConnection` / `disableConnection` / `save` / `preview` / `generate` / `decideApproval` / `remove` / `upsertOperatorGrant` | Configuration et cycle d'approbation |
| `integrations.startGoogleOauth` | Démarrage OAuth Google Workspace |

#### `billing.services` — Catalogue prestations
| `services.list` | staff | Catalogue métier (hydraulique, hygiène, maintenance) + tarifs. |

#### `billing.documents` — Devis & factures (staff)
| Procédure | Type | Description |
| --- | --- | --- |
| `documents.list` | query | Liste (filtre `kind` devis/facture) |
| `documents.get` | query | Détail par id |
| `documents.create` | mutation | Création (devis ou facture) |
| `documents.update` | mutation | Mise à jour |
| `documents.updateStatus` | mutation | Changement de statut |
| `documents.delete` | mutation | Suppression |
| `documents.createDepositInvoice` / `createBalanceInvoice` | mutation | Factures d'acompte / solde |
| `documents.createInvoiceFromQuote` | mutation | Facturation depuis devis |
| `documents.sendByEmail` | mutation | Envoi par e-mail |
| `documents.exportFile` / `exportFileFromHtml` | mutation | Export PDF serveur |

#### `billing.payments` — Paiements (staff)
| `payments.create` | mutation | Enregistrement d'un encaissement |

#### `billing.assistant` — Assistant IA (staff)
| Procédure | Type | Description |
| --- | --- | --- |
| `assistant.summarizeClientHistory` | query | Synthèse IA de l'historique client |
| `assistant.generateReminder` | mutation | Génération d'une relance par IA |
| `assistant.sendReminderEmail` / `sendBatchReminderEmails` | mutation | Envoi relance (unitaire / lot) |
| `assistant.prepareBatchReminders` | mutation | Préparation des relances en lot |
| `assistant.extractClient` | mutation | Extraction client depuis un e-mail (IA) |
| `assistant.proposeQuote` | mutation | Proposition de devis par IA |

---

## 5. Routes Express brutes

Déclarées dans `server/_core/index.ts` (createApp) et `server/clientAttachments.ts`. Montées sous `/api/*`.

| Méthode | Chemin | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | publique | `{ ok, db:"up"|"down", dbError }`. Sonde de santé. |
| GET | `/api/d/:token.pdf` | publique (token) | PDF serveur d'un devis/facture partagé (`buildDocumentSharePdfBuffer`). |
| GET | `/api/d/:token.docx` | publique (token) | Export DOCX du document partagé. |
| POST | `/api/client-attachments` | staff | Upload binaire d'une pièce jointe client (`express.raw`, 20 MB). |

> ⚠️ **Ne pas réintroduire** `downloadPdfFromElement` / `html2canvas` pour le portail invité : utiliser la route serveur `/api/d/:token.pdf` (règle `AGENTS.md`).

### Proxy de stockage & SPA fallback (netlify.toml)
- `/api/*` → `/.netlify/functions/api` (status 200, force) — la Function Express reçoit le path d'origine.
- `/storage/*` → `/.netlify/functions/api` (status 200, force) — proxy de stockage.
- `/*` → `/index.html` (status 200) — fallback SPA React.

---

## 6. Serverless Netlify

En prod, l'app Express est bundlée en **une seule Function** `netlify/functions/api.ts` (→ `netlify/functions/api.js`, gitignored) pour conserver le state partagé (pool Postgres, registre de routes) au chaud entre invocations.

- `node_bundler = esbuild`, `external_node_modules = ["vite", "rollup"]` (vite/rollup inutiles en serverless).
- Régénération du bundle **avant chaque déploiement** (CRITIQUE — voir `AGENTS.md` > Déploiement).

### Cycle de vie requête
1. Request Web Netlify v2 arrive avec le path d'origine (`/api/...`).
2. Redirect `netlify.toml` route vers `/.netlify/functions/api`.
3. L'handler Express (monté via `serverless-http`) traite : CORS, rate limit, tRPC ou routes brutes.

---

## 7. Formatage & conventions métier

- **Devise** : GNF (Franc guinéen), formatage `fr-GN` (`shared/billing.ts`, `formatGnf`).
- **Langue UI** : français, tutoiement.
- **Dates** : `dateText` (Zod, `YYYY-MM-DD`) pour les champs date.
- **Schémas d'entrée** : Zod, définis inline dans chaque procédure (`server/routers.ts`). Toujours `import type` pour les types partagés (sinon crash runtime `dp is not a function` — voir `AGENTS.md`).
- **E-mail** : Nodemailer + SMTP Google (`server/_core/mailer.ts`, `sendMail`). Modèles dans `shared/emailTemplates.ts`.
- **IA** : NVIDIA NIM (OpenAI-compatible) via `invokeLLM` (`server/_core/llm.ts`).
- **PDF serveur** : `server/documentSharePdf.ts` (`buildDocumentSharePdfBuffer`).

---

## 8. Vérifier l'API

```bash
# Santé backend (dev ou prod)
curl /api/health?cb=1
# → {"ok":true,"db":"up","dbError":null}

# Document invité (token de partage)
curl /api/d/<token>.pdf
# → application/pdf
```

En prod, toujours tester avec un cache-buster (`?cb=<n>`) pour contourner le cache edge Netlify.

---

## 9. Ajouter / modifier une procédure

1. **Route tRPC** : éditer `server/routers.ts` (appRouter). Choisir le bon niveau de procédure (RBAC). Définir le schéma Zod d'entrée.
2. **Accès données** : si nouvelle fonction DB, l'ajouter dans `server/db.ts` (toujours filtrer par tenant).
3. **Types partagés** : `import type` pour les types ; sinon crash runtime.
4. **Tests** : logique serveur → `server/*.test.ts` ; rendu string/HTML → `server/*.ui.test.ts` ; sécurité → `server/*Security.test.ts` / `*Safety.test.ts`. Pas de chemins absolus (`path.resolve(__dirname, ...)`).
5. **Frontend** : nouvelle page → `client/src/pages/` + route dans `client/src/App.tsx`. Le client tRPC est type-safe : aucune glue manuelle.
6. **Avant commit** : `pnpm check` + `pnpm test` (347+ tests). Vérifier le CI vert avant merge.
7. **Déploiement** : manuel, voir `AGENTS.md` > Déploiement (régénérer le bundle function).
