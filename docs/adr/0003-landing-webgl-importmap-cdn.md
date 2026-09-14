# ADR-0003 — Landing publique immersive WebGL (Three.js r0.143 via importmap CDN)

| Champ | Valeur |
| --- | --- |
| Statut | accepted |
| Date | 2026-09-14 |
| PR | [#36](https://github.com/moelohimmara-dotcom/lucepress-facturation/pull/36) |

## Contexte

La landing publique (`client/src/components/LandingPage.tsx`, affichée aux visiteurs non authentifiés par `DashboardLayout`) était une page statique au design « Atelier lumineux » (clair, mockup produit simple). On souhaite une vitrine immersive haut de gamme inspirée du concept Ascend : planète Terre 3D WebGL temps réel en arrière-plan fixe, sections glassmorphism, défilement fluide, chorégraphie au scroll.

Contraintes :
- Aucune nouvelle dépendance npm (règle du repo).
- Le reste de l'app (dashboard authentifié) garde le design system « Atelier lumineux » intact.
- Three.js r0.143 requis (le shader injection exploite les chunk names et l'API `WebGL1Renderer` / `outputEncoding` / `sRGBEncoding` / `VSMShadowMap` de cette version ; montée de version = casse).

## Décision

1. **Three.js via importmap CDN, non bundlé** : un `<script type="importmap">` dans `client/index.html` mappe `three` et `three/examples/jsm/` vers `unpkg.com/three@0.143.0`. La scène (`client/src/lib/ascendPlanet.ts`) importe dynamiquement ces bare specifiers résolus au runtime par le navigateur — jamais bundlés. Aucune dépendance npm ajoutée.
2. **Vite externalise `three` + `https://`** : `rollupOptions.external = [/^three(\/.*)?$/, /^https:\/\//]` pour que le bundle de production conserve les bare specifiers au lieu d'essayer de résoudre `three`.
3. **CSS scoped** : la landing utilise ses propres tokens (`.ascend-landing`, palette deep-space + mint) dans `ascend-landing.css`, séparés du design system Tailwind/« Atelier lumineux » de l'app. La landing est une vitrine distincte.
4. **Scène portée verbatim** depuis le prompt Ascend (`ascendPlanet.ts`) : 3 composers, FinalPass + corner-flame, atmosphère, 3 couches nuages, étoiles, motes, marqueurs radar, injection `onBeforeCompile`, storytelling scroll, entrée float-up.
5. **Accessibilité** : `prefers-reduced-motion` désactive Lenis, l'entrée float-up et les animations bar/fill (la landing reste lisible). Le canvas est `pointer-events:none` (n'intercepte ni scroll ni pointer).

## Conséquences

- **Assets distants** : la planète dépend d'un bucket public tiers (`api.getlayers.ai/.../ascend-d9857ad1f2/`). À héberger sur le stockage Lucepress pour l'indépendance (point à prévoir).
- **Three.js gelé sur r0.143** : toute montée de version casse le chunk-injection.
- **Poids landing** : ~5 MB d'assets 3D chargés uniquement pour les visiteurs non authentifiés.
- **Typecheck** : déclarations d'ambiance (`client/src/types/three-cdn.d.ts`) pour les bare specifiers CDN.
- **Tests** : mock de `@/lib/ascendPlanet` dans `server/sidebarLayout.ui.test.ts` (la scène n'a pas de rôle en test de layout).

## Alternatives envisagées

- **Installer `three` en npm** : rejeté (règle « pas de dépendance non justifiée », et l'on voulait préserver l'importmap verbatim d'Ascend).
- **Bundler three dans le build** : rejeté (poids, et le chunk-injection est fragile au tree-shaking de Rollup).
- **Refonte sous le design system existant** : rejeté — la landing est volontairement une vitrine immersive distincte du dashboard.

## Voir aussi

- [Landing immersive WebGL — doc détaillée](../landing-immersive-webgl.md)
- [Points à prévoir](../POST-MERGE-A-PREVOIR.md)
