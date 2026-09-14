# Landing publique immersive WebGL (concept Ascend)

Refonte complète de la page publique du site Lucepress, inspirée du concept Ascend (getlayers.ai) : une planète WebGL immersive en arrière-plan fixe, quatre sections glassmorphism, défilement fluide et chorégraphie au scroll.

- **PR** : [#36 — feat(landing): refonte immersive WebGL de la page publique (concept Ascend)](https://github.com/moelohimmara-dotcom/lucepress-facturation/pull/36)
- **Merge** : `b783144` sur `main`
- **Déploiement** : Netlify prod `https://lucepress-gestion.netlify.app`

---

## Objectif

Remplacer l'ancienne landing statique (mockup produit simple, design « Atelier lumineux » clair) par une landing immersive haut de gamme qui flotte au-dessus d'une planète Terre 3D temps réel, tout en restant fidèle au concept métier Lucepress (devis / factures / IA / GNF / Guinée / BTP, français, tutoiement).

---

## Fichiers

| Rôle | Fichier |
| --- | --- |
| Scène WebGL (verbatim Ascend) | `client/src/lib/ascendPlanet.ts` |
| Composant React landing | `client/src/components/LandingPage.tsx` |
| CSS scoped (tokens deep-space + mint) | `client/src/components/ascend-landing.css` |
| Importmap Three.js r0.143 + Google Fonts Inter | `client/index.html` |
| Déclarations d'ambiance (bare specifiers CDN) | `client/src/types/three-cdn.d.ts` |
| Externalisation `three` + `https://` au build | `vite.config.ts` |

`LandingPage.tsx` est le composant affiché aux visiteurs non authentifiés par `DashboardLayout` (`if (!user) return <LandingPage />`). Authentifié, l'utilisateur reste sur le tableau de bord habituel (design « Atelier lumineux » inchangé).

---

## Scène WebGL — `ascendPlanet.ts`

La scène est portée **verbatim** depuis le prompt Ascend, sans dépendance npm ajoutée. Three.js r0.143 est chargé en runtime depuis CDN via un importmap dans `index.html` :

```html
<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.143.0/build/three.module.js",
  "three/examples/jsm/": "https://unpkg.com/three@0.143.0/examples/jsm/"
}}
</script>
```

Le module `ascendPlanet.ts` importe dynamiquement `three` et les modules `three/examples/jsm/*` (EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, GammaCorrectionShader, CopyShader, GLTFLoader, DRACOLoader, OrbitControls). En développement comme en production, ces imports restent des bare specifiers résolus par l'importmap navigateur — ils ne sont jamais bundlés.

### Composants de la scène

- **Planète** : GLTF DRACO-compressé (`planet.glb`) + texture nuits-villes (`planet-lights.glb`) + texture nuages (`planet-clouds.png`), chargés depuis le bucket public Ascend. Injection `onBeforeCompile` du shader planète : rim, océan (glint, flow, deep), relief par dérivées de fragments (`dFdx/dFdy`), lumières de nuit, day/night, biseautage de relief.
- **Atmosphère** : halo additif billboard (PlaneGeometry + ShaderMaterial, `glowMesh.quaternion.copy(camera.quaternion)`).
- **Nuages** : 3 couches (SphereGeometry, RepeatWrapping ×5), injection `onBeforeCompile` (snoise, edge, day/night).
- **Motes** : 320 points ambiance (warp 3d, near/far fade).
- **Starfield** : 1400 points sur sphère r=90, flicker par seed.
- **Marqueurs** : 60 pings radar dorés posés sur la terre (sampling area-weighted, rejet océan par lecture pixel de la texture base).
- **Composite final** : 3 composers (torus/bloom/final), FinalPass = bg + corner-flame (warp3d) + bloom + torus + tDiffuse + halo.

### CONFIG (bake-in)

Tous les paramètres sont des constantes dans `ascendPlanet.ts` (CONFIG), conformes au prompt : radius 1.95, tilt 0.37, initRotation 2.07, spin 0.03, bloom torus (0.22, 0.2, 0), bloom (0.5, 0.6, 0), flame 0.15, glow `#3a6cff` 3.35, étoiles 1400 @ 1.6, motes 320 @ 22, marqueurs 60 @ 16 (`#ffd27a`). Renderer `WebGL1Renderer`, `outputEncoding = sRGBEncoding`, `shadowMap.type = VSMShadowMap`.

### Storytelling scroll

Le globe entre immense et bas, puis zoome out et balance gauche → droite avant de se stabiliser près du CTA final, tout en tournant :

```js
STOPS_X = [{0,0},{0.32,-3.1},{0.64,3.2},{1,0}]
STOPS_Y = [{0,-4.5},{0.32,0.55},{0.64,0.45},{1,0.15}]
STOPS_S = [{0,2.15},{0.32,1.0},{0.64,0.92},{1,1.12}]
```

Damping per-frame (`dt*4.5` sur `curP`, `dt*3.2` sur `curX/curY/curS`), `sideScale = clamp(innerWidth/1200, 0.5, 1)` réduit le déplacement latéral sur écran étroit. Entrée float-up une seule fois (`ENTRY_DUR=1.9`, `ENTRY_START_Y=-6.5`, eased `1-(1-t)^3`) quand le GLTF est chargé. Rotation planète : `initRotation + spinPhase + curP*PI*1.6`.

### Accessibilité — `prefers-reduced-motion`

Sous motion réduite : révélations immédiates, pas de Lenis, pas d'entrée float-up, animations bar/fill désactivées (les barres restent visibles, les fills à leur largeur finale). Détecté via `window.matchMedia("(prefers-reduced-motion: reduce)")`.

---

## Landing React — `LandingPage.tsx`

Quatre sections glassmorphism flottant sur la planète :

1. **Hero** — nav (▲ Lucepres + liens + « Se connecter »), titre « Du premier devis au *paiement* encaissé » (le mot `paiement` en gradient mint), sous-titre bénéfice, deux CTA, logos clients.
2. **Fonctions** — 6 cards (devis 5 étapes IA, pilotage en direct, portail client, relances, sécurité entreprise, pensé pour la Guinée), icônes SVG inline (24×24, stroke 1.6, arrow stroke 2).
3. **Showcase + stats** — copie + dashboard mockup (Trésorerie · Q3, bars 62/88/47/95/71/80/58%, rows 90/72/48/34%, gradient-border), 4 stats (3.4×, 92%, −63%, GNF).
4. **CTA + footer** — carte CTA, footer (brand + coordonnées Lucepress + 3 colonnes), copyright année dynamique.

Révélations échelonnées via `IntersectionObserver` (threshold 0.18, rootMargin `-8%`), délais par `--rd` (hero 60/180/300/420ms, etc.). Lenis smooth scroll (`duration 1.15`, `smoothWheel`, `touchMultiplier 1.5`) chargé depuis CDN, skip sous reduced-motion. Le `<canvas class="planet-canvas">` est `position:fixed; pointer-events:none` (n'intercepte ni scroll ni pointer).

### Intégration Vite

`vite.config.ts` externalise `three` et `https://` :

```js
rollupOptions: { external: [/^three(\/.*)?$/, /^https:\/\//], output: { ... } }
```

Le bundle de production conserve les bare specifiers `import("three")` / `import("three/examples/jsm/...")` et l'import CDN Lenis, résolus au runtime par l'importmap. Aucune nouvelle dépendance npm n'est ajoutée (règle du repo respectée).

---

## Tests & vérification

- `pnpm check` ✅ (typecheck, `tsconfig` strict)
- `pnpm test` ✅ 377 tests / 123 fichiers
- `pnpm build:netlify` ✅ (importmap + scène three externalisés présents dans le bundle)
- `server/landingPage.ui.test.ts` : valide le contenu source de la nouvelle landing (hero bénéfice, réassurance Guinée/GNF/IA, dashboard mockup, fonctions différenciantes, stats, scène WebGL, coordonnées de contact, sections accessibles `aria-labelledby`).
- `server/sidebarLayout.ui.test.ts` : mock de `@/lib/ascendPlanet` (la scène WebGL n'a aucun rôle dans un test de layout sidebar).

---

## Limites connues

- **Assets distants** : la planète dépend du bucket public Ascend (`api.getlayers.ai/storage/v1/.../ascend-d9857ad1f2/`). Si ce bucket change ou devient indisponible, la planète ne se charge pas (la landing reste lisible : sections glassmorphism + fond deep-space, mais sans globe). Voir [Points à prévoir](./POST-MERGE-A-PREVOIR.md).
- **WebGL1** : le shader exploite `dFdx/dFdy` et l'API `WebGL1Renderer` de three r0.143. Toute montée de version de three casserait le chunk-injection (à geler sur r0.143).
- **Poids** : la scène charge ~5 MB d'assets 3D au premier affichage de la landing (uniquement pour visiteurs non authentifiés).
