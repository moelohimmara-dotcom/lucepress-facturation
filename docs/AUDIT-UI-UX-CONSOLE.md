# Audit UI/UX critique — Console d'exploitation « Lucepress Facturation »

> Audit de lecture seule. **Aucun code n'a été modifié**, rien n'a été committé, poussé ni déployé.
> Branche `main`, arbre propre au début et à la fin de l'audit.

- **Date** : 2026-09-17
- **Périmètre** : coquille + rail, `/console` (tableau de bord), `/console/sante`, `/console/acces`, `/console/sessions`, `/console/permissions`, `/console/metier`, `/console/donnees`, la MFA, la page de connexion.
- **Grille** : accessibilité (contraste, focus, clavier, libellés, rôles/aria, titres de document, reduced-motion) · toucher · états · typographie & couleur · formulaires & confirmations · responsive · navigation.

---

## 1. Méthode

1. Lecture intégrale des écrans de la console et de leurs dépendances directes (coquille `DashboardLayout`, primitives `ui/button`, `ui/dialog`, `ui/checkbox`, `ui/sidebar`, `Metric`, `PageHeader`, `AuthShell`), puis des jetons dans `client/src/index.css`.
2. **Vérification numérique**, et non à l'œil, des rapports de contraste : conversion `oklch → sRGB` puis calcul du rapport WCAG (luminance relative), avec composition alpha pour les couleurs semi-transparentes (`text-muted-foreground/80`, `/50`, `text-foreground/70`, `sidebar-foreground/55`). Surfaces de référence mesurées : panneau `#fcfaf4`, fond `#faf7ef`, carte `#fefdf9`, `bg-muted` `#f1ede4`.
3. Comptage **exhaustif** des tailles de police inférieures à 12 px (occurrences littérales `text-[9px]`, `text-[10px]`, `text-[11px]` + `.lucepress-kicker` = 0,69 rem = 11,04 px).
4. Vérification des hypothèses d'accessibilité dans les dépendances : `lucide-react@0.453.0` `defaultAttributes.js` (aucun `aria-hidden` par défaut), `@radix-ui/react-dialog`, `@radix-ui/react-checkbox`.
5. Requêtes de la compétence `ui-ux-pro-max` (voir §2).

**Correction de périmètre.** La mission désigne `client/src/pages/SystemSupervision.tsx`, `SystemAccess.tsx`, `SystemSessions.tsx`, `SystemPermissions.tsx`, `SystemMetier.tsx`, `SystemData.tsx`. Ces six fichiers vivent en réalité dans **`client/src/components/`** ; les fichiers homonymes de `pages/` (`SystemSupervisionPage.tsx`…) ne sont que les conteneurs qui appellent le serveur. J'ai audité les deux couches.

### Script de la compétence — avertissement d'exécution

`python scripts/search.py` et `python3 scripts/search.py` échouent tous deux par `ModuleNotFoundError: No module named 'core'` (le script est lancé depuis un dossier où `core.py` n'est pas sur `sys.path`). Seul **`py -3`** fonctionne. Toutes les requêtes ci-dessous ont donc été passées à `py -3`, depuis le dossier `scripts/` de la compétence.

---

## 2. Requêtes réellement exécutées

Toutes ont renvoyé des résultats. **Aucune requête n'est revenue vide** — aucun constat ci-dessous ne s'appuie donc sur une « exploration à vide », et je n'ai rien fabriqué pour combler un manque.

| # | Requête | Domaine | Résultat exploité |
|---|---------|---------|-------------------|
| 1 | `"error summary validation"` | `ux` | `Focusable Error Summary` (Forms/Accessibility, sévérité High) ; `Error Messages` (aria-live / role=alert) ; `Error Placement` (erreur sous le champ + `aria-describedby`) |
| 2 | `"keyboard focus modal"` | `ux` | `Focus States` (`outline-none` sans remplacement) ; `Focus Not Obscured (Enhanced)` ; `Focus Not Obscured (Minimum)` — WCAG 2.2 AA |
| 3 | `"badge chip label wraps"` | `ux` | `Compact Label Overflow` (« Don't: let one compact label wrap… or use a hover-only tooltip ») ; `Contextual Live Badge Updates` |
| 4 | `"live badge count screen reader"` | `ux` | `Contextual Live Badge Updates` (`role='status'` + `aria-atomic`, jamais un nombre nu) ; `Screen Reader` (HTML sémantique) |
| 5 | `"focus not obscured"` | `ux` | `Focus Not Obscured (Minimum)` — `scroll-padding-top: var(--header-height)` ; `Focus Appearance` (contraste d'état 3:1, **WCAG 2.2 AAA**) |
| 6 | `"icon button accessible label"` | `icons` | `icon-context-accessibility` : « if decorative beside visible text, set `aria-hidden="true"` ; if meaningful without equivalent visible text, provide a text alternative ; if inside an interactive control, give the control an accessible name and expose applicable state » |
| 7 | `"decorative icon aria hidden"` | `icons` | idem #6 (`icon-context-accessibility`) |
| 8 | `"status icon semantics"` | `icons` | idem #6 — le contexte est choisi **par l'usage**, pas par le glyphe |

Les règles ci-dessous sont citées depuis `references/quick-reference.md` §1–§10 et `references/pro-rules.md`, dont j'ai fait la lecture intégrale.

**Règles non représentées dans le jeu de données** (à ne pas me prêter à tort) : `accessible-authentication` précise explicitement que le critère AAA *Enhanced* n'existe pas dans les données ; `focus-appearance` et `focus-not-obscured-enhanced` sont **AAA**, pas AA. Je les classe en conséquence.

---

## 3. Ce qui n'a pas pu être vérifié

Aucun navigateur n'était disponible : pas de Playwright/web-gui-tester exécuté, pas de capture, pas d'arbre d'accessibilité réel, pas de lecteur d'écran. En conséquence **ne sont pas vérifiés** :

1. **Le rendu effectif** des rapports de contraste : mes calculs portent sur des jetons `oklch` **du thème clair et du thème sombre tels que définis**, en supposant les surfaces opaques. Le fond du `body` porte deux `radial-gradient` ; sous ces dégradés, les valeurs réelles peuvent varier de quelques centièmes. Les seuils que je signale comme franchis le sont de peu (4,44:1 vs 4,5:1 ; 2,32:1 vs 3:1) : à confirmer sur pixels réels.
2. **L'inspection de l'arbre d'accessibilité** : l'exposition effective des `<svg>` lucide non `aria-hidden` (annoncés « graphic » sans nom, ou ignorés) dépend du lecteur d'écran. Le défaut est certain au niveau du DOM (vérifié dans `defaultAttributes.js`) ; sa portée sonore ne l'est pas.
3. **Le comportement clavier réel** : j'ai vérifié l'absence de `scroll-padding`, l'absence de `tabIndex` sur les conteneurs `overflow-x-auto` et l'absence d'`aria-live` dans le code. Je n'ai pas pu *constater* le défilement, l'ordre de tabulation, ni le recouvrement.
4. **Le rendu à 360 px** : mesuré par calcul de largeur (`min-w-[42rem]` = 672 px, `min-w-[62rem]` = 992 px, `min-w-[52rem]` = 832 px dans une fenêtre de 328 px de contenu utile), pas observé.
5. **Le zoom à 200 % et l'agrandissement de texte système**, et la conformité `reduced-motion` réelle des `animate-spin`.
6. **Le comportement en cas d'échec de chargement d'un morceau de code** (`React.lazy` + `Suspense`) : je n'ai pas exécuté `LazyFallback` / `GuestLazyFallback` (importés, non lus en totalité), donc pas pu conclure sur l'écran blanc éventuel.
7. **Le contraste des icônes dans `bg-secondary`** et les états `hover`/`active` (non calculables sans rendu).

---

## 4. Synthèse par écran

Sévérités : **P0** = information fausse ou action inatteignable · **P1** = critère WCAG AA non tenu, ou risque d'erreur opérateur · **P2** = dette d'ergonomie/cohérence.

| Écran (fichier principal) | P0 | P1 | P2 | Points les plus graves |
|---|---|---|---|---|
| **Coquille + rail** (`SystemConsoleDashboard.tsx`, `SystemGate.tsx`, `SystemConsolePage.tsx`) | 0 | 4 | 6 | Nom d'application inventé ; rail empilé avant le contenu sous 1024 px ; titre de document figé |
| **`/console`** (tableau de bord) | 0 | 3 | 4 | `"…"` puis « Conakry » sur une heure locale ; date/`now` mêlés aux données serveur |
| **`/console/sante`** (`SystemSupervision.tsx`) | 0 | 2 | 5 | « — » vs « indisponible » pour un même échec ; icône `CircleCheck` sur un avertissement |
| **`/console/acces`** (`SystemAccess.tsx`, `SystemAccessActions.tsx`) | 1 | 7 | 6 | **« Copié » mensonger ×2** ; tableau à 672 px non focusable ; `<Label>` orphelins ; champ sans libellé |
| **`/console/sessions`** (`SystemSessions.tsx`) | 0 | 3 | 4 | Révocation sans confirmation ; tableau à 992 px non focusable |
| **`/console/permissions`** (`SystemPermissions.tsx`) | 0 | 1 | 4 | Pas de `<th scope="row">` — la matrice perd son sens au lecteur d'écran |
| **`/console/metier`** (`SystemMetier.tsx`) | 0 | 1 | 3 | Liens d'action en `h-8` (32 px) |
| **`/console/donnees`** (`SystemData.tsx`) | 1 | 4 | 5 | **« il n'y a donc rien à purger » sur une lecture échouée** ; case à cocher 16 px |
| **MFA** (`SystemMfa.tsx`, `SystemMfaPanels.tsx`) | 0 | 2 | 4 | Deux `<h1>` sur la même page ; `<li>1.` redondant ; icône de bouclier-coché sur « non activée » |
| **Connexion** (`LoginPage.tsx`, `AuthShell.tsx`) | 0 | 2 | 5 | Erreurs en toast seulement, hors champ ; `sidebar-foreground/55` = 4,34:1 |
| **Primitives partagées** (`ui/dialog.tsx`, `ui/sidebar.tsx`, `ui/checkbox.tsx`, `ui/button.tsx`) | 0 | 3 | 3 | « Close », « Sidebar », « Toggle Sidebar » en **anglais** ; cible de fermeture 16×16 px |
| **TOTAL — constats distincts du rapport** | **3** | **22** | **23** | **48 constats** |

> **Comment lire ce tableau.** Les colonnes P0/P1/P2 des lignes « écran » comptent les constats **rattachés** à cet écran ; un défaut systémique (icônes non `aria-hidden`, corps de texte < 12 px, cibles < 44 px, primitives `ui/*`) est rattaché à **chacun** des écrans qu'il touche, et le total par ligne dépasse donc le nombre de constats uniques. La dernière ligne donne les totaux réels : **3 P0, 22 P1, 23 P2, soit 48 constats distincts**, chacun numéroté et détaillé aux §5, §6 et §7.

---

## 5. Constats P0

### P0-1 — L'écran « Données » affirme « il n'y a rien à purger » alors que la lecture a échoué

- **Constat.** Quand `system.data.demoCandidates` échoue, `candidates` reste `undefined`. L'écran affiche alors, en toutes lettres : « Aucun client ne porte de motif de donnée de recette sur cette instance. **Il n'y a donc rien à purger.** » C'est une **affirmation fausse** : l'inventaire n'a pas été lu, on ne sait rien de ce qu'il contient. Le commentaire d'en-tête du fichier promet exactement l'inverse (« un inventaire illisible ne propose AUCUN candidat plutôt que de faire croire qu'il n'y a rien à voir ») — l'intention est bonne, l'implémentation la contredit.
  L'opérateur qui lit cet écran conclut qu'aucune donnée de recette ne subsiste. Sur l'écran voisin `/console/permissions`, le même cas est correctement traité (« Règle indisponible : aucun inventaire n'a été lu. »), ce qui prouve que le patron existait déjà.
- **Preuve.** `client/src/components/SystemData.tsx:430` (`candidates?.unavailable.length ?` → `undefined`, donc branche non prise) enchaîné sur `:435` (`liste.length === 0` → `true`) et `:436-438` (le message) ; `failed` est calculé en `client/src/pages/SystemDataPage.tsx:135`. Contre-exemple correct : `SystemData.tsx:413-415`.
- **Règle.** `empty-states` — « Show meaningful empty state when no data exists » : un état vide n'est légitime que si l'on sait qu'il n'y a rien. Rapprocher de la grille de mission, « états : … jamais de valeur inventée ».
- **Correction recommandée.** Traiter le tri-état explicitement : `const inventoryUnreadable = failed || candidates === undefined;` puis, avant la branche « vide » : « Inventaire non lu : la liste des candidats est inconnue. Rien n'est proposé avant d'avoir pu la lire. Réessayez avec « Actualiser ». » Ne jamais rendre la chaîne « rien à purger » que si `candidates !== undefined && candidates.unavailable.length === 0`.

### P0-2 — Le bouton « Copier » annonce « Copié » même quand rien n'a été copié

- **Constat.** `void navigator.clipboard?.writeText(password); setCopied(true);` : l'appel est enchaîné en optionnel et n'est pas attendu. En contexte non sécurisé (HTTP, iframe sans permission), `navigator.clipboard` est `undefined`, l'appel ne fait **rien**, et l'état passe quand même à « Copié ». Le bouton ment. Deux occurrences, toutes deux sur un secret qu'on demande à l'opérateur de **relayer par un canal sûr** : le mot de passe temporaire (affiché une seule fois) et le lien d'invitation (valable 72 h). Un opérateur qui voit « Copié », colle ailleurs et obtient autre chose croira à un bug de l'application, pas à un échec de copie — et le mot de passe est perdu, puisque la base n'en garde que l'empreinte.
  Le même dépôt contient déjà l'implémentation correcte, exactement pour le même geste (copie du secret TOTP) : `try { await navigator.clipboard.writeText(...); setCopied(true); } catch { setCopied(false); }`.
- **Preuve.** `client/src/components/SystemAccessActions.tsx:219-220` (mot de passe) et `:289-290` (lien d'invitation). Implémentation de référence : `client/src/components/SystemMfa.tsx:108-118`.
- **Règle.** `success-feedback` — « Confirm completed actions with brief visual feedback » : le retour doit refléter l'action **réellement** effectuée ; `error-feedback` — « Clear error messages near problem ».
- **Correction recommandée.** Reprendre `copySecret` de `SystemMfa.tsx:108-118` : `async` + `await` + `try/catch`, `setCopied(false)` en échec, et un troisième état visible (« Copie impossible — recopiez à la main ») plutôt qu'un retour binaire.

### P0-3 — Les actions des tableaux sont inatteignables au clavier, et hors écran à 360 px

- **Constat.** Les deux tableaux qui portent des actions sont enveloppés dans `<div className="overflow-x-auto">` **sans `tabIndex` ni `role="region"`**, et leur largeur minimale forcée dépasse largement un écran de téléphone : `min-w-[42rem]` (672 px), `min-w-[62rem]` (992 px), `min-w-[52rem]` (832 px) pour ~328 px de contenu utile à 360 px.
  Conséquence : à 360 px, la colonne d'actions (« Renommer », « Rôle », « Mot de passe », « Supprimer », « Révoquer ») se trouve à 600–900 px du bord gauche. Un conteneur `overflow-x-auto` non focusable **n'est pas défilable au clavier** : un utilisateur clavier ne peut structurellement pas atteindre ces boutons, et un utilisateur tactile doit deviner qu'il faut faire glisser horizontalement un tableau dont rien n'indique qu'il défile. Sur `/console/sessions`, « Révoquer » est la **seule** action de l'écran.
- **Preuve.** `client/src/components/SystemAccess.tsx:478-479` ; `client/src/components/SystemSessions.tsx:280-281` ; `client/src/components/SystemPermissions.tsx:133-134`.
- **Règle.** `keyboard-nav` — « Tab order matches visual order; full keyboard support » ; `horizontal-scroll` — « No horizontal scroll on mobile; ensure content fits viewport width » ; `focus-not-obscured` pour le rappel que ce qui est hors champ ne peut pas non plus recevoir le focus de façon visible.
- **Correction recommandée.** (a) Immédiat : `tabIndex={0}` + `role="region"` + `aria-label="Comptes de l'instance, tableau défilable"` sur chaque conteneur, et `scroll-padding-inline` — c'est le correctif minimal WCAG. (b) Cible : sous `md`, remplacer le tableau par une liste de cartes (une carte = un compte / une session), les actions passant sous l'identité de la ligne ; c'est le seul correctif qui rende réellement l'écran utilisable à 360 px.

---

## 6. Constats P1

### Accessibilité — clavier, focus, sélection

**P1-1 · Un contrôle focalisé est recouvert par un second lien d'évitement, exactement superposé.**
`DashboardLayout.tsx:327-329` rend `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:left-4 focus:top-4 …">Aller au contenu principal</a>` ; `DashboardLayout.tsx:396` rend un **second** lien identique vers la même cible, `className="lucepress-skip-link"`, dont `index.css:124` donne `position:absolute; left:1rem; top:-3.5rem; z-index:100` et `index.css:125` `:focus { top: 1rem }`. Mêmes coordonnées à l'état focalisé (16 px / 16 px), même `z-index` : le second, plus bas dans le DOM, **peint par-dessus le premier**. Quand l'utilisateur tabule sur le premier lien d'évitement, celui-ci est intégralement masqué par le second. Deux tabulations enchaînées pour la même destination.
→ *Règle :* `focus-not-obscured` (WCAG 2.2 AA) — « Sticky UI, overlays, and banners must not hide the keyboard-focused control » ; `keyboard-nav`.
→ *Correction :* supprimer le lien de `:327-329` et ne conserver que `.lucepress-skip-link`, ou décaler le second (`top: 3.5rem`).

**P1-2 · Le titre du document est identique sur les huit écrans de la console.**
Aucun `document.title` n'est défini nulle part (`grep -rn "document.title" client/src` → **aucun résultat**). Tous les écrans partagent le titre statique de `client/index.html:8` : « Lucepress Sarl — Gestion commerciale ». Les huit écrans de la console sont donc indiscernables dans l'historique, les onglets, les favoris et l'annonce d'arrivée sur une nouvelle page.
→ *Règle :* grille de mission « titres de document » ; `voiceover-sr` (ordre de lecture et contexte) ; `nav-state-active` (l'emplacement courant doit être identifiable).
→ *Correction :* un `useEffect` unique par écran, ou un petit hook `useDocumentTitle('Santé & supervision · Console — Lucepress')` appelé depuis chaque `*Page.tsx`.

**P1-3 · Les liens de tableau ne sont pas des en-têtes de ligne.**
Dans la matrice capacités × rôles, la colonne « Capacité » est rendue en `<td>` (`SystemPermissions.tsx:165`). Un lecteur d'écran qui parcourt une cellule de la matrice n'entend donc ni la capacité ni le rôle : il lit « Autorisé », sans savoir *de quoi*. C'est le sens même de l'écran qui disparaît. Même problème, moindre, sur `SystemAccess.tsx:494` (colonne « Nom ») et `SystemSessions.tsx:304`.
→ *Règle :* `data-table` — « Provide table alternative for accessibility » ; `voiceover-sr`.
→ *Correction :* `<th scope="row">` pour la première colonne des trois tableaux.

**P1-4 · Les bordures de champ de formulaire ne sont pas perceptibles (1,3–1,6:1).**
Mesures : `.lucepress-field` (`index.css:137`) → bordure `#d4c9b5` = **1,53:1** sur le fond ; le `--input` de la primitive → **1,34:1** ; le remplissage du champ vs le fond = **1,03:1** (invisible). Les champs de la console et de la connexion ne sont donc délimités que par une bordure quasi imperceptible.
→ *Règle :* `color-accessible-pairs` par analogie stricte, et surtout WCAG 1.4.11 (contraste des éléments non textuels, seuil 3:1) que la compétence adresse via `icon-contrast` — « Meaningful icons and **control boundaries** need at least 3:1 against adjacent colors ». La règle nomme explicitement les limites de contrôle.
→ *Correction :* passer la bordure de champ à un ton ≥ 3:1 (par ex. `oklch(0.62 0.045 83)`), soit la même valeur en clair et en sombre.

**P1-5 · Toutes les cibles critiques sont sous 44 px, plusieurs sous 24 px.**
Cibles mesurées dans la console : boutons de ligne de tableau `h-8` = **32 px** (`SystemAccess.tsx:537, 549, 561, 573, 651, 663` ; `SystemSessions.tsx:330` ; `SystemData.tsx:446, 459`) ; liens d'action du hub `h-8` (`SystemMetier.tsx:211`, via `buttonVariants({ size: "sm" })` = `ui/button.tsx:25`) ; boutons de rôle `h-8` (`SystemAccessActions.tsx:337`) ; boutons de panneau `h-10` = 40 px ; bouton d'en-tête « Actualiser » `h-10`. Et surtout : **la case à cocher de sélection à purger fait 16×16 px** (`ui/checkbox.tsx:15`, `size-4` ; utilisée en `SystemData.tsx:481`) — c'est le contrôle qui décide de ce qui sera **détruit**. Enfin la croix de fermeture de **toutes** les boîtes de dialogue n'a aucun padding : sa boîte fait la taille de l'icône, **16×16 px** (`ui/dialog.tsx:137`). L'espacement entre boutons de ligne est `gap-1.5` = **6 px**, sous le minimum de 8 px.
→ *Règles :* `touch-target-size` — « Min 44×44pt / 48×48dp; extend hit area beyond visual bounds if needed » ; `touch-spacing` — « Minimum 8px/8dp gap between touch targets » ; `web-target-size` — « Web pointer targets need 24×24 CSS px or a documented exception ».
→ *Correction :* `h-11` (44 px) sur les actions de ligne, `gap-2` minimum, `after:absolute after:-inset-2` (ou `p-2`) sur la croix des dialogues et l'`Indicator` de la case à cocher pour étendre la zone sensible sans changer le dessin.

**P1-6 · Les erreurs de formulaire ne sont reliées à aucun champ.**
Dans les six dialogues, `DialogError` est rendu **une seule fois, en bas du formulaire**, après le dernier champ (`SystemAccessActions.tsx:429, 495, 581, 724, 802, 854`). Aucun champ ne porte `aria-invalid`, aucun ne porte `aria-describedby` pointant vers le message. Le `role="alert"` de `SystemAccessActions.tsx:154` fait bien *annoncer* le message — c'est un bon point — mais ne dit pas **de quel champ** il s'agit, et le focus reste sur le bouton de soumission. « Adresse e-mail invalide. » s'affiche sous le sélecteur de rôle, trois champs plus bas que la cause. Sur `LoginPage.tsx:86`, c'est pire : l'erreur de connexion ne va que dans un `toast.error()` (Sonner), donc **n'existe pas dans le formulaire**.
→ *Règles :* `error-placement` — « Show a specific error below the related field and connect it with `aria-describedby` » ; `error-summary` / `focus-management` — « After failed submission… focus the error summary; without a summary, focus the first invalid field » ; `aria-live-errors`.
→ *Correction :* faire descendre le message jusqu'au champ concerné (`aria-invalid` + `aria-describedby` sur l'`Input`), conserver le `role="alert"` d'ensemble, et déplacer le focus sur le premier champ invalide après un échec. Sur la connexion, rendre l'erreur sous les champs au lieu du toast seul.

**P1-7 · Les icônes décoratives ne sont pas retirées de l'arbre d'accessibilité.**
`lucide-react@0.453.0` ne pose **aucun attribut `aria-hidden` par défaut** : `node_modules/lucide-react/dist/esm/defaultAttributes.js` ne contient que `xmlns, width, height, viewBox, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin`. Or la console n'ajoute `aria-hidden="true"` que **6 fois** (`SystemSupervision.tsx:195, 197, 242`, `SystemPermissions.tsx:83, 85, 184, 187` — 7 au total), alors qu'elle rend des dizaines d'icônes purement décoratives placées à côté d'un libellé visible : `SystemConsoleDashboard.tsx:268` (rail), `:317` (accès rapides), `SystemData.tsx:493, 498, 508`, `SystemMetier.tsx:199, 214, 235`, `SystemAccess.tsx:153, 158`, `LoginPage.tsx:165, 183`, `AuthShell.tsx:38, 64`… Chacune est exposée comme un graphique sans nom.
→ *Règle :* `icon-context` / `icon-context-accessibility` (requêtes #6-8) — « if decorative beside visible text, set `aria-hidden="true"` » ; `aria-labels` ; checklist `pro-rules.md` : « Decorative icons beside visible text are hidden from the accessibility tree (`aria-hidden="true"` on web) ».
→ *Correction :* envelopper `LucideIcon` dans un petit composant local `Icon` qui pose `aria-hidden` par défaut, avec une échappatoire explicite pour les icônes porteuses de sens seules.

**P1-8 · Aucun compteur ni badge d'état n'est annoncé quand il change.**
`ConsoleStatusBadge` (`SystemConsoleDashboard.tsx:194-209`) et les quatre `Metric` de chaque écran changent de valeur après un clic sur « Actualiser » — « En ligne » peut devenir « Hors ligne », « 3 active(s) » peut devenir « 0 active(s) ». Il n'existe **aucun `aria-live`, aucun `role="status"` dans les écrans de la console** (`grep` : seuls trois `role="alert"`, tous dans des dialogues). L'opérateur qui ne voit pas l'écran n'apprend rien du relevé qu'il vient de demander.
→ *Règle :* `contextual-live-badge-updates` — « Async badge and count changes should announce a meaningful contextual status without moving focus… Use one appropriate atomic status message such as `3 items in cart`. Don't announce a bare number or make every badge a competing live region ».
→ *Correction :* **une seule** région `role="status"` `aria-atomic="true"` par écran, contenant une phrase complète (« Relevé du 17/09 à 14:02 — état global : Dégradé, base de données : Accessible »). Ne pas transformer chaque badge en région live.

**P1-9 · Le focus clavier peut être masqué par l'en-tête collant.**
L'en-tête de l'application est `sticky top-0 z-40 h-[66px]` (`DashboardLayout.tsx:395`), et `scroll-padding` n'apparaît **nulle part** dans `client/src/index.css`. Un contrôle focalisé par tabulation dans un long écran (`/console/acces` fait plusieurs milliers de pixels de haut) peut donc être amené au bord haut de la fenêtre, sous les 66 px d'en-tête.
→ *Règle :* `focus-not-obscured` (WCAG 2.2 AA) — « Offset sticky UI with `scroll-padding`… Don't: fixed overlay covers `:focus` » ; la fiche de la compétence donne littéralement l'exemple `scroll-padding-top: var(--header-height)`.
→ *Correction :* `html { scroll-padding-top: 5rem }` dans `index.css`, en gardant la valeur synchronisée avec la hauteur de l'en-tête.

**P1-10 · Trois groupes de boutons ont un libellé visuel qui n'est relié à rien.**
`<Label>Rôle</Label>` (`SystemAccessActions.tsx:426`, `:799`) et `<Label>Nouveau rôle</Label>` (`:566`) sont des `<label>` **sans `htmlFor`** : ils ne désignent aucun contrôle, un clic dessus ne fait rien, et `RoleChoices` (`:332`) est un `<div className="flex flex-wrap gap-2">` sans `role="group"`, `role="radiogroup"` ni `aria-labelledby`. Les boutons portent bien `aria-pressed` (bon point) mais le lecteur d'écran n'annonce jamais le titre du groupe.
→ *Règles :* `form-labels` — « Use `label` with `for` attribute » ; `field-grouping` — « Group related fields logically (`fieldset`/`legend` or visual grouping) ».
→ *Correction :* `role="radiogroup"` + `aria-labelledby` sur `RoleChoices`, ou un `<fieldset>` avec `<legend>` ; au minimum remplacer `<Label>` par `<p id="…">` + `aria-labelledby`.

**P1-11 · Un champ de saisie de la console n'a aucun libellé.**
Le lien d'invitation est rendu par `<Input readOnly value={link} … />` (`SystemAccessActions.tsx:283`), **sans `<Label>`, sans `aria-label`, sans `aria-labelledby`**. Le lecteur d'écran annonce « zone de texte, lecture seule », sans dire quoi. C'est un secret d'accès qu'on demande à l'opérateur de manipuler.
→ *Règle :* `form-labels` ; `aria-labels` — « `aria-label` for icon-only buttons » étendu aux contrôles sans texte visible.
→ *Correction :* `<Label htmlFor="sia-link">Lien d'invitation à transmettre</Label>` + `id="sia-link"` sur l'`Input`.

### États

**P1-12 · Un même échec est affiché « — » dans une ligne et « indisponible » dans la ligne suivante.**
Dans le panneau « Migration » : `<Row label="Suivi Drizzle">{!metrics ? "—" : …}</Row>` (`SystemSupervision.tsx:213-215`) puis `<Row label="Dernière migration">… : "indisponible"` (`:216-218`). Quand `metrics` est `undefined` (relevé refusé), les deux lignes du **même encadré** portent deux vocabulaires différents pour le même manque. Le même flottement traverse la console : `pending = "…"` est redéfini localement en `SystemConsoleDashboard.tsx:363`, `SystemSupervision.tsx:91`, `SystemAccess.tsx:253`, `SystemSessions.tsx:136`, `SystemData.tsx:253` — cinq copies d'une même convention, et à côté de cela « — », « indisponible », « non communiqué », « relevé indisponible », « registre indisponible », « lecture en cours… ».
→ *Règle :* `empty-states` + `read-only-distinction` — la distinction entre *non lu*, *non lisible* et *sans objet* doit être sémantique et **constante** ; `whitespace-balance` pour la lisibilité d'ensemble.
→ *Correction :* un module `consoleStates.ts` exportant trois constantes (`ETAT_NON_LU = "non lu"`, `ETAT_INDISPONIBLE = "indisponible"`, `ETAT_EN_COURS = "relevé en cours…"`) et un composant `<ConsoleValue state=… />` ; proscrire le tiret cadratin pour dire « indisponible ».

**P1-13 · Une lecture échouée s'affiche « Relevé en cours… » indéfiniment.**
`{overview?.documentsByStatus === undefined && (<li …>Relevé en cours…</li>)}` (`SystemData.tsx:398-400`). En cas d'échec, `overview` est `undefined`, donc `overview?.documentsByStatus` est `undefined`, donc la condition est **vraie** : le panneau annonce un chargement en cours qui n'aura jamais lieu. Juste à côté, la même carte sait dire « Répartition par statut indisponible. » quand la valeur est `null` (`:395-397`) — mais l'état d'échec, lui, ne peut pas l'atteindre.
→ *Règles :* `progressive-loading` (un indicateur de chargement doit refléter un chargement réel) ; `timeout-feedback` (l'absence de réponse doit produire un message, pas un indicateur) ; `empty-states`.
→ *Correction :* distinguer les trois sources — `isLoadingOverview`, `failed`, et `overview.documentsByStatus === null` — au lieu de se fier à `undefined`.

**P1-14 · Le nom de l'application affiché ne vient pas toujours du serveur.**
`<Row label="Nom">{overview?.application.name ?? "Lucepress Facturation"}</Row>` (`SystemConsoleDashboard.tsx:429`). Tant que `system.overview` charge, et **définitivement s'il est refusé**, le panneau affiche « Lucepress Facturation » comme s'il s'agissait de la réponse du serveur — alors que la ligne suivante, elle, affiche honnêtement « non communiquée » pour la version (`:430`), et que le panneau lui-même signale « refusé » deux lignes plus bas (`:441-443`). Le même écran affirme donc, côte à côte, « vérifié/refusé » et un nom plausible non vérifié.
→ *Règle :* `empty-states` ; grille de mission, « jamais de valeur inventée ». Rapprocher de `read-only-distinction`.
→ *Correction :* retirer le littéral, afficher « indisponible » (ou une classe de squelette) tant que `overview` est `undefined` ; si l'on tient au confort visuel, le marquer visiblement comme valeur locale (`<span className="italic">valeur locale, non confirmée par le serveur</span>`).

### Responsive & navigation

**P1-15 · Sur mobile et tablette, quatorze entrées de rail précèdent le contenu.**
Le rail est placé en premier dans une grille `lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]` (`SystemConsolePage.tsx:80`, `SystemSupervisionPage.tsx:42`, `SystemSessionsPage.tsx:91`, `SystemMetierPage.tsx:32`, `SystemPermissionsPage.tsx:31`, `SystemDataPage.tsx:128`). Sous 1024 px, la grille est mono-colonne : le rail s'empile **au-dessus** du contenu. `CONSOLE_MODULES` compte 14 entrées (`SystemConsoleDashboard.tsx:63-122`), soit ~500 px de navigation avant la première information utile, sur **chaque** écran. Entre 768 et 1023 px s'ajoute le rail latéral de l'application — qui n'est un tiroir qu'en dessous de 768 px (`hooks/useMobile.tsx:3`). Il y a donc deux navigations empilées à l'écran.
→ *Règles :* `content-priority` — « Show core content first on mobile; fold or hide secondary content » ; `adaptive-navigation` — « Large screens (≥1024px) prefer sidebar; small screens use bottom/top nav » ; `avoid-mixed-patterns` — « Don't mix Tab + Sidebar + Bottom Nav at the same hierarchy level ».
→ *Correction :* sous `lg`, remplacer le rail par un sélecteur de module (un `<select>` ou un bouton « Modules » ouvrant un tiroir Radix), placé **après** l'en-tête de page et refermé par défaut ; ou le rendre repliable (`<details>`) fermé initialement.

**P1-16 · La navigation latérale de l'application et le rail de la console doublonnent la même destination.**
`DashboardLayout.tsx:111-119` définit déjà un groupe « Exploitation » avec les sept mêmes entrées que le rail (comparer `SystemConsoleDashboard.tsx:63-122`). Sur un écran de console, l'opérateur voit donc la même liste deux fois sur la même page, avec des libellés très proches mais pas identiques (« Données & métier » au rail, « Données & métier » dans la barre ; « Sessions actives » vs « Sessions actives » — mais « Rôles & permissions » vs « Rôles & permissions »). Sur un portable de 1280 px : ~256 px + 240 px = 496 px de chrome, soit 38 % de la largeur, pour une information identique.
→ *Règles :* `nav-hierarchy` — « Primary nav vs secondary nav must be clearly separated » ; `avoid-mixed-patterns`.
→ *Correction :* choisir **une** des deux : soit retirer le groupe « Exploitation » de la barre latérale quand on est déjà sous `/console` (le rail prend le relais), soit supprimer le rail et enrichir le groupe latéral. Ne pas garder les deux.

**P1-17 · Les libellés de navigation ne sont pas homogènes d'une couche à l'autre.**
Le module « Données & métier » mène à `/console/metier`, et un module distinct « Données » mène à `/console/donnees` (`SystemConsoleDashboard.tsx:100-113`). Le commentaire du code assume la proximité des termes ; à l'usage, deux entrées voisines commençant par le même mot, l'une contenant l'autre, ne se distinguent pas par leur libellé mais par leur route. La phase est par ailleurs affichée en badge `text-[9px]` (`:271`) — donc illisible — et n'est pas reliée au module par un identifiant (`aria-describedby`), si bien que le lecteur d'écran n'apprend pas **pourquoi** l'entrée est inerte.
→ *Règles :* `nav-label-icon` / `navigation-consistency` ; `empty-nav-state` — « When a nav destination is unavailable, explain why instead of silently hiding it » ; `compact-label-overflow` pour le badge.
→ *Correction :* renommer en « Données de l'instance » et « Écrans métier », et porter l'explication d'indisponibilité dans le libellé accessible (`<span className="sr-only">— module prévu en phase 4, non disponible</span>`).

### Formulaires & confirmations

**P1-18 · Une révocation de session irréversible se déclenche en un clic, sans confirmation.**
`SystemSessionsPage.tsx:66-74` appelle `revoke.mutate({ id: session.id })` directement depuis le clic sur la ligne, sans dialogue ni étape intermédiaire. Le bouton fait **32 px** et se trouve dans un tableau où toutes les lignes se ressemblent (compte, e-mail, rôle, dates, agent, IP). La conséquence est immédiate et non annulable : l'utilisateur visé est déconnecté à sa requête suivante.
Comparer : dans le même dépôt, **renommer un compte** (action réversible, sans effet sur les accès) ouvre un dialogue complet ; changer un rôle en ouvre un qui nomme l'avant et l'après ; supprimer un compte exige la recopie de l'identité. Le geste le moins confirmé est donc l'un des plus visibles pour l'utilisateur final.
→ *Règles :* `confirmation-dialogs` — « Confirm before destructive actions » ; `destructive-emphasis` — « Destructive actions use semantic danger color (red) and are visually separated from primary actions » ; `undo-support` — « Allow undo for destructive or bulk actions » (le cas échéant).
→ *Correction :* un `ConfirmDialog` qui nomme le compte, l'adresse, l'agent et l'IP de la session visée — cinq éléments qui existent déjà dans `ConsoleSession` — et confirme sur un bouton `variant="destructive"`.

**P1-19 · Les libellés de dialogue sont en anglais dans une interface entièrement française.**
`ui/dialog.tsx:140` : `<span className="sr-only">Close</span>` — c'est le nom accessible de la croix de fermeture de **tous** les dialogues de la console (créer, renommer, changer un rôle, réinitialiser, supprimer, inviter, révoquer). `ui/sidebar.tsx:200-201` : `<SheetTitle>Sidebar</SheetTitle>` et `<SheetDescription>Displays the mobile sidebar.</SheetDescription>` — annoncés à l'ouverture du tiroir de navigation mobile. `ui/sidebar.tsx:284` : `<span className="sr-only">Toggle Sidebar</span>`.
→ *Règles :* grille de mission, « navigation : libellés homogènes » ; `voiceover-sr` — « Meaningful `accessibilityLabel`… logical reading order » ; checklist `pro-rules.md` : « Icon controls have an accessible name » (un nom dans la mauvaise langue n'est pas un nom utilisable).
→ *Correction :* « Fermer », « Navigation », « Affiche la navigation sur mobile », « Réduire la navigation ». Attention : ces primitives sont partagées par toute l'application — la correction vaut donc bien au-delà de la console, dans le bon sens.

**P1-20 · Deux `<h1>` sur la même page pendant l'enrôlement MFA.**
`SystemConsolePage.tsx:61-78` rend `PageHeader` (`PageHeader.tsx:29`, `<h1>` = « Console d'exploitation ») puis, plus bas, `ConsoleMfaManager`. Quand l'opérateur lance l'enrôlement, `MfaShell` (`SystemMfa.tsx:50`) rend à son tour un `<h1>` (« Double authentification », « Enrôlez votre application », « Codes de secours »). La même page porte alors deux titres de niveau 1, et la hiérarchie 1→6 est rompue.
→ *Règle :* `heading-hierarchy` — « Sequential h1→h6, no level skip » ; `voiceover-sr` (l'ordre de lecture et la navigation par titres deviennent ambigus).
→ *Correction :* `MfaShell` en `<h2>` (ou accepter un `headingLevel` en propriété) lorsqu'il est monté à l'intérieur d'un écran déjà titré.

### Typographie

**P1-21 · 95 occurrences de texte sous 12 px, dont les libellés des indicateurs clés et tous les en-têtes de tableau.**
Comptage exhaustif (occurrences littérales + `.lucepress-kicker` = 0,69 rem = 11,04 px) :

| Fichier | `9px` | `10px` | `11px` | kicker | **< 12 px** |
|---|---|---|---|---|---|
| `SystemAccess.tsx` | 0 | 5 | 11 | 2 | **18** |
| `SystemData.tsx` | 0 | 1 | 16 | 0 | **17** |
| `DashboardLayout.tsx` | 1 | 13 | 4 | 0 | **18** |
| `SystemPermissions.tsx` | 0 | 3 | 4 | 1 | **8** |
| `SystemConsoleDashboard.tsx` | 1 | 1 | 3 | 2 | **7** |
| `SystemMfaPanels.tsx` | 0 | 4 | 2 | 1 | **7** |
| `SystemSessions.tsx` | 0 | 1 | 4 | 1 | **6** |
| `SystemSupervision.tsx` | 0 | 0 | 4 | 0 | **4** |
| `SystemAccessActions.tsx` | 0 | 1 | 3 | 0 | **4** |
| `SystemMetier.tsx` | 0 | 0 | 2 | 0 | **2** |
| `Metric.tsx` | 0 | 1 | 1 | 0 | **2** |
| `SystemMfa.tsx` | 0 | 0 | 0 | 1 | **1** |
| `PageHeader.tsx` | 0 | 0 | 0 | 1 | **1** |
| **TOTAL** | **2** | **30** | **54** | **9** | **95** |

Les cas les plus coûteux ne sont pas les mentions légales : ce sont **les libellés de tous les indicateurs** (`Metric.tsx:58` à 11 px, `:43` à 10 px — « État global », « Base de données », « Comptes », « Sessions actives »…) et **tous les en-têtes de tableau** (`SystemAccess.tsx:481`, `SystemSessions.tsx:283`, `SystemPermissions.tsx:140, 148, 153` — à 10 px, en capitales avec `tracking-[0.12em]`). S'y ajoutent les badges d'état (`text-[10px]` : `SystemAccess.tsx:152, 157, 514, 515` ; `SystemAccessActions.tsx:906`), les badges de phase du rail (`text-[9px]`, `SystemConsoleDashboard.tsx:271`) et le pattern de motif de recette (`text-[10px]`, `SystemData.tsx:511`).
→ *Règles :* grille de mission « rien < 12 px » ; `readable-font-size` — « Minimum 16px body text on mobile » (la console en est loin) ; `font-scale` — « Consistent type scale (e.g. 12 14 16 18 24 32) » ; `contrast-readability` pour la lisibilité combinée (capitales + `tracking` large + 10 px + gris).
→ *Correction :* plancher dur à 12 px (`text-xs`). Traiter à part les capitales espacées, qui exigent un cran de plus : passer les en-têtes de tableau et les libellés de `Metric` à 12 px en `tracking-[0.08em]` maximum, et les badges à 12 px également.

**P1-22 · Deux textes gris semi-transparents passent sous le seuil de contraste.**
Mesures calculées (composition alpha sur la surface réelle) :

| Élément | Valeur | Ratio | Seuil | Verdict |
|---|---|---|---|---|
| `SystemPermissions.tsx:168` — `text-muted-foreground/80` (chemin de capacité, 11 px) | 4,44:1 | **4,5:1** | ✗ |
| `SystemPermissions.tsx:85` et `:187` — icône `Minus` en `text-muted-foreground/50` (« Refusé ») | 2,32:1 (clair) / 2,77:1 (sombre) | **3:1** | ✗ |
| `AuthShell.tsx:55` — `text-sidebar-foreground/55` sur `to-primary` (kicker 11 px) | 4,34:1 | **4,5:1** | ✗ |
| `SystemConsoleDashboard.tsx:171` — point d'état « inconnu » en `bg-muted-foreground/40` | 1,92:1 | **3:1** | ✗ |

À titre de comparaison, tout le reste du vocabulaire d'état est **conforme** — je l'ai vérifié pour ne pas signaler au hasard : `amber-950`/`amber-50` 14,44:1 ; `rose-900`/`rose-50` 8,71:1 ; `emerald-800`/`emerald-50` 7,29:1 ; `amber-200`/`amber-950` (sombre) 12,03:1 ; `muted-foreground` seul sur panneau 7,32:1. Le problème est **spécifique aux modificateurs d'opacité**, pas à la charte.
→ *Règles :* `color-accessible-pairs` — « Foreground/background pairs must meet 4.5:1 (AA) or 7:1 (AAA) » ;; pour les deux icônes et le point d'état, `icon-contrast` — « Meaningful icons and control boundaries need at least 3:1 against adjacent colors ».
→ *Correction :* supprimer les modificateurs : `text-muted-foreground` plein (7,32:1) au lieu de `/80` ; `text-muted-foreground` ou `text-foreground/60` pour l'icône « Refusé » ; `text-sidebar-foreground/70` (6,09:1 au pire) au lieu de `/55` dans `AuthShell` ; et pour le point « inconnu », un ton dédié (`oklch(0.62 0.02 162)`) plutôt qu'un `muted-foreground/40`.

---

## 7. Constats P2

### Cohérence des icônes et des états

**P2-1 · Des icônes contredisent le message qu'elles introduisent.** `CircleCheck` (coche dans un cercle, sémantique de succès) introduit « Mesures indisponibles sur ce relevé » (`SystemSupervision.tsx:229`). `ShieldCheck` (bouclier coché) et sa couleur sont **identiques** pour les quatre tons du badge MFA, y compris « MFA : non activée » en rose (`SystemMfaPanels.tsx:481`) et « MFA : enrôlement inachevé ». `CircleAlert` introduit **aussi bien** un succès qu'un refus dans les notices de `/console/donnees` (`SystemData.tsx:311`, où `notice.tone === "ok"` conserve `CircleAlert`). À l'inverse, `SystemAccessActions.tsx:135-141` et `SystemSessions.tsx:195-201` choisissent correctement leur icône selon le ton — la console n'a donc pas une règle, elle en a deux.
→ *Règle :* `icon-context` / `icon-context-accessibility` — « Choose semantics from use, not glyph » ; `state-clarity` — « Make hover/pressed/disabled states visually distinct ».
→ *Correction :* un `StatusIcon({ tone })` unique, sur le modèle déjà correct de `SystemAccessActions.tsx:135-141`, employé partout.

**P2-2 · Un mot de prose occupe la place d'un chiffre.** `Metric` rend `value` en `lucepress-value text-xl` (serif, 20 px, `Metric.tsx:57`). Or quatre cartes de `/console/sessions` affichent simultanément le mot « indisponible » (`SystemSessions.tsx:222, 229, 236, 243`), de même que `SystemAccess.tsx:359` (« indisponible ») et `SystemData.tsx:344`. Quatre fois le même mot long, en gros serif, là où l'œil cherche un nombre. Et `String(access.accountsTotal)` (`SystemAccess.tsx:338, 345, 352`) n'applique pas le formatage local utilisé ailleurs (`formatCount` → « 1 234 »).
→ *Règles :* `number-formatting` — « Use locale-aware formatting for numbers… » ; `whitespace-balance` ; `visual-hierarchy`.
→ *Correction :* réserver `lucepress-value` aux valeurs numériques ; pour l'indisponibilité, une variante typographique dédiée (corps, `text-sm`, italique ou gris) ; utiliser `formatCount()` partout où un entier est affiché.

**P2-3 · Une valeur de prose est rendue en monospace gras, comme une donnée.** `Row` (`SystemConsoleDashboard.tsx:188`) applique `font-mono text-sm font-bold` à **tout** son contenu. Il reçoit donc « non communiqué » (`SystemSupervision.tsx:161`), « aucune exigence imposée » (`SystemAccess.tsx:441`), « présent »/« absent » (`SystemSupervision.tsx:214`), « refusé »/« vérifié » (`SystemConsoleDashboard.tsx:441-448`). Une phrase habillée comme un identifiant technique.
→ *Règle :* `row` n'étant pas dans le jeu de données, je cite `color-semantic`/`whitespace-balance` par analogie, et **je signale que cette recommandation-ci vient de la grille de mission (« typographie »), pas d'une correspondance de la base**.
→ *Correction :* `Row` prend une propriété `mono?: boolean` (par défaut `false`), et ne l'active que pour les valeurs réellement numériques ou techniques.

**P2-4 · Un libellé tronqué ne se laisse jamais lire en entier.** `truncate` sans `title`, sans `aria-label` et sans dépliant : libellés du rail (`SystemConsoleDashboard.tsx:269`), noms de table (`SystemSupervision.tsx:196`), noms de table dans les volumes (`SystemData.tsx:366`), e-mails d'invitation (`SystemAccess.tsx:637`). Une seule infobulle existe dans toute la console : `title={session.userAgent}` (`SystemSessions.tsx:314`) — or une infobulle au survol seul est inatteignable au clavier et au toucher, ce que la règle interdit explicitement.
→ *Règles :* `truncation-strategy` — « Prefer wrapping over truncation; when truncating use ellipsis and provide full text via tooltip/expand » ; `compact-label-overflow` — « Don't: … use a hover-only tooltip ».
→ *Correction :* remplacer `title` par un dépliant opérable (`<button aria-expanded>` + texte complet) là où la valeur est longue, et par `aria-label` complet sur l'élément tronqué là où elle est courte.

**P2-5 · Une liste numérotée double ses numéros.** `<ol className="space-y-2 …">` contient `<li>1. Installez…</li>`, `<li>2. Enregistrez…</li>`, `<li>3. Saisissez…</li>` (`SystemMfaPanels.tsx:234-238`). Le HTML fournit déjà les marqueurs ; le texte les répète. Le lecteur d'écran annonce « 1. 1. Installez… ».
→ *Règle :* requête #4, `Screen Reader` — « Content should make sense when read aloud. Use semantic HTML and ARIA properly ».
→ *Correction :* retirer les préfixes « 1. », « 2. », « 3. » du texte des `<li>`.

**P2-6 · Le texte de repli du point d'état est invisible.** Le ton `unknown` de `StatusDot` utilise `bg-muted-foreground/40` (`SystemConsoleDashboard.tsx:171`), soit **1,92:1** — un point de 8 px quasi invisible. Le sens reste porté par le libellé textuel (`color-not-only` est donc satisfait, c'est un bon point), mais l'indication pré-attentive disparaît précisément dans l'état où l'opérateur a le plus besoin de la voir. *(Doublon partiel de P1-22, isolé ici pour la raison inverse : ce n'est pas le sens qui manque, c'est la visibilité.)*
→ *Règle :* `icon-contrast` (3:1) ; `color-not-decorative-only`.
→ *Correction :* ton dédié plus sombre, ou une forme distincte (cercle évidé, tiret) plutôt qu'une opacité réduite.

### États et retours

**P2-7 · Le retour d'attente des boutons n'est pas homogène.** Sur six boutons soumis à une action asynchrone, **deux** affichent un `Loader2` en plus du changement de libellé (`SystemAccessActions.tsx:436`, `:809`) et **quatre** ne changent que le texte (`:501` « Enregistrement… », `:594`, `:648`, `:738`, `:868`). Les boutons de la console, eux, ont tous un spinner (`SystemData.tsx:584, 642` ; `SystemSessions.tsx:336`).
→ *Règle :* `loading-buttons` — « Disable button during async operations; show spinner or progress » ; `state-clarity`.
→ *Correction :* une seule règle : tout bouton dont le libellé passe au gérondif reçoit un spinner.

**P2-8 · Un verrou de ligne incomplet.** `SystemSessions.tsx:331` fait `disabled={revokingId === session.id}` : pendant qu'une révocation est en vol, **les autres lignes restent actives**. Deux révocations concurrentes sont donc possibles, et la seconde notice écrase la première — le retour affiché ne couvre plus qu'un des deux gestes. `SystemAccess.tsx:538` fait au contraire `disabled={busy !== null}` (toute la ligne est verrouillée) — choix explicitement commenté (`:202-208`).
→ *Règle :* `loading-states` — « Match feedback to the expected wait » ; `cancellable-state-transitions` pour l'écrasement du retour.
→ *Correction :* `disabled={revokingId !== null}` et, si plusieurs gestes doivent rester possibles, afficher **plusieurs** notices (une liste) plutôt qu'un emplacement unique.

**P2-9 · Pendant la lecture, un panneau est entièrement vide.** `access?.accessMeans.length === 0` (`SystemAccess.tsx:430`) ne peut pas être vrai tant que `access` est `undefined` : au chargement, la `<ul>` de `:419` est vide et **aucun** message ne la remplace. Le panneau « Moyens d'accès & de session » est donc une boîte blanche sans explication.
→ *Règle :* `progressive-loading` — « Use skeleton screens / shimmer instead of long blocking spinners » ; `empty-states`.
→ *Correction :* `<ConsoleSkeleton lines={3} />` tant que `isLoading && !access`.

**P2-10 · Trois spinners n'ont ni nom ni annonce.** `SystemGate.tsx:39` (repli plein écran pendant la vérification), `SystemAccess.tsx:272` et `SystemSessions.tsx:152` (à côté du badge d'état), `SystemConsoleDashboard.tsx:439` (dans la ligne « Contrôle serveur »). Un `<Loader2 animate-spin>` sans texte. Les écrans qui l'accompagnent d'un libellé visible (`SystemSupervision.tsx:122-124`, `SystemData.tsx:359`) sont, eux, corrects.
→ *Règles :* `aria-labels` (nom accessible) ; grille de mission « états : chargement … jamais d'écran blanc » ; `voiceover-sr`.
→ *Correction :* `<Loader2 role="status" aria-label="Vérification en cours" />` ou `<span className="sr-only">Relevé en cours…</span>`.

### Toucher, formulaires, mouvement

**P2-11 · Les boutons destructifs ne sont pas séparés visuellement.** Les quatre actions d'une ligne de compte sont dans un `flex flex-wrap gap-1.5` (6 px) où « Supprimer » n'est distingué que par sa couleur de texte (`SystemAccess.tsx:532-581`). Même forme, même taille, même écart que « Renommer ».
→ *Règle :* `destructive-emphasis` — « Destructive actions use semantic danger color (red) and are **visually separated** from primary actions ».
→ *Correction :* séparateur vertical ou `ml-auto` pour la dernière action, et bouton destructif en `variant="destructive"`.

**P2-12 · Aucun bouton « afficher le mot de passe ».** `LoginPage.tsx:184-194` : champ `type="password"` sans bascule. Aucun des champs de mot de passe des dialogues n'en a non plus (`SystemAccessActions.tsx:416-422`).
→ *Règle :* `password-toggle` — « Provide show/hide toggle for password fields » ; `accessible-authentication` — « Allow password managers and paste; provide a non-cognitive authentication path ».
→ *Correction :* bascule œil/œil barré avec `aria-pressed` et libellé « Afficher le mot de passe ».

**P2-13 · Une validation native et une validation maison se superposent.** Les `Input` des dialogues portent `required` (`SystemAccessActions.tsx:408, 421, 796`) **et** un contrôle manuel en `onSubmit` (`:389-390`, `:789-790`). Pour un champ vide, le navigateur intercepte d'abord la soumission et affiche sa propre bulle (dans la langue du navigateur), rendant le message maison inatteignable ; la bulle native, elle, n'utilise ni `role="alert"` ni le style de la charte. Deux présentations d'erreur coexistent donc dans la même boîte.
→ *Règles :* `inline-validation` — « Validate on blur (not keystroke); show error only after user finishes input » ; `error-clarity` ; `contrast-feedback`.
→ *Correction :* soit `noValidate` sur le `<form>` et validation entièrement maison, soit renoncer au contrôle manuel — mais pas les deux.

**P2-14 · Les animations respectent le mouvement réduit, sauf les spinners.** `index.css:149` désactive `.animate-pulse`, `.lucepress-hover-lift`, les animations d'entrée et `scroll-behavior` sous `prefers-reduced-motion: reduce` — c'est une vraie réussite. Mais `animate-spin` n'y figure pas, alors que c'est de loin l'animation la plus présente de la console (~20 `Loader2`). Une rotation continue en boucle est précisément le cas que le mouvement réduit vise.
→ *Règle :* `reduced-motion` — « Respect `prefers-reduced-motion`; reduce/disable animations when requested » ; `loading-states`.
→ *Correction :* ajouter `.animate-spin { animation: none !important }` au bloc `reduce` **en conservant un indicateur non animé** (par ex. `.animate-spin { opacity: .55 }`), pour ne pas perdre le signal de chargement.

### Dette de charte et de composants

**P2-15 · Un token est contourné par une valeur écrite en dur.** `LoginPage.tsx:205` : `shadow-[0_18px_40px_-26px_oklch(0.3_0.079_166/70%)]` — une ombre arbitraire, en littéral `oklch`, alors que `index.css:133` définit `.card-shadow` et que la charte interdit les valeurs brutes dans les composants.
→ *Règles :* `color-semantic` — « Define semantic color tokens… not raw hex in components » ; `elevation-consistent` — « Use a consistent elevation/shadow scale… avoid random shadow values ».
→ *Correction :* `--elevation-cta` dans `index.css`, appliqué par une classe.

**P2-16 · Le rail et ses libellés ne sont pas des composants réutilisables.** Chaque page recopie le même conteneur et le même appel (`SystemConsolePage.tsx:80-81`, `SystemSupervisionPage.tsx:42-43`, `SystemSessionsPage.tsx:91-92`, `SystemMetierPage.tsx:32-33`, `SystemPermissionsPage.tsx:31-32`, `SystemDataPage.tsx:128-129`), en passant `activePath` à la main. Une page oubliée, et le module courant n'est plus identifiable — c'est exactement la règle `nav-state-active`.
→ *Règles :* `nav-state-active` — « Current location must be visually highlighted » ; `navigation-consistency`. *À ma connaissance, les six valeurs sont aujourd'hui correctes : c'est un risque de dérive, pas un défaut constaté.*
→ *Correction :* un `<ConsoleShell activePath="…">{children}</ConsoleShell>` qui rend `PageHeader`, le rail, la grille `max-w-6xl` et le `<nav>`.

**P2-17 · L'en-tête de dialogue et les `<label>` de connexion adoptent une convention typographique distincte.** `AuthShell.tsx:44` titre en `text-[2.6rem]` (41,6 px), hors de l'échelle `12/14/16/18/24/32` ; les libellés de `LoginPage.tsx:161, 179` et `SystemMfaPanels.tsx:95` sont en capitales 12 px `tracking-wide` (`text-foreground/80`) alors que ceux des dialogues (`SystemAccessActions.tsx:407, 411, 415`) sont en casse normale. Deux patrons de libellé de champ dans la même application.
→ *Règles :* `font-scale` ; `text-styles-system` ; `color-semantic` (le `text-foreground/80` est un quatrième ton de texte non déclaré — cf. P1-22).
→ *Correction :* un composant `<FieldLabel>` unique, en casse normale, 12–14 px.

**P2-18 · Une navigation interne sort du routeur.** `LoginPage.tsx:154` : `<a href="/forgot-password">` provoque un rechargement complet, alors que l'application navigue partout par `wouter` (et que `:123` utilise bien un `<button>` + état). L'itinéraire de réinitialisation, lui, ne relit pas l'état applicatif.
→ *Règle :* `navigation-consistency` — « Navigation placement must stay the same across all pages » ; `back-behavior`.
→ *Correction :* `<Link href="/forgot-password">` de wouter.

**P2-19 · Le panneau de fermeture d'un dialogue se distingue par `focus:` et non `focus-visible:`, avec un anneau à 1,92:1.** `ui/dialog.tsx:137` utilise `focus:ring-ring focus:ring-offset-2` : l'anneau apparaît donc aussi au clic souris (à contre-courant de tout le reste de l'application, qui emploie `focus-visible:`), et, pris isolément, `ring-ring/50` tel qu'utilisé par les primitives composites à **1,92:1** sur le fond — sous le seuil de 3:1 de `focus-appearance`. En pratique l'`outline` global (`index.css:119`) prend le relais à 4,86:1, ce qui sauve la visibilité ; je classe donc ce point en P2 et le signale comme fragile, non comme cassé.
→ *Règle :* `focus-appearance` — « Verify focus indicator area and 3:1 state contrast; visible focus alone is not enough » — **WCAG 2.2 AAA**, pas AA. À traiter comme une amélioration, pas comme une non-conformité.
→ *Correction :* `focus-visible:ring-2 focus-visible:ring-ring` (sans `/50`).

**P2-20 · L'en-tête de page et le titre du panneau se répètent.** Sur `/console/sante`, `PageHeader` rend `<h1>Santé & supervision</h1>` (`SystemSupervisionPage.tsx:32`) et le panneau rend `<h2>Santé & supervision</h2>` (`SystemSupervision.tsx:100`) — deux fois le même titre, à 40 px d'écart. Idem « Accès & comptes » (`SystemAccess.tsx:265`), « Sessions actives » (`SystemSessions.tsx:145`), « Rôles & permissions » (`SystemPermissions.tsx:104`), « Données & métier » (`SystemMetier.tsx:166`), « Données » (`SystemData.tsx:267`).
→ *Règle :* `voiceover-sr` (l'annonce par titres perd sa valeur si deux niveaux se répètent) ; `whitespace-balance`.
→ *Correction :* le `<h2>` du panneau porte l'information *de contenu* (« Relevé du… », « Comptes de l'instance ») et non le nom de l'écran, déjà donné par `PageHeader`.

**P2-21 · Une date locale est présentée comme une heure de Conakry.** `SystemConsoleDashboard.tsx:370` affiche « Relevé du {formatConsoleDate(now)} à {formatConsoleTime(now)} · Conakry ». Or `formatConsoleDate`/`formatConsoleTime` (`:138-144`) appellent `toLocaleDateString`/`toLocaleTimeString` **sans option `timeZone`** : elles rendent l'heure locale du **navigateur**. Le suffixe « · Conakry » affirme une origine que le code ne garantit pas — un opérateur en déplacement, ou sur un poste mal configuré, lit une heure fausse présentée comme celle de l'entreprise. Le même écran mêle d'ailleurs, dans le panneau « Application » (`:431`), la date du client à la version du serveur.
→ *Règle :* `number-formatting` — « Use locale-aware formatting for numbers, dates, currencies » ; grille de mission, « jamais de valeur inventée ».
→ *Correction :* soit `{ timeZone: "Africa/Conakry" }` dans les deux formateurs, soit retirer « · Conakry ». Ne pas laisser l'étiquette et l'implémentation se contredire.

**P2-22 · L'heure affichée ne s'actualise qu'au clic.** `now` (`SystemConsolePage.tsx:33`) est figé à la fin de `loadHealth` (`:50`) ; rien ne le rafraîchit ensuite. Le libellé « Relevé du … à … » est donc exact — mais rien à l'écran ne distingue « relevé de 3 secondes » de « relevé d'il y a 4 heures ». Sur une console de supervision, c'est l'information la plus importante qui manque.
→ *Règle :* `empty-states` / `loading-states` par analogie ; `timeout-feedback` — « Request timeout must show clear feedback ».
→ *Correction :* afficher l'âge relatif (« il y a 12 min ») recalculé toutes les 30 s, avec bascule vers « relevé périmé » au-delà d'un seuil.

**P2-23 · Un `Interval` de 1 s re-rend toute la page de connexion.** `LoginPage.tsx:51-65` fait tourner un `setInterval(tick, 1000)` qui appelle `setSecondsRemaining` à chaque seconde, re-rendant `LoginPage` et `AuthShell` en entier, pour un texte qui ne change que toutes les secondes de *valeur affichée* mais dont le rendu ne dépend de rien d'autre. *(Je ne force ici aucune règle du jeu de données : je le signale comme dette de performance, à confirmer par profilage.)* Par ailleurs, le compte à rebours n'étant pas dans une région live — ce qui est le bon choix, une annonce par seconde serait insupportable — l'expiration n'est annoncée qu'au moment du basculement, via le `role="alert"` de `:198`, ce qui est correct.

---

## 8. Ce qui est déjà bon

À conserver tel quel — et à ne pas casser en corrigeant le reste.

1. **La règle « aucune valeur inventée » est tenue presque partout.** Les formateurs refusent explicitement de retourner 0 : `formatBytes`, `formatLatency`, `formatCount` (`SystemSupervision.tsx:44, 58, 64`) retournent « indisponible » ; `volumeCount` (`SystemData.tsx:680-682`) retourne `null` et non 0. Les écrans l'expliquent en toutes lettres, et le commentaire de `SystemSessions.tsx:94-96` assume le choix : « On ne prétend alors PAS qu'il n'y a aucune session ».
2. **Les garde-fous des gestes destructifs sont exemplaires.** La suppression de compte n'active son bouton qu'après recopie exacte de l'identité (`SystemAccessActions.tsx:690, 734`), avec l'attendu dans le `<Label>` donc relié au champ (`:712-714`) ; la purge exige un export **du même périmètre** et une phrase portant le nombre exact, et le jeton devient caduc dès que la sélection change (`SystemData.tsx:247-251`).
3. **La sémantique des tableaux est amorcée.** `SystemPermissions.tsx:135` porte un `<caption className="sr-only">` ; les en-têtes ont `scope="col"` (`SystemAccess.tsx:482-488`, `SystemSessions.tsx:284-291`, `SystemPermissions.tsx:140-155`) ; les cellules de la matrice n'utilisent pas la couleur seule mais **coche vs tiret**, plus un `<span className="sr-only">Autorisé|Refusé</span>` (`SystemPermissions.tsx:83-87`) et une légende (`:182-189`). C'est le meilleur tableau du lot.
4. **Les erreurs sont annoncées.** `role="alert"` sur `DialogError` (`SystemAccessActions.tsx:154`), sur `MfaErrorNotice` (`SystemMfaPanels.tsx:123`) et sur la notice de connexion (`LoginPage.tsx:198`).
5. **Les entrées `input` sont correctement typées.** `type="email"`, `inputMode="numeric"`, `autoComplete="email" | "current-password" | "one-time-code"` (`LoginPage.tsx:167-174, 184-193` ; `SystemMfaPanels.tsx:100-112`) : claviers mobiles adaptés et gestionnaires de mots de passe fonctionnels — `accessible-authentication` est satisfait, y compris le collage.
6. **Les cibles tactiles du parcours d'authentification sont conformes.** Le bouton de connexion est en `h-12` (48 px) (`LoginPage.tsx:205`) et ceux des écrans MFA en `h-11`/`h-12` (44/48 px) (`SystemMfaPanels.tsx:192, 245, 330, 372`). *En revanche, aucun bouton des six dialogues de `/console/acces` n'atteint 44 px : ils sont tous en `h-10` (40 px) — 18 occurrences relevées de `SystemAccessActions.tsx:217` à `:863`. Cela ne les sauve donc pas de P1-5 ; je le signale ici pour éviter une lecture flatteuse.*
7. **Le mouvement réduit est traité sérieusement** (`index.css:149-151`) pour tout sauf les spinners (cf. P2-14) : animations d'entrée, `hover-lift`, `scroll-behavior`.
8. **Les états transitoires ne sont pas bâclés.** `SystemAccessActions.tsx:377-385` vide les champs à la fermeture d'un dialogue « pour qu'un mot de passe ne traîne pas à l'écran » ; `LoginPage.tsx:51-65` ramène à l'étape 1 dès l'expiration du défi, sans attendre que le serveur refuse ; `SystemAccessPage.tsx` ne garde qu'un dialogue ouvert à la fois.
9. **La séparation présentation / données est réelle et utile.** Les panneaux ne connaissent ni tRPC ni routeur, ce qui les rend testables sans navigateur — et c'est ce qui a permis cet audit par lecture.
10. **Le découpage du code est en place** : `React.lazy` par route, `Suspense` avec `DashboardLayoutSkeleton` (pas de spinner plein écran), `ErrorBoundary` (`App.tsx`).
11. **Un bouton de copie est déjà correct** : `SystemMfa.tsx:108-118`. C'est le modèle à généraliser (P0-2).
12. **Les jetons de la charte sont utilisés, pas contournés** : une seule valeur de couleur écrite en dur dans tout le périmètre de la console (`LoginPage.tsx:205`). Et `oklch` garantit une luminance perceptuellement constante entre les deux thèmes.

---

## 9. Plan d'action

### Lot 1 — Corrections rapides (aucune refonte, toutes locales)

À faire en premier : ce lot supprime les trois P0 et l'essentiel des P1.

| # | Action | Fichier(s) | Constats |
|---|---|---|---|
| 1 | Remplacer les deux `writeText` non attendus par la version `try/catch/await` de `SystemMfa.tsx:108-118`, avec un troisième état d'échec | `SystemAccessActions.tsx:219-220, 289-290` | P0-2 |
| 2 | Traiter le tri-état de l'inventaire : ne dire « rien à purger » que si l'inventaire **a été lu** | `SystemData.tsx:430-438` | P0-1 |
| 3 | `tabIndex={0}` + `role="region"` + `aria-label` sur les trois conteneurs `overflow-x-auto` | `SystemAccess.tsx:478`, `SystemSessions.tsx:280`, `SystemPermissions.tsx:133` | P0-3a |
| 4 | Supprimer le `document.title` figé au profit d'un titre par écran | les 7 `System*Page.tsx` + `index.html` | P1-2 |
| 5 | Supprimer le lien d'évitement dupliqué | `DashboardLayout.tsx:327-329` | P1-1 |
| 6 | `html { scroll-padding-top: 5rem }` | `index.css` | P1-9 |
| 7 | Bordures de champ ≥ 3:1 | `index.css:137, 139-140` | P1-4 |
| 8 | `aria-hidden` par défaut sur les icônes (composant `Icon` local) | tous les écrans | P1-7 |
| 9 | Traduire « Close », « Sidebar », « Toggle Sidebar », « Displays the mobile sidebar » | `ui/dialog.tsx:140`, `ui/sidebar.tsx:200-201, 284` | P1-19 |
| 10 | Étendre les zones sensibles : croix de dialogue, case à cocher, actions de ligne | `ui/dialog.tsx:137`, `ui/checkbox.tsx:15`, tableaux | P1-5 |
| 11 | `<th scope="row">` sur la première colonne des trois tableaux | `SystemPermissions.tsx:165`, `SystemAccess.tsx:494`, `SystemSessions.tsx:304` | P1-3 |
| 12 | Plancher de police à 12 px : 30 × `text-[10px]`, 54 × `text-[11px]`, 2 × `text-[9px]`, 9 × kicker | tous les écrans (cf. §P1-21) | P1-21 |
| 13 | Retirer les quatre modificateurs d'opacité fautifs | `SystemPermissions.tsx:85, 168, 187`, `AuthShell.tsx:55`, `SystemConsoleDashboard.tsx:171` | P1-22 |
| 14 | Retirer le littéral « Lucepress Facturation » du repli | `SystemConsoleDashboard.tsx:429` | P1-14 |
| 15 | Distinguer chargement / échec / indisponible dans les listes | `SystemData.tsx:395-400`, `SystemSupervision.tsx:213-218` | P1-13, P1-12 |
| 16 | Unifier les trois constantes d'état (`"…"`, `"—"`, `"indisponible"`) | les 5 copies de `pending` + tous les littéraux | P1-12 |
| 17 | Une seule région `role="status" aria-atomic` par écran, avec phrase complète | les 6 panneaux | P1-8 |
| 18 | Confirmation avant révocation de session | `SystemSessionsPage.tsx:66-74` | P1-18 |
| 19 | Relier les erreurs aux champs (`aria-invalid`, `aria-describedby`, focus sur le premier invalide) | `SystemAccessActions.tsx` (6 dialogues), `LoginPage.tsx:84-86` | P1-6 |
| 20 | `role="radiogroup"` + `aria-labelledby` sur `RoleChoices` ; libellé sur le champ du lien d'invitation | `SystemAccessActions.tsx:283, 332, 426, 566, 799` | P1-10, P1-11 |
| 21 | `.animate-spin` dans le bloc `prefers-reduced-motion: reduce`, avec indicateur non animé de repli | `index.css:149` | P2-14 |
| 22 | Retirer les numéros en dur des `<li>` | `SystemMfaPanels.tsx:234-238` | P2-5 |
| 23 | `MfaShell` en `<h2>` | `SystemMfa.tsx:50` | P1-20 |
| 24 | Formater les nombres avec `formatCount()` | `SystemAccess.tsx:338, 345, 352, 359`, `SystemSessions.tsx:222, 229, 236, 243` | P2-2 |
| 25 | `{ timeZone: "Africa/Conakry" }` ou retrait du suffixe « · Conakry » | `SystemConsoleDashboard.tsx:138-144, 370` | P2-21 |

**Estimation :** ~25 correctifs, presque tous d'une à trois lignes, sans changement de structure ni de données. C'est ici que se joue l'essentiel de la conformité.

### Lot 2 — Refonte ciblée (structure de page, côté client uniquement)

Ne se lance que si l'usage mobile/tablette de la console est réel — ce que je n'ai pas pu vérifier. Sinon, les items 3 et 12 du lot 1 suffisent à couvrir le besoin.

| # | Action | Justification |
|---|---|---|
| A | **Un `<ConsoleShell>`** rendant `PageHeader` + rail + grille + `nav`, avec `activePath` fourni par le routeur plutôt qu'à la main | Supprime la duplication sur 6 pages et le risque de dérive de `nav-state-active` (P2-16) |
| B | **Une seule navigation de console** : retirer le groupe « Exploitation » de `DashboardLayout.tsx:111-119` quand on est sous `/console`, **ou** supprimer le rail | P1-16, `avoid-mixed-patterns` |
| C | **Rail adaptatif** : sous `lg`, un sélecteur de module (tiroir Radix) **après** l'en-tête, fermé par défaut | P1-15 ; ~500 px de navigation rendus au contenu à 360 px |
| D | **Tableaux → listes de cartes sous `md`** : une carte par compte / session, actions sous l'identité de la ligne | P0-3b ; seul correctif qui rende réellement `/console/acces` et `/console/sessions` utilisables à 360 px |
| E | **Un système d'état unique** : `<ConsoleValue state="non-lu \| indisponible \| en-cours" value={…} />`, et une variante typographique dédiée pour l'indisponibilité dans `Metric` | P1-12, P2-2, P2-9 |
| F | **Un `StatusIcon({ tone })`** et un `<FieldLabel>` uniques | P2-1, P2-17 |
| G | **Nommer les actions destructives** : dialogue de confirmation pour toute action irréversible, avec identité de la cible, et séparation visuelle du bouton destructif | P1-18, P2-11 |
| H | **Revoir le texte des écrans denses** : `/console/donnees` (17 occurrences < 12 px, 16 paragraphes explicatifs) et `/console/acces` (18) passent difficilement le seuil où l'opérateur lit vraiment. Arbitrer entre l'information et l'écran : déplacer les explications longues dans un dépliant « Ce que cet écran garantit » | P1-21 ; la densité de prose est ici une décision de conception, pas un bug |

**Ordre recommandé :** lot 1 en entier → vérification au navigateur (les 7 points du §3) → décision sur le lot 2, en commençant par D puis C, qui sont les deux seuls points réellement bloquants pour un usage mobile.

---

## 10. Rappel de conformité de cet audit

- **Aucun fichier de code n'a été modifié.** Seul ce document a été créé : `docs/AUDIT-UI-UX-CONSOLE.md`.
- **Aucun commit, aucun push, aucun déploiement.** L'arbre de travail était propre (`git status --short` vide) sur `main` avant l'audit, et n'a reçu que ce fichier.
- Les rapports de contraste sont **calculés**, pas estimés (§1). Les 95 occurrences de police sous 12 px sont **comptées**, pas approximées. Les 48 constats distincts (3 P0, 22 P1, 23 P2) sont tous adossés à un numéro de ligne vérifié.
- Là où aucune règle de la compétence ne correspondait exactement (P2-3, P2-23), **je l'ai dit** plutôt que de forcer une citation.
