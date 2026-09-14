# Points à prévoir — Landing immersive WebGL

Suite au merge de la PR [#36](https://github.com/moelohimmara-dotcom/lucepress-facturation/pull/36) et au déploiement Netlify prod. Liste des actions de suivi, risques et améliorations à prévoir. Priorité indicative : 🔴 court terme / 🟡 moyen terme / 🟢 long terme / optionnel.

---

## 🔴 Court terme

### 1. Révoquer / réinitialiser le jeton Netlify
Le token d'accès Netlify (`nfp_…`) a été fourni en clair pour le déploiement. Par sécurité, le **révoquer ou réinitialiser** depuis le dashboard Netlify (User settings → Access tokens) et en générer un nouveau. Ne jamais le committer ni le laisser en clair dans un canal non sécurisé.

### 2. Vérifier la prod (cache edge)
Le cache CDN edge peut servir l'ancienne version quelques minutes. À vérifier avec cache-buster :
- Santé backend : `https://lucepress-gestion.netlify.app/api/health?cb=1` → `{"ok":true,"db":"up"}`
- Landing publique : ouvrir `https://lucepress-gestion.netlify.app/?cb=1` **non connecté** → planète WebGL immersive + sections glassmorphism + accent mint.
- Si l'ancienne landing persiste : vider le cache Netlify (dashboard → Deploys → Trigger deploy), ou patienter ~5–10 min.

### 3. Tester sur devices cibles
La scène WebGL est lourde. À valider sur :
- Mobiles bas de gamme Android (WebGL1 + ~5 MB assets) — vérifier le FPS et le scroll Lenis.
- Navigateurs sans WebGL / WebGL désactivé — prévoir un message ou un fallback statique (actuellement le canvas reste noir, la landing reste lisible mais sans globe).
- iOS Safari (importmap + WebGL1) — confirmer le rendu.

### 4. PWA / service worker
Le service worker precache l'`index.html` (qui contient l'importmap). Après ce changement de shell, forcer une mise à jour : le SW `autoUpdate` + `skipWaiting` doit se recharger automatiquement, mais vérifier qu'un utilisateur réexistant la landing ne reste pas sur l'ancien `index.html` sans importmap. En cas de doute, incrémenter le cache ou faire un hard reload.

---

## 🟡 Moyen terme

### 5. Indépendance des assets 3D
La planète charge depuis le bucket public Ascend (`api.getlayers.ai/storage/v1/.../ascend-d9857ad1f2/`), tiers hors contrôle Lucepress. À prévoir :
- **Option A** : héberger `planet.glb`, `planet-lights.glb`, `planet-clouds.png` sur le propre stockage Lucepress (Supabase Storage ou CDN Netlify) et mettre à jour `ASSET_BASE` dans `ascendPlanet.ts`.
- **Option B** : versionner les assets dans `client/public/assets/` (~5 MB, impact sur le repo) et servir en relatif.
- Ajouter un fallback si le chargement GLTF échoue (message discret « Chargement de la planète… » ou fond deep-space sans globe), plutôt qu'un canvas noir muet.

### 6. Lighthouse / performance
- Lighthouse sur la landing publique : la scène WebGL 3D pèse sur LCP / TBT. Vérifier le score mobile.
- Optimisations possibles : `requestIdleCallback` pour différer le démarrage de la scène, réduire `starCount`/`atmoCount` sur mobile (`CONFIG` déjà dimensionné mais réévaluable), lazy-load de `ascendPlanet.ts` uniquement sur la landing (déjà fait via import dynamique dans le composant).
- Précharger les assets GLTF (`<link rel="preload">`) ou les différer après first paint.

### 7. Hygiène CDN
- Three.js r0.143 via `unpkg.com` : si unpkg a une indisponibilité, la scène ne se charge pas. Envisager un miroir (jsdelivr) ou un fallback d'URL dans l'importmap (l'importmap supporte un tableau de fallbacks par spec, mais la prise en charge navigateur varie).
- Lenis via `unpkg.com` idem ; le `.catch(() => {})` en place fait que le scroll reste fonctionnel (natif) si Lenis ne charge pas.

### 8. Respect du design system sur la landing
La landing utilise ses propres tokens (`.ascend-landing`, palette deep-space + mint) séparés du design system « Atelier lumineux » de l'app. C'est intentionnel (landing = vitrine immersive distincte), mais vérifier la cohérence de marque : le logo ▲ Lucepres et le wording restent alignés. Si l'on veut réutiliser l'accent Lucepress (vert `oklch(0.3 0.079 166)`) au lieu du mint `#5df0a8`, définir `--accent`/`--accent-2` depuis les tokens existants.

---

## 🟢 Long terme / optionnel

### 9. Interactivité planète
- Marqueurs radar dorés → actuellement décoratifs. À prévoir : les lier à des chantiers réels (ex. positions des chantiers Lucepress en Guinée), au survol afficher le nom du chantier.
- Contrôle OrbitControls est `enabled=false` (la planète ne capture pas le pointer). À prévoir : activer une interaction limitée (drag pour tourner) sur desktop uniquement, sans casser le scroll.

### 10. Données réelles dans le dashboard mockup
Le dashboard de la landing (Trésorerie · Q3, bars, rows) est statique et fictif. À prévoir : afficher des agrégats réels anonymisés (ex. « X devis ce mois ») via une procédure tRPC publique en lecture seule — attention à ne jamais exposer de données client. Sinon garder fictif avec mention « Illustration ».

### 11. Localisation / SEO
- La landing est en français (`<html lang="fr">` déjà correct). Ajouter des balises SEO/meta (description, OG image) dans `client/index.html` pour le partage.
- Prévoir un sitemap et robots.txt adaptés à la landing publique.

### 12. Tests e2e Playwright
- Ajouter un test e2e qui ouvre la landing non authentifiée et vérifie la présence du `<canvas class="planet-canvas">` et des sections `#features` / `#solutions` / `#cta`. Le test doit tolérer l'absence de WebGL en CI (assertion sur le DOM, pas sur le rendu canvas).

---

## Suivi déploiement Netlify (rappel)

Le déploiement est **manuel** (build auto GitHub désactivé pour économiser les crédits). Après chaque merge sur `main` :

```bash
git checkout main && git pull origin main
pnpm build:netlify
rm -f netlify/functions/api.js && rm -rf .netlify
npx esbuild netlify/functions/api.ts \
  --platform=node --bundle --format=esm \
  --outfile=netlify/functions/api.js \
  --external:vite --external:rollup \
  --banner:js='import{createRequire}from"module";const require=createRequire(import.meta.url);'
npx netlify-cli deploy --prod --no-build \
  --dir=dist/public --functions=netlify/functions \
  --site=$NETLIFY_SITE_ID --auth=$NETLIFY_AUTH_TOKEN
```

Puis vérifier en prod avec cache-buster. Voir aussi `AGENTS.md` > Déploiement.
