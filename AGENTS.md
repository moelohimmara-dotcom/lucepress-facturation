# AGENTS.md — Directives pour les agents IA et développeurs

Ce fichier guide les agents IA (Vibe, Copilot, etc.) et les développeurs qui reprennent le développement de Lucepress. **Lisez-le entièrement avant toute modification.**

> Voir aussi : [`README.md`](./README.md) pour l'architecture générale, [`CONTRIBUTING.md`](./CONTRIBUTING.md) pour les conventions, [`docs/`](./docs/) pour le métier.

---

## Contexte métier

- **Entreprise** : Lucepress Sarl — BTP, forage et services durables (Conakry, Guinée)
- **Utilisateurs** : 7 à 20 collaborateurs (staff commercial), non techniciens
- **Devise** : GNF (Franc guinéen), formatage `fr-GN`
- **Langue UI** : Français
- **Ton rédactionnel** : Tutoiement chaleureux, phrases courtes orientées action

---

## Règles absolues

### Ne jamais

1. ❌ **Committer des secrets** (clés API, mots de passe, tokens, `.env`). Jamais dans git, jamais dans les logs, jamais dans les PRs.
2. ❌ **Activer la build automatique GitHub sur Netlify** — tout est en mode manuel pour économiser les crédits.
3. ❌ **Committer `netlify/functions/api.js`** — il est dans `.gitignore`, c'est un bundle généré.
4. ❌ **Réintroduire `downloadPdfFromElement` / `html2canvas`** pour le portail invité — utiliser la route serveur `/api/d/:token.pdf`.
5. ❌ **Ajouter des commentaires dans le code** — convention du repo, aucun commentaire.
6. ❌ **Ajouter des dépendances** sans justification (le repo utilise déjà ce qu'il faut).
7. ❌ **Coder des chemins absolus dans les tests** (`/workspace/...`) — utiliser `path.resolve(__dirname, ...)`.

### Toujours

1. ✅ **Lancer `pnpm check` (typecheck) + `pnpm test` (347 tests)** avant de committer.
2. ✅ **Vérifier le CI vert** avant de demander un merge.
3. ✅ **Préserver le patron « Atelier lumineux »** (Fraunces + Outfit + JetBrains Mono + Caveat, tokens CSS dans `index.css`).
4. ✅ **Filtrer par tenant** dans toute requête DB (`currentTenant()` ou `peekTenant()`).
5. ✅ **Importer les types avec `import type`** (sinon crash runtime `dp is not a function`).
6. ✅ **Mettre à jour cette doc** si l'architecture change significativement.

---

## Workflow de développement

### 1. Avant de modifier

```bash
git checkout main && git pull origin main
git checkout -b vibe/<slug>-4b9faa   # ou feat/<slug>
```

Lisez les fichiers que vous modifiez et les patterns voisins. Pour les bugs, inspectez la cause concrète d'abord.

### 2. Pendant le dev

```bash
pnpm dev      # serveur dev
pnpm test     # tests après chaque unité de travail
pnpm check    # typecheck avant commit
```

### 3. Commit et PR

```bash
git add -A
git commit -m "feat(scope): description concise"
git push -u origin <branche>
gh pr create --repo moelohimmara-dotcom/lucepress-facturation --draft --head <branche> --base main --body-file /tmp/pr-body.md
```

Le CI doit être vert. Le merge se fait par l'utilisateur (jamais auto-merge).

### 4. Après merge → redéployer

```bash
git checkout main && git pull origin main
pnpm build:netlify
# (voir README.md > Déploiement Netlify pour le bundle function + déploiement)
```

---

## Pièges connus (à éviter)

### `TypeError: dp is not a function`

Imports de types comme valeurs. Les types n'existent pas à l'exécution (le bundler les retire).
```typescript
// ❌ MAUVAIS — crash runtime
import { ToastPosition } from "sonner";
// ✅ BON
import type { ToastPosition } from "sonner";
```

### `Aucun tenant dans le contexte de requête`

Appel à `getCompanySettings()` ou `currentTenant()` hors contexte tenant.
```typescript
// ❌ MAUVAIS — lève en route Express brute
const company = await getCompanySettings();
// ✅ BON — établir le contexte
await runWithTenant(tenantId, async () => {
  const company = await getCompanySettings();
});
// ✅ BON — utiliser un payload qui l'inclut déjà
const company = payload.company;  // depuis getGuestDocumentByShareToken
```

### La function Netlify ne se met pas à jour

Cache de hash. Solution : `rm -rf .netlify` + modifier `api.ts` pour invalider le hash + `rm -f netlify/functions/api.js` avant régénération.

### Cache CDN edge après déploiement

L'ancienne version reste servie quelques minutes. Vérifier avec `?cb=<nombre>`.

---

## Architecture — où chercher

| Besoin | Fichier(s) |
|---|---|
| Ajouter une route tRPC | `server/routers.ts` (appRouter) |
| Ajouter une route Express brute | `server/_core/index.ts` (createApp) |
| Accès données / nouvelle fonction DB | `server/db.ts` |
| Schéma DB / nouvelle table | `drizzle/schema.pg.ts` |
| Nouveau modèle d'e-mail | `shared/emailTemplates.ts` (EMAIL_TEMPLATES) |
| Nouvelle page frontend | `client/src/pages/` + route dans `client/src/App.tsx` |
| Nouveau composant UI | `client/src/components/ui/` (Radix-based) |
| Tokens design / CSS | `client/src/index.css` |
| Appel IA (LLM) | `server/_core/llm.ts` (invokeLLM) |
| Envoi e-mail (SMTP) | `server/_core/mailer.ts` (sendMail) |
| Contexte utilisateur (auth) | `server/_core/context.ts` (createContext) |
| Contexte tenant | `server/_core/tenantContext.ts` (runWithTenant / currentTenant) |
| PDF serveur | `server/documentSharePdf.ts` (buildDocumentSharePdfBuffer) |
| Function serverless | `netlify/functions/api.ts` |
| Config build frontend | `vite.config.ts` (VitePWA) |

---

## Convention de rédaction des PRs

Le body de PR doit contenir :

```markdown
## Summary
- Concise bullets décrivant le changement

## Verification
- Commands or checks run

Closes <issue-id>  # si résout une issue
```

Pour une PR qui ne résout pas d'issue, **omettre** la ligne `Closes`.

---

## Tests — où ajouter

- **Logique serveur** : `server/*.test.ts`
- **Rendu UI client** : `client/src/tests/*.test.tsx`
- **Rendu string (page serveur)** : `server/*.ui.test.ts`
- **Sécurité / permissions** : `server/*Security.test.ts`, `server/*Safety.test.ts`

Toujours : pas de chemins absolus, utiliser `path.resolve(__dirname, ...)`.

---

## Déploiement — checklist complète

```bash
# 1. Synchroniser main
git checkout main && git pull origin main

# 2. Build frontend
pnpm build:netlify

# 3. Régénérer le bundle function (CRITIQUE)
rm -f netlify/functions/api.js
rm -rf .netlify
npx esbuild netlify/functions/api.ts \
  --platform=node --bundle --format=esm \
  --outfile=netlify/functions/api.js \
  --external:vite --external:rollup \
  --banner:js='import{createRequire}from"module";const require=createRequire(import.meta.url);'

# 4. Vérifier que le bundle contient les changements
grep -c "<pattern-attendu>" netlify/functions/api.js

# 5. Déployer
npx netlify-cli deploy --prod --no-build \
  --dir=dist/public \
  --functions=netlify/functions \
  --site=<SITE_ID> \
  --auth=<NETLIFY_TOKEN>

# 6. Vérifier en prod (avec cache-buster)
#    - /api/health?cb=1  → {"ok":true,"db":"up"}
#    - /api/d/<token>.pdf?cb=1  → réaction attendue
```

> ⚠️ Les secrets (`SITE_ID`, `NETLIFY_TOKEN`, clés API) ne sont jamais dans le repo. Ils sont fournis par le propriétaire du projet.

---

## Quand vous êtes bloqué

1. Lisez `README.md` > Dépannage
2. Inspectez les commits récents (`git log --oneline -10`) pour comprendre les derniers changements
3. Cherchez dans `docs/` pour le contexte métier
4. Vérifiez que le CI passe sur `main` (`gh run list --branch main`)
5. Si une route ne répond pas en prod, vérifiez que le bundle function la contient (`grep`)
