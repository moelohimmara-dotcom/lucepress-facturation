# Contribuer à Lucepress

Ce guide décrit les conventions pour contribuer au développement de Lucepress. Les nouveaux développeurs (humains ou agents IA) doivent le lire avant leur première contribution.

> Voir aussi : [`README.md`](./README.md) pour l'architecture générale, [`AGENTS.md`](./AGENTS.md) pour les règles absolues et les pièges connus, le dossier [`docs/`](./docs/) pour le contexte métier.

---

## Table des matières

1. [Code de conduite](#code-de-conduite)
2. [Prérequis](#prérequis)
3. [Workflow de contribution](#workflow-de-contribution)
4. [Convention de branches](#convention-de-branches)
5. [Convention de commits](#convention-de-commits)
6. [Style de code](#style-de-code)
7. [Tests](#tests)
8. [Pull requests](#pull-requests)
9. [Revue de code](#revue-de-code)
10. [Déploiement après merge](#déploiement-après-merge)
11. [Signaler un bug](#signaler-un-bug)

---

## Code de conduite

- **Contexte** : Lucepress Sarl est une entreprise guinéenne de BTP/forage. Les utilisateurs (7 à 20 collaborateurs) sont **non techniciens**. La clarté prime sur la technicité.
- **Respect du travail existant** : ne pas réécrire ou refactorer du code hors-scope. Faire la **plus petite modification correcte**.
- **Pas de secrets dans git** : aucune clé API, token, mot de passe, `.env` ou identifiant ne doit être commité, poussé, loggé ou cité dans une PR.
- **Communication** : français, tutoiement, orienté action.

---

## Prérequis

- **Node.js** 20+ (22 en CI)
- **pnpm** (gestionnaire de paquets du repo)
- Une base **PostgreSQL** (Supabase recommandé) pour exécuter les tests de persistence
- Variables d'environnement locales : `cp .env.example .env` puis renseigner les valeurs

---

## Workflow de contribution

```
1. Ouvrir / prendre une issue
2. git checkout main && git pull origin main
3. git checkout -b <branche>          (vibe/<slug>-4b9faa ou feat/<slug>)
4. Coder (tests inclus)              pnpm dev
5. Vérifier                          pnpm check && pnpm test && pnpm build
6. Commit + push                     git commit / git push -u origin <branche>
7. Ouvrir une PR draft               gh pr create --draft ...
8. CI vert → demander la revue
9. Merge par le propriétaire          (jamais d'auto-merge)
10. Synchroniser + redéployer         git pull origin main + déploiement Netlify
```

---

## Convention de branches

- **Préfixes** : `vibe/`, `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`
- **Slug descriptif** en kebab-case, terminé par le suffixe `-4b9faa` pour les branches générées par agent IA
- **Format** : `<prefixe>/<slug>-4b9faa`
- **Exemples** :
  - `vibe/templates-emails-preconcus-ia-4b9faa`
  - `feat/relance-automatique`
  - `fix/pdf-tenant-context`
- **Base** : toutes les PR ciblent `main`

---

## Convention de commits

- **Type** : `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `perf`, `ci`
- **Scope optionnel** entre parenthèses : `feat(email):`, `fix(pdf):`, `docs(readme):`
- **Message concis** à l'infinitif ou au passé, français ou anglais
- **Pas de point final** au message court
- **Body optionnel** après une ligne vide, expliquant le « pourquoi » (pas le « comment »)

### Exemples

```
feat(email): 7 modèles préconçus + amorçage auto + génération par l'IA
fix(pdf): utiliser payload.company au lieu de getCompanySettings()
docs: documentation complète du projet (README, AGENTS, CONTRIBUTING, .env.example)
chore(deps): mettre à jour @fontsource-variable/fraunces
```

### À éviter

- Commits trop larges (`update stuff`)
- Plusieurs préoccupations dans un commit (séparer en plusieurs commits)
- Référence à un secret ou à une valeur d'env dans le message

---

## Style de code

### TypeScript

- **Strict** : `pnpm check` (`tsc --noEmit`) doit passer sans erreur
- **Imports de types avec `import type`** — sinon crash runtime `dp is not a function` (les types n'existent pas à l'exécution, le bundler les retire)
  ```typescript
  import type { ToastPosition } from "sonner";   // BON
  import { ToastPosition } from "sonner";        // CRASH
  ```
- **Pas de `any`** sans justification ; préférer des types précis
- **ESM** : le repo est `"type": "module"` dans `package.json`

### Commentaires

- **Convention du repo : aucun commentaire dans le code** (ni standalone, ni inline). Le code doit s'expliquer par ses noms et sa structure.
- Les commentaires sont autorisés uniquement dans le code généré automatiquement ou si une directive repo l'expose.

### Formatage (Prettier)

Le repo a une config Prettier (`.prettierrc`) :

| Option | Valeur |
|---|---|
| `printWidth` | 80 |
| `tabWidth` | 2 |
| `useTabs` | false |
| `semi` | true |
| `singleQuote` | false |
| `trailingComma` | `es5` |
| `arrowParens` | `avoid` |
| `endOfLine` | `lf` |

```bash
pnpm format   # formate tout
```

### Dépendances

- **Ne pas ajouter de dépendances** sans justification. Le repo utilise déjà ce dont il a besoin.
- Privilégier les fonctionnalités de la stack existante (React, tRPC, Drizzle, Radix UI, Tailwind).

### Design — patron « Atelier lumineux »

Toute contribution UI doit préserver le patron établi :

- **Fonts** : Fraunces Variable (serif), Outfit Variable (sans), JetBrains Mono Variable (mono), Caveat (accent) — self-host via `@fontsource-variable/*`
- **Tokens** : définis dans `client/src/index.css` (`--font-sans`, `--font-serif`, `--font-mono`, `--font-script`)
- **Composants unifiés** : `PageHeader`, `Metric`, `EmptyState`, `lucepress-panel`, `lucepress-kicker`, `font-editorial`
- **Mode sombre** : variants `dark:bg-{couleur}-950/70`, `dark:text-{couleur}-200`, `dark:border-{couleur}-800`
- **Micro-interactions** : `lucepress-page-enter`, `stagger-rise`, `lucepress-hover-lift` (respecter `prefers-reduced-motion`)
- **Raccourcis** : `Ctrl+` (Windows), jamais `⌘`

---

## Tests

### Lancer les tests

```bash
pnpm test                       # tous (347 tests)
pnpm check                      # typecheck
pnpm build                      # build complet
npx vitest run <fichier>        # un fichier ciblé
```

### Où ajouter des tests

| Type de test | Emplacement |
|---|---|
| Logique serveur / sécurité | `server/*.test.ts` |
| Rendu UI client | `client/src/tests/*.test.tsx` |
| Rendu string (page serveur) | `server/*.ui.test.ts` |
| Sécurité / permissions | `server/*Security.test.ts`, `server/*Safety.test.ts` |

### Convention de tests

- **Pas de chemins absolus** (`/workspace/...`) — utiliser `path.resolve(__dirname, ...)` (relatif au fichier de test)
- Les tests de persistence (`*Persistence.test.ts`) nécessitent `DATABASE_URL` ; ils sont **exclus en CI sans DB**
- Préférer des tests ciblés et lisibles à des snapshots fragiles
- Couvrir la logique métier (calculs GNF, générations de token, filtrage tenant) et la sécurité (permissions, anti-fuite inter-tenant)

### Vérifications obligatoires avant commit

```bash
pnpm check && pnpm test && pnpm build
```

Le CI (`.github/workflows/ci.yml`) exécute les mêmes vérifications ; un échec local signifie un échec CI.

---

## Pull requests

### Ouvrir une PR

```bash
gh pr create --repo moelohimmara-dotcom/lucepress-facturation \
  --draft --head <branche> --base main \
  --body-file /tmp/pr-body.md
```

### Modèle de body de PR

```markdown
## Summary
- Concise bullets décrivant le changement (quoi + pourquoi)

## Verification
- Commands or checks run (ex : `pnpm check && pnpm test`, build réussi)

Closes <issue-id>
```

- **`Closes <issue-id>`** uniquement si la PR résout une issue tracée (GitHub `#<num>` ou Linear `<KEY>-<num>`). Sinon, **omettre** la ligne — ne pas inventer d'identifiant.
- **Draft par défaut** ; passer en « ready for review » une fois le CI vert et la PR relue.

### Critères d'acceptation

- [ ] CI vert (`pnpm check` + `pnpm test` + `pnpm build`)
- [ ] Tests ajoutés/modifiés pour la nouvelle logique
- [ ] Pas de secrets, pas de `.env`, pas de valeurs d'environnement
- [ ] Pas de commentaires dans le code (sauf directive contraire)
- [ ] Pas de dépendances non justifiées
- [ ] Scope minimal : pas de refactor hors-sujet
- [ ] Patron « Atelier lumineux » préservé pour l'UI
- [ ] Filtrage par tenant respecté pour toute nouvelle requête DB
- [ ] `.env.example` mis à jour si une nouvelle variable est introduite

---

## Revue de code

- **Focus sur la justesse** : la cause racine d'un bug est-elle traitée, ou seulement le symptôme ?
- **Sécurité tenant** : toute nouvelle requête DB filtre-t-elle par `currentTenant()` ou `peekTenant()` ?
- **Types** : les imports de types utilisent-ils `import type` ?
- **Scope** : la PR ne touche-t-elle que ce qui est nécessaire ?
- **Tests** : les tests couvrent-ils le nouveau comportement ?
- **Conventions** : pas de commentaires, pas de dépendances superflues, patron UI préservé

Le merge est effectué par le propriétaire du projet (l'utilisateur). **Pas d'auto-merge.**

---

## Déploiement après merge

Le déploiement est **manuel sur Netlify** (pas de build automatique GitHub). Voir [`README.md` > Déploiement Netlify](./README.md#déploiement-netlify-mode-manuel) pour le détail.

Résumé :

```bash
git checkout main && git pull origin main
pnpm build:netlify
rm -f netlify/functions/api.js && rm -rf .netlify
npx esbuild netlify/functions/api.ts --platform=node --bundle --format=esm \
  --outfile=netlify/functions/api.js --external:vite --external:rollup \
  --banner:js='import{createRequire}from"module";const require=createRequire(import.meta.url);'
npx netlify-cli deploy --prod --no-build --dir=dist/public \
  --functions=netlify/functions --site=<SITE_ID> --auth=<NETLIFY_TOKEN>
```

> ⚠️ Les secrets (`SITE_ID`, `NETLIFY_TOKEN`, clés API) sont fournis par le propriétaire du projet et ne sont jamais dans le repo.

---

## Signaler un bug

Ouvrir une issue GitHub sur `moelohimmara-dotcom/lucepress-facturation` avec :

1. **Titre** clair et concis
2. **Reproduction** : étapes précises pour reproduire
3. **Comportement attendu** vs **comportement observé**
4. **Environnement** : navigateur, OS (Windows attendu), URL de l'app
5. **Capture d'écran / message d'erreur** si applicable
6. **Impact** sur l'utilisateur (mineur / bloquant)

Pour les crashs production, inclure le message d'erreur complet (ex : `TypeError: dp is not a function`) — il permet d'identifier la cause racine (voir `README.md` > Dépannage).
