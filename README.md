# Lucepress Sarl — Application de gestion commerciale

Application de facturation et de gestion commerciale pour **Lucepress Sarl**, entreprise guinéenne de BTP, forage et services durables (Conakry, Guinée).

Gère les devis, factures, clients, chantiers, relances de paiement, suivi des créances, envoi d'e-mails (SMTP Google), portail client invité, cerveau IA (NVIDIA NIM) et déploiement PWA installable hors-ligne.

---

## Table des matières

1. [Stack technique](#stack-technique)
2. [Structure du projet](#structure-du-projet)
3. [Prérequis et installation](#prérequis-et-installation)
4. [Variables d'environnement](#variables-denvironnement)
5. [Commandes de développement](#commandes-de-développement)
6. [Architecture détaillée](#architecture-détaillée)
7. [Base de données (Supabase / PostgreSQL)](#base-de-données-supabase--postgresql)
8. [API tRPC et routeurs](#api-trpc-et-routeurs)
9. [Authentification et multi-tenant](#authentification-et-multi-tenant)
10. [Cerveau IA (NVIDIA NIM)](#cerveau-ia-nvidia-nim)
11. [E-mails (SMTP Google) et templates](#e-mails-smtp-google-et-templates)
12. [PDF et partage de documents](#pdf-et-partage-de-documents)
13. [PWA (installable + hors-ligne)](#pwa-installable--hors-ligne)
14. [UI/UX — patron « Atelier lumineux »](#uiux--patron-atelier-lumineux)
15. [Tests](#tests)
16. [Déploiement Netlify (mode manuel)](#déploiement-netlify-mode-manuel)
17. [CI GitHub Actions](#ci-github-actions)
18. [Convention de contribution](#convention-de-contribution)
19. [Dépannage (troubleshooting)](#dépannage-troubleshooting)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, wouter (routing), @tanstack/react-query, tRPC client |
| Backend | Express, tRPC server, Drizzle ORM, serverless-http (Netlify Functions) |
| Base de données | PostgreSQL (Supabase), Drizzle migrations |
| Auth | JWT (jose v6) + cookies httpOnly |
| IA | NVIDIA NIM (OpenAI-compatible) via `invokeLLM` |
| E-mail | Nodemailer + SMTP Google (app password Gmail) |
| PDF | jsPDF (PDF serveur), html2canvas (rendu client — legacy) |
| PWA | vite-plugin-pwa, Workbox (generateSW, runtime caching) |
| Fonts | Fraunces Variable + Outfit Variable + JetBrains Mono Variable + Caveat (self-host via @fontsource) |
| Déploiement | Netlify (mode manuel, sans build automatique GitHub) |
| Tests | Vitest (347 tests), jsdom pour les composants UI |
| Package manager | pnpm |

---

## Structure du projet

```
lucepress-facturation/
├── client/                   # Frontend React (SPA)
│   ├── src/
│   │   ├── App.tsx           # Routing (wouter), lazy loading des pages
│   │   ├── main.tsx          # Entry point + imports des fonts
│   │   ├── index.css         # Tokens Tailwind + patron "Atelier lumineux"
│   │   ├── pages/            # 30 pages (DocumentEditorPage, Home, etc.)
│   │   ├── components/       # 71 composants (DashboardLayout, ui/, etc.)
│   │   ├── lib/              # trpc.ts, pdf.ts, hooks utilitaires
│   │   └── tests/           # Tests UI (Phase10Plus.test.tsx, etc.)
│   ├── index.html            # index.html (sans CDN Google Fonts)
│   └── public/               # Icônes PWA, favicon, manifest
├── server/                   # Backend Express + tRPC
│   ├── _core/                # Cœur serveur (index.ts, context, llm, mailer, tenantContext)
│   ├── db.ts                 # Couche d'accès données (Drizzle) + seed
│   ├── routers.ts            # Routeurs tRPC (appRouter)
│   ├── documentSharePdf.ts    # Génération PDF serveur (buildDocumentSharePdfBuffer)
│   ├── clientAttachments.ts  # Routes Express d'upload
│   └── *.test.ts             # Tests serveur
├── shared/                   # Code partagé client/serveur
│   ├── emailTemplates.ts     # 7 modèles d'e-mail (catalogue EMAIL_TEMPLATES)
│   ├── billing.ts            # Formatage GNF, calculs
│   ├── companyProfile.ts     # Profil public Lucepress
│   └── agentCampaignSchedule.ts
├── drizzle/                  # Migrations Drizzle + schémas
│   ├── schema.pg.ts          # Schéma PostgreSQL (source de vérité)
│   ├── schema.ts             # Alias de schema.pg.ts
│   └── *.sql                 # 33 migrations
├── netlify/
│   └── functions/
│       └── api.ts            # Function serverless (handler Netlify v2)
├── scripts/                  # gen-pwa-icons.mjs, bench, deploy-vps.sh
├── docs/                     # Documentation métier (cahier des charges, etc.)
├── notes/                    # Notes de conception
├── .github/workflows/ci.yml  # CI GitHub Actions
├── netlify.toml              # Config Netlify (functions, redirects)
├── vite.config.ts            # Vite + VitePWA
├── vitest.config.ts          # Vitest (jsdom/node par globs)
├── drizzle.config.ts         # Drizzle Kit
└── package.json              # Scripts pnpm
```

---

## Prérequis et installation

### Prérequis

- **Node.js** 20+ (22 en CI)
- **pnpm** (version via `packageManager` dans package.json)
- Une base **PostgreSQL** (Supabase recommandé) — `DATABASE_URL`
- Un compte **Netlify** pour le déploiement (mode manuel)

### Installation

```bash
git clone https://github.com/moelohimmara-dotcom/lucepress-facturation.git
cd lucepress-facturation
pnpm install
```

### Fichier `.env` (local)

Copiez `.env.example` vers `.env` et renseignez les variables (voir section suivante).

```bash
cp .env.example .env
```

---

## Variables d'environnement

Toutes les variables sont lues dans `server/_core/env.ts` et `server/db.ts`.

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | URL PostgreSQL Supabase `postgresql://...` |
| `JWT_SECRET` | ✅ | Secret JWT (min 32 caractères) |
| `SMTP_HOST` | E-mail | `smtp.gmail.com` |
| `SMTP_PORT` | E-mail | `465` |
| `SMTP_USER` | E-mail | Compte Gmail |
| `SMTP_PASS` | E-mail | Mot de passe d'application Gmail |
| `SMTP_FROM` | E-mail | Expéditeur (`"Lucepres Sarl <...>"`) |
| `BUILT_IN_FORGE_API_KEY` | IA | Clé API NVIDIA NIM (`nvapi-...`) |
| `BUILT_IN_FORGE_API_URL` | IA | `https://integrate.api.nvidia.com/v1` |
| `VITE_APP_ID` | Frontend | Identifiant app (ex: `lucepress-prod`) |
| `OAUTH_SERVER_URL` | OAuth | URL serveur OAuth (si activé) |
| `ALLOWED_ORIGINS` | CORS | Origines autorisées (séparées par `,`) |
| `TRUST_PROXY` | Proxy | Hops de proxy de confiance (Netlify = `1`) |
| `DATABASE_POOL_SIZE` | DB | Taille du pool (défaut 10) |
| `API_RATE_LIMIT_MAX` | API | Requêtes/min par IP (défaut 2000) |

> ⚠️ **Production Netlify** : les variables sont définies via le CLI `netlify-cli env:set`, **pas** dans le repo (jamais de secrets dans git).

---

## Commandes de développement

```bash
pnpm dev          # Serveur dev (tsx watch) sur localhost:3000
pnpm check        # Typecheck (tsc --noEmit)
pnpm test         # Tests (vitest run) — 347 tests
pnpm build        # Build complet (vite + esbuild serveur)
pnpm build:netlify # Build frontend uniquement (vite build) pour déploiement
pnpm db:push      # Générer + appliquer migrations Drizzle
pnpm format       # Prettier
```

### Prévisualisation locale du frontend seul

```bash
pnpm build:netlify  # génère dist/public/
npx vite preview    # sert le build
```

---

## Architecture détaillée

### Deux chemins de serveur

1. **`server/_core/serve.ts`** — mode dev/standalone (`pnpm dev`, `pnpm start`). Démarre Express + seed les templates e-mail.
2. **`netlify/functions/api.ts`** — mode serverless Netlify. Crée l'app via `createApp()` et adapte la `Request` Web (Netlify v2) vers l'event API Gateway v1 attendu par `serverless-http`.

Les deux chemins partagent `server/_core/index.ts` → `createApp()` qui monte Express, helmet, CORS, rate-limit, les routes Express (health, PDF, attachments, storage proxy) et le middleware tRPC.

### Flux d'une requête API en production

```
Client → Netlify Edge → redirect /api/* → /.netlify/functions/api
       → api.ts (Request Web → event v1) → serverless-http → Express
       → tRPC middleware (createContext) → appRouter → db.ts (Drizzle) → Supabase
```

### Frontend (SPA)

- **Routing** : wouter (`<Switch>`/`<Route>`), lazy loading via `React.lazy`
- **Data fetching** : `@tanstack/react-query` + client tRPC (`@/lib/trpc.ts`)
- **State** : hooks React + React Query (pas de store global)
- **UI** : Tailwind CSS v4 + composants Radix UI (`client/src/components/ui/`)

---

## Base de données (Supabase / PostgreSQL)

- **ORM** : Drizzle (type-safe, migrations SQL versionnées)
- **Schéma source** : `drizzle/schema.pg.ts` (830 lignes, ~40 tables)
- **Migrations** : 33 fichiers SQL dans `drizzle/`
- **Pool** : `pg` avec pool de 10 connexions (configurable via `DATABASE_POOL_SIZE`)

### Appliquer les migrations

```bash
# Générer une migration après modification du schéma
pnpm drizzle-kit generate

# Appliquer les migrations sur la base
pnpm db:push
```

> ⚠️ **Note** : `drizzle.config.ts` indique `dialect: "mysql"` (historique), mais le schéma actif est PostgreSQL (`schema.pg.ts`). Pour les nouvelles migrations, utiliser Drizzle Kit en mode PostgreSQL.

### Tables principales

- `tenants` — multi-tenant (chaque entreprise a son `tenantId`)
- `users`, `invitations` — comptes et invitations collaborateurs
- `clients` — clients (entreprises BTP/forage)
- `documents` — devis et factures
- `documentShareLinks` — liens de partage invité (token hashé)
- `emailTemplates` — modèles d'e-mail (amorcés automatiquement)
- `companySettings` — paramètres entreprise (coordonnées, banque)
- `clientActivities` — journal d'activité client
- `agentDelegations` — délégations de l'agent IA

### Amorçage automatique (seed)

`seedDefaultEmailTemplates()` (dans `server/db.ts`) peuple les 7 modèles d'e-mail du catalogue `shared/emailTemplates.ts` au démarrage. Elle est appelée dans `createApp()` (path serverless) de façon **non-bloquante**.

---

## API tRPC et routeurs

Le routeur principal `appRouter` (dans `server/routers.ts`) expose :

| Routeur | Procédures | Accès |
|---|---|---|
| `guest` | `getDocument`, `respondToQuote` | Public (token de partage) |
| `auth` | `login`, `register`, `me`, `changePassword` | Public/protégé |
| `users` | `list`, `create`, `setRole`, `remove`, `invite` | Admin |
| `emailTemplates` | `list`, `create`, `update`, `delete`, `preview`, **`generate`** (IA) | Admin |
| `billing` | `dashboard`, `mailStatus`, `audit`, `clients`, `documents`, `settings`, `projects`, etc. | Staff/Admin |
| `agent` | `center`, `copilotBriefing`, `createDelegation`, etc. | Agent operator |

### Procédures (middleware d'accès)

- `publicProcedure` — ouvert
- `protectedProcedure` — utilisateur authentifié
- `staffProcedure` — staff commercial
- `adminProcedure` — administrateur
- `agentOperatorProcedure` — habilitation agent IA

Le contexte tenant est établi via `AsyncLocalStorage` (`server/_core/tenantContext.ts`) — voir section multi-tenant.

---

## Authentification et multi-tenant

### Authentification

- **JWT** signé avec `jose` v6, stocké en cookie httpOnly
- `createContext` (dans `server/_core/context.ts`) lit le cookie, vérifie le JWT, peuple `ctx.user`
- Mots de passe hachés via `scrypt` (asynchrone, voir `server/db.ts`)

### Multi-tenant

L'app est **multi-tenant** : chaque table métier porte un `tenantId`. Le filtrage par tenant est **automatique** via `AsyncLocalStorage` :

```typescript
// server/_core/tenantContext.ts
export function runWithTenant<T>(tenantId: number | null, fn: () => Promise<T>): Promise<T>
export function currentTenant(): number  // lève si hors contexte
export function peekTenant(): number | undefined  // tolérant (tâches de fond)
```

- Les procédures tRPC établissent le tenant dans `createContext`
- `db.ts` filtre systématiquement par `currentTenant()` (sécurité anti-fuite inter-tenant)
- Les routes Express brutes (ex: `/api/d/:token.pdf`) récupèrent le tenant via le lien de partage (`link.tenantId`)

> ⚠️ **Important** : toute nouvelle route Express brute qui accède aux données doit établir le contexte tenant (via `runWithTenant`) ou utiliser un payload qui l'inclut déjà. Ne pas appeler `getCompanySettings()` hors contexte → erreur `Aucun tenant dans le contexte de requête`.

---

## Cerveau IA (NVIDIA NIM)

### Configuration

- **Provider** : NVIDIA NIM (API OpenAI-compatible)
- **Point d'entrée** : `server/_core/llm.ts` → `invokeLLM(params)` et `listLLMModels()`
- **Clé API** : `BUILT_IN_FORGE_API_KEY` (`nvapi-...`)
- **Modèle préféré** : `nvidia/nemotron-3-ultra-550b-a55b`, fallback `mistralai/mistral-nemotron`, puis premier modèle disponible

### Utilisations

1. **Copilote marge & recouvrement** — `agent.copilotBriefing` : analyse le contexte JSON, génère un briefing structuré (alertes marge, priorités de recouvrement, actions suggérées)
2. **Génération de templates d'e-mail** — `emailTemplates.generate` : génère un modèle HTML + sujet + texte à partir d'une description libre (style Mailchimp warm humanist)
3. **Campagnes d'agent** — planification et envoi d'e-mails automatisés

### Ajouter un appel IA

```typescript
import { invokeLLM, listLLMModels } from "./_core/llm";

const models = await listLLMModels();
const model = models.data.find(m => m.id === "nvidia/nemotron-3-ultra-550b-a55b")?.id
  ?? models.data[0]?.id;
const result = await invokeLLM({
  model,
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
  ],
  response_format: { type: "json_schema", json_schema: { ... } },  // optionnel
});
const content = result.choices[0]?.message.content;
```

---

## E-mails (SMTP Google) et templates

### SMTP

- **Nodemailer** via `server/_core/mailer.ts` (`sendMail`, `isMailConfigured`, `verifySmtp`)
- **SMTP Google** avec mot de passe d'application Gmail (pas le mot de passe du compte)
- Variables : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- En production Netlify : définies via `netlify-cli env:set`

### Templates (7 modèles préconçus)

- **Catalogue** : `shared/emailTemplates.ts` → `EMAIL_TEMPLATES` (7 entrées)
  - `invitation`, `password-reset`, `quote-sent`, `invoice-sent`, `payment-reminder`, `welcome`, `payment-confirmation`
- **Style** : Mailchimp « warm humanist » — carte sur canvas ivoire, hero dégradé vert, barre accent or, responsive <580px
- **Rendu** : `renderEmailTemplate(id, variables)` remplace les `{{variables}}`
- **Stockage** : table `emailTemplates`, amorcée automatiquement par `seedDefaultEmailTemplates()`

### Génération par l'IA

- Route tRPC `emailTemplates.generate` : appelle `invokeLLM` pour générer un modèle à partir d'une description
- L'utilisateur ajuste le résultat dans l'éditeur avant enregistrement

### Aperçu (prévisualisation)

- Les boutons des modèles sont **désactivés en aperçu** (classe CSS `.email-preview` + `href="#"`) car les liens sont des exemples factices
- Les boutons deviennent **fonctionnels dans les vrais e-mails envoyés** (liens générés par le serveur)

---

## PDF et partage de documents

### Partage invité (portail client)

- Un document peut être partagé via un **lien token** : `/d/<token>` (page `GuestDocumentPage.tsx`)
- Le token est hashé (`hashDocumentShareToken`) et stocké dans `documentShareLinks`
- Le lien expire (`expiresAt`), peut être révoqué (`revokedAt`), et compte les accès (`accessCount`)

### Téléchargement PDF

- **Route serveur** `GET /api/d/:token.pdf` (dans `server/_core/index.ts`) : génère un PDF serveur via `buildDocumentSharePdfBuffer` (`server/documentSharePdf.ts`) et le renvoie en `Content-Disposition: attachment`
- Le PDF est un **PDF texte simple** (jsPDF), pas un rendu HTML complet
- Le lien dans l'e-mail (`pdfDownloadLink`) pointe vers cette route serveur

> ⚠️ L'ancienne approche `html2canvas` côté client (fragile : CORS, polices cross-origin) a été remplacée par la génération serveur. Ne pas réintroduire `downloadPdfFromElement` pour le portail invité.

---

## PWA (installable + hors-ligne)

- **vite-plugin-pwa** activé dans `vite.config.ts` (`registerType: "autoUpdate"`)
- **Manifest** : name, short_name, icônes (192/256/384/512 + maskable)
- **Workbox** : `generateSW`, runtime caching :
  - `NetworkFirst` pour l'API
  - `CacheFirst` pour les fonts
  - `StaleWhileRevalidate` pour les assets statiques
- **Icônes** : générées par `scripts/gen-pwa-icons.mjs` (sharp)
- 92 precache entries au build

---

## UI/UX — patron « Atelier lumineux »

Le design system de l'app, établi pour une app conviviale et chaleureuse.

### Typographie

| Rôle | Police | Usage |
|---|---|---|
| Serif éditorial | Fraunces Variable (optique SOFT) | Titres, valeurs |
| Sans | Outfit Variable | Corps de texte |
| Mono | JetBrains Mono Variable | Montants, codes |
| Accent manuscrit | Caveat | Touches manuscrites |

Toutes self-host via `@fontsource-variable/*` (pas de CDN Google Fonts).

### Tokens CSS (`client/src/index.css`)

```css
--font-sans: "Outfit Variable", ui-sans-serif, system-ui, sans-serif;
--font-serif: "Fraunces Variable", ui-serif, Georgia, serif;
--font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
--font-script: "Caveat", "Fraunces Variable", cursive;
```

### Composants unifiés

- `PageHeader`, `Metric`, `EmptyState` — composants de mise en page
- `lucepress-panel` — carte avec dégradé
- `lucepress-kicker` — étiquette de section
- `font-editorial` — Fraunces avec `font-variation-settings: "SOFT" 50`

### Mode sombre

Variants `dark:bg-{couleur}-950/70`, `dark:text-{couleur}-200`, `dark:border-{couleur}-800`.

### Micro-interactions

- `lucepress-page-enter`, `stagger-rise`, `lucepress-hover-lift`
- `prefers-reduced-motion` respecté (animations désactivées)

### Accessibilité

- `focus-visible` global, skip link, `prefers-reduced-motion`

### Raccourcis clavier (Windows)

Les raccourcis utilisent `Ctrl+` (pas `⌘`) — 19 libellés dans `CommandPalette.tsx`.

---

## Tests

### Configuration

- **Vitest** (`vitest.config.ts`)
- **347 tests** au total
- Environnement : `node` (serveur), `jsdom` (composants UI)
- Exclusion : tests de persistence nécessitent `DATABASE_URL` (skip en CI sans DB)

### Lancer les tests

```bash
pnpm test          # tous les tests
npx vitest run server/documentSendByEmail.test.ts  # un fichier ciblé
```

### Convention de tests

- Tests serveur : `server/*.test.ts` (logique métier, sécurité)
- Tests UI : `client/src/tests/*.test.tsx` (rendu, intégration)
- Tests UI serveur (rendu string) : `server/*.ui.test.ts`
- **Ne pas coder de chemins absolus** dans les tests (utiliser `path.resolve(__dirname, ...)`)

---

## Déploiement Netlify (mode manuel)

> ⚠️ **Critique** : le déploiement est **manuel**. N'activez **jamais** la build automatique GitHub côté Netlify — cela économise les crédits de build.

### Préparation du déploiement

```bash
# 1. Build frontend
pnpm build:netlify   # génère dist/public/

# 2. Bundle la function serverless (ESM, tout inliné)
rm -f netlify/functions/api.js  # supprime l'ancien bundle
rm -rf .netlify                 # nettoie le cache local (sinon Netlify ne redéploie pas la function)
npx esbuild netlify/functions/api.ts \
  --platform=node --bundle --format=esm \
  --outfile=netlify/functions/api.js \
  --external:vite --external:rollup \
  --banner:js='import{createRequire}from"module";const require=createRequire(import.meta.url);'
```

### Déploiement

```bash
npx netlify-cli deploy --prod --no-build \
  --dir=dist/public \
  --functions=netlify/functions \
  --site=<SITE_ID> \
  --auth=<NETLIFY_TOKEN>
```

### Variables d'environnement Netlify

```bash
npx netlify-cli env:set --site=<SITE_ID> --auth=<TOKEN> \
  --key SMTP_HOST --value smtp.gmail.com
# (répéter pour SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
#  DATABASE_URL, JWT_SECRET, BUILT_IN_FORGE_API_KEY, etc.)
```

### ⚠️ Pièges connus du déploiement

1. **Cache de function** : Netlify CLI peut ne pas redéployer la function si le hash est identique. Solution : `rm -rf .netlify` avant de déployer, et modifier `api.ts` si nécessaire pour invalider le hash.
2. **`api.js` obsolète** : si `netlify/functions/api.js` existe localement et est obsolète, Netlify peut l'utiliser au lieu de rebundle `api.ts`. Toujours `rm -f netlify/functions/api.js` avant de régénérer.
3. **Cache CDN edge** : après déploiement, l'ancienne version peut rester servie quelques minutes. Utiliser un cache-buster (`?cb=1`) pour vérifier.
4. **Le `api.js` est dans `.gitignore`** : ne jamais le committer.

---

## CI GitHub Actions

Fichier : `.github/workflows/ci.yml`

- Déclenché sur `push` vers `main` et les PRs vers `main`
- Étapes : `pnpm install --frozen-lockfile` → `pnpm check` (typecheck) → `pnpm test` (347 tests) → `pnpm build`
- Node 22, cache pnpm

> ⚠️ Les tests de persistence (`*Persistence.test.ts`) sont **exclus en CI** si `DATABASE_URL` n'est pas défini.

---

## Convention de contribution

### Branches et PRs

- Travailler sur une branche `vibe/<slug>-4b9faa` ou `feat/<slug>`
- PR vers `main` (draft par défaut)
- Le CI doit être vert avant merge

### Style de code

- **TypeScript strict** (`pnpm check` doit passer)
- **Pas de commentaires** dans le code (convention du repo)
- **Pas de dépendances** ajoutées sans justification
- **Prettier** pour le formatage (`pnpm format`)
- Préserver le patron « Atelier lumineux » (fonts, tokens, composants)

### Commits

- Préfixe : `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Messages en français ou anglais, concis
- Ex : `feat(email): 7 modèles préconçus + amorçage auto + génération par l'IA`

### Après merge

- Synchroniser `main` : `git pull origin main`
- Reconstruire + redéployer sur Netlify (voir section déploiement)

---

## Dépannage (troubleshooting)

### `TypeError: dp is not a function` (crash production)

Cause : imports de **types** comme **valeurs** (ex: `ToastPosition` depuis `sonner`). Les types n'existent pas à l'exécution.
Solution : importer les types avec `import type { ... }`, pas `import { ... }`.

### `Aucun tenant dans le contexte de requête`

Cause : appel à `getCompanySettings()` (ou toute fonction utilisant `currentTenant()`) en dehors du contexte tenant (`AsyncLocalStorage`).
Solution : établir le tenant via `runWithTenant(tenantId, async () => { ... })` ou utiliser un payload qui l'inclut déjà.

### La function Netlify ne se met pas à jour

Voir « Pièges connus du déploiement » ci-dessus. Solution : `rm -rf .netlify` + modifier `api.ts` pour invalider le hash.

### Les e-mails ne partent pas

1. Vérifier `isMailConfigured()` (route `billing.mailStatus` → `smtpConfigured: true`)
2. Vérifier les variables SMTP sur Netlify (`netlify-cli env:list`)
3. Vérifier que le mot de passe d'application Gmail est valide (pas le mot de passe du compte)

### Tests qui échouent en CI mais passent en local

Cause probable : chemins absolus hardcodés dans les tests (ex: `/workspace/...`).
Solution : utiliser `path.resolve(__dirname, "...")` (relatif au fichier de test).

### Le PDF ne se télécharge pas (404 / Cannot GET)

1. Vérifier que la route `/api/d/:token.pdf` est bien dans le bundle déployé (`grep "api/d/" netlify/functions/api.js`)
2. Vérifier que la function a été redéployée (cache Netlify)
3. Tester avec un cache-buster : `?cb=1`

---

## Liens utiles

- **App en production** : https://lucepress-gestion.netlify.app
- **Dépôt** : https://github.com/moelohimmara-dotcom/lucepress-facturation
- **Documentation métier** : dossier `docs/`
- **Notes de conception** : dossier `notes/`
