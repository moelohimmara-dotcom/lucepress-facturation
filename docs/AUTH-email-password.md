# Authentification par e-mail + mot de passe

Ce document décrit le fonctionnement de l'authentification de Lucepress
Facturation depuis la reprise en main du projet (retrait de l'OAuth Manus).

Il s'adresse à deux lecteurs : la direction, qui doit comprendre *ce qui protège
l'application* (sections 1, 2 et 7), et la personne qui reprend le code, qui a
besoin du détail technique (sections 3 à 6).

---

## 1. En une page

| Question | Réponse |
| --- | --- |
| Comment se connecte-t-on ? | Adresse e-mail + mot de passe, sur la page de connexion. |
| Où sont stockés les mots de passe ? | Dans la base, sous forme d'empreinte **scrypt** — jamais en clair. |
| Comment la session est-elle retenue ? | Un jeton **JWT** signé, déposé dans un cookie `HttpOnly`. |
| Dépendance à un service externe ? | **Aucune.** Plus d'OAuth, plus de Manus. Tout est local. |
| Qui peut créer un compte ? | Personne librement. Seul le **premier** compte peut être créé sans être connecté (amorçage). |
| Protection contre l'essai de mots de passe en masse ? | Oui : blocage progressif par compte **et** par adresse IP. |

---

## 2. Ce qui a été corrigé, et pourquoi ça comptait

Trois problèmes de sécurité ont été trouvés **en testant le serveur en ligne**,
pas en relisant le code. Ils sont corrigés et vérifiés.

### 2.1 Tout visiteur d'Internet était administrateur

Le fichier `server/_core/context.ts` déployé contenait un repli « contrôle
local » : en l'absence de session, il fabriquait un utilisateur `local-admin`
avec le rôle `admin`.

Conséquence réelle, mesurée sur le serveur : n'importe qui, sans compte et sans
mot de passe, était traité comme administrateur — donc autorisé à lire et
modifier **tous** les clients, devis et factures.

Ce repli avait été ajouté comme béquille au moment du retrait de l'OAuth Manus.
Il est devenu inutile dès la mise en place de l'authentification locale.

**Correction :** sans session valide, `user` vaut `null`. Vérifié en production :
`billing.clients.list` répond désormais `403 FORBIDDEN` à un visiteur anonyme.

> ⚠️ **Ne jamais réintroduire un « mode local » qui accorde un rôle par défaut.**
> Si la base n'a plus aucun compte, la bonne procédure est l'amorçage décrit en
> section 4.2 — pas la réouverture d'un accès anonyme privilégié.

### 2.2 N'importe qui pouvait s'auto-créer un compte administrateur

`auth.register` était une procédure publique, et la fonction `createLocalUser`
inscrivait `role: "admin"` en dur. Un inconnu pouvait donc se fabriquer un
compte administrateur depuis Internet.

**Correction :** l'inscription libre n'est possible que pour le **tout premier**
compte (voir 4.2) ; ensuite elle répond `403 FORBIDDEN`. `createLocalUser` exige
désormais un rôle explicite de la part de l'appelant.

### 2.3 Le garde-fou anti-brute-force était contournable par lot

Le plus subtil des trois, trouvé en attaquant le serveur après un premier
correctif jugé « terminé ».

L'application communique via `httpBatchLink` : le client regroupe plusieurs
appels dans **une seule** requête HTTP. Deux conséquences :

1. Le quota HTTP global (`express-rate-limit`, 120 requêtes/minute) ne voyait
   qu'**un** hit pour 20 tentatives de connexion. Il ne protégeait donc pas
   `auth.login`. C'est pourquoi le comptage vit désormais **dans la procédure**.
2. tRPC exécute les appels d'un lot **en parallèle**. La première version lisait
   le compteur (`check`) puis le mettait à jour plus tard (`recordFailure`) :
   les 20 lectures se faisaient donc toutes sur un compteur encore vierge.
   Mesure sur le serveur : **20 mots de passe testés dans une seule requête**,
   alors que le quota est de 5.

**Correction :** `check()` *réserve* la tentative — il incrémente le compteur
immédiatement, avant toute opération asynchrone. La N-ième tentative
concurrente voit donc les N-1 précédentes.

Vérification en production, même attaque rejouée :

| | Avant | Après |
| --- | --- | --- |
| Mots de passe testés dans 1 requête | 20 | **5** |
| Tentatives bloquées | 0 | **15** |

---

## 3. Comment un mot de passe est stocké

Fichier : `server/_core/password.ts`

- Algorithme : **scrypt** (fourni par le module `crypto` de Node, aucune
  dépendance externe).
- Un **sel aléatoire** est tiré pour chaque mot de passe. Deux personnes ayant
  choisi le même mot de passe ont donc des empreintes différentes.
- Format stocké en base : `sel:empreinte` (les deux en hexadécimal).
- La comparaison utilise `timingSafeEqual`, afin que le temps de réponse ne
  révèle pas *à quel caractère* la vérification a échoué.

scrypt est **volontairement lent**. C'est une propriété de sécurité : elle rend
l'essai de mots de passe en masse coûteux pour un attaquant.

> Conséquence pratique côté tests : un test qui hache de vrais mots de passe
> consomme du CPU. Le fichier `server/authLoginRoute.test.ts` simule donc
> `_core/password` — son sujet est le garde-fou, pas scrypt lui-même (déjà
> couvert ailleurs). Sans cette précaution, il affamait un test d'interface
> voisin au point de le faire échouer.

---

## 4. Les procédures d'authentification

Toutes vivent dans `server/routers.ts`, sous `auth`.

### 4.1 `auth.login` — et son second temps, `auth.mfaLogin`

1. Résolution de l'IP appelante (`_core/clientIp.ts`).
2. **Réservation** d'une tentative auprès du limiteur → si refus, `429
   TOO_MANY_REQUESTS` avec un délai d'attente en secondes.
3. Recherche du compte par e-mail.
4. Vérification du mot de passe (scrypt).
5. En cas d'échec : l'échec est confirmé au limiteur, réponse `401 UNAUTHORIZED`.
6. **Compte sans MFA** (le cas courant, inchangé) : compteur du compte purgé,
   `lastSignedIn` mis à jour, jeton JWT signé et déposé en cookie. Réponse
   `{ success: true }`.
7. **Compte avec MFA active** : **aucune session n'est délivrée** — ni cookie, ni
   ligne `sessions`, ni `lastSignedIn`. La réponse est
   `{ mfaRequired: true, challengeToken, expiresInSeconds: 300 }`.

Le message d'erreur est **identique** que l'e-mail soit inconnu ou que le mot de
passe soit faux (« E-mail ou mot de passe incorrect »). C'est délibéré : un
message distinct permettrait de deviner quelles adresses possèdent un compte.

#### Le second temps : `auth.mfaLogin({ challengeToken, code })`

Le `challengeToken` n'est **pas** une session. Il est signé avec une clé
**dérivée distincte** de celle des sessions (`_core/mfaChallenge.ts`, HKDF depuis
`JWT_SECRET`), ne porte ni `email` ni `name`, et vit **5 minutes**. Un jeton de
défi présenté comme cookie de session est refusé, et réciproquement.

| Étape | Effet |
| --- | --- |
| 1. Réservation auprès du limiteur | Indexée sur le **compte**, comme à la connexion |
| 2. Vérification du défi | Expiré, fabriqué ou d'un autre usage → `401` |
| 3. Vérification du code | Code TOTP (6 chiffres, ±1 pas) **ou** code de secours |
| 4. Anti-rejeu | Le pas consommé est écrit en base par une condition SQL atomique |
| 5. Succès | Session délivrée **exactement** comme au chemin direct |

**Point de sécurité à ne pas casser** : `auth.login` ne purge **pas** le
compteur du compte lorsqu'il répond `mfaRequired`. La réservation prise à
l'étape 2 reste comptée jusqu'à ce qu'une authentification soit **complète**.
Sinon, un attaquant connaissant le mot de passe purgerait son compteur à chaque
essai et pourrait deviner le code sans frein. Le non-respect de cette règle est
détecté par `server/mfaLoginRateLimit.test.ts`, qui utilise le vrai limiteur.

#### Où la MFA est exigée

Elle est **facultative** partout, sauf pour la console d'exploitation
(`/console`) : `systemProcedure` exige le rôle `systeme` **et** une MFA active.
Un compte système sans MFA reçoit `403` sur toutes les procédures de la console,
mais conserve l'accès à `mfa.enrollStart` / `mfa.enrollConfirm` (sous
`protectedProcedure`) — c'est ainsi qu'il se met en règle. Un compte système
sans MFA ne peut donc pas ouvrir la console : il doit d'abord s'enrôler.

### 4.2 `auth.register` — amorçage du premier compte uniquement

La procédure compte d'abord les comptes possédant un mot de passe
(`countUsersWithPassword`) :

- **0 compte** → l'inscription est autorisée, et ce premier compte reçoit
  explicitement le rôle `admin`. C'est la porte d'entrée d'une installation
  neuve.
- **1 compte ou plus** → `403 FORBIDDEN` : « L'inscription libre est fermée.
  Demandez à un administrateur de créer votre compte. »

`auth.register` est également soumis à un limiteur de débit, pour éviter qu'un
robot ne sonde cette procédure en boucle.

### 4.3 `auth.me` et `auth.logout`

- `auth.me` renvoie l'utilisateur de la session, ou `null`. **Aucun repli.**
- `auth.logout` efface le cookie de session.

---

## 5. La session (JWT)

Fichier : `server/_core/localAuth.ts`

- Jeton **JWT signé HS256** avec la clé `JWT_SECRET`, via la bibliothèque `jose`.
- Contenu : `openId`, e-mail, nom. **Jamais** le mot de passe ni son empreinte.
- Transport : cookie `HttpOnly` (illisible par JavaScript, donc à l'abri du vol
  par script injecté), `SameSite=Lax`, `Secure` en HTTPS.
- Durée : 365 jours.
- À chaque requête, `_core/context.ts` vérifie la signature **puis relit le
  compte en base**. Un compte supprimé perd donc immédiatement l'accès, même si
  son cookie est encore valide.

> `JWT_SECRET` doit être une valeur longue et aléatoire, propre au serveur. En
> développement, une valeur vide est tolérée avec un avertissement ; **en
> production, elle doit être définie** — sans elle, la signature échoue.

---

## 6. Le garde-fou anti-brute-force

Fichier : `server/_core/loginRateLimit.ts`

### Réglages par défaut

| Réglage | Valeur | Rôle |
| --- | --- | --- |
| `windowMs` | 15 min | Fenêtre d'observation. |
| `maxFailuresPerEmail` | 5 | Échecs tolérés sur **un compte**. |
| `maxFailuresPerIp` | 20 | Échecs tolérés depuis **une IP** (contre le balayage de comptes). |
| `baseBlockMs` | 1 min | Durée du premier blocage. |
| `maxBlockMs` | 1 h | Plafond de la durée de blocage. |
| `maxTrackedKeys` | 10 000 | Plafond mémoire (voir plus bas). |

### Deux compteurs, deux menaces

- **Par compte** : empêche l'essai de milliers de mots de passe sur une cible.
- **Par IP** : empêche le balayage d'un mot de passe courant sur des centaines
  de comptes (« credential stuffing »), qui n'atteindrait jamais le quota
  individuel.

### Détails qui ont demandé de l'attention

- **Seuls les échecs sont comptés.** Une connexion réussie purge le compteur du
  compte : une personne qui se trompe quatre fois puis réussit n'est pas punie.
- **Le compteur IP n'est pas purgé par un succès.** Sinon un attaquant possédant
  un compte valide remettrait son quota à zéro entre deux salves.
- **Blocage progressif.** Chaque blocage successif double l'attente (1, 2, 4…
  minutes, plafonné à 1 h). Un compteur de récidive `blocks` survit à
  l'expiration d'une peine : revenir à la charge ne fait pas repartir au minimum.
- **Normalisation de l'e-mail.** `Admin@X.com`, `admin@x.com ` et
  ` ADMIN@x.com ` alimentent un seul compteur — sinon le quota se multipliait
  par le nombre de variantes de casse.
- **Ordre des réservations : IP d'abord.** L'ordre inverse permettait à un
  balayage d'IP d'entamer le compteur d'un compte légitime — un déni de service
  contre l'utilisateur qu'on voulait protéger.
- **Plafond mémoire.** Sans limite, un attaquant créerait une entrée par e-mail
  inventé jusqu'à saturer la mémoire. Les entrées périmées sont purgées, puis
  les plus anciennes.

### Limite connue à surveiller

Les compteurs vivent **en mémoire du processus**. Deux conséquences à connaître :

1. Un redémarrage du serveur remet les compteurs à zéro.
2. Si l'application est un jour répartie sur **plusieurs instances**, chacune
   aura ses propres compteurs — le quota effectif sera multiplié par le nombre
   d'instances.

Aujourd'hui l'application tourne en **une seule instance** (`pm2`, processus
`lucepress`) : le dispositif est correct. Le jour où l'on passe à plusieurs
instances, il faudra déplacer les compteurs vers un magasin partagé (Redis ou
une table dédiée). C'est le seul point de cette page qui demandera une reprise.

---

## 7. L'adresse IP derrière le proxy

Fichier : `server/_core/clientIp.ts`

L'application est servie derrière un reverse proxy (HTTPS). Sans précaution,
Node voit l'IP **du proxy** pour tout le monde : le quota par IP deviendrait un
compteur unique partagé, et le premier attaquant bloquerait tous les
utilisateurs.

Le proxy transmet la vraie adresse dans l'en-tête `X-Forwarded-For`. Mais cet
en-tête est **fourni par le client** et peut donc être falsifié. D'où deux
règles :

1. `X-Forwarded-For` n'est lu **que si** la variable d'environnement
   `TRUST_PROXY` est définie (elle l'est sur le serveur : `TRUST_PROXY=1`).
   Sans proxy devant, l'en-tête est ignoré.
2. On retient l'entrée **écrite par notre proxy** (la dernière de la chaîne), et
   non celle que le client a pu insérer au début.

---

## 8. Créer un compte pour un collaborateur

L'inscription libre étant fermée, il n'existe pas encore d'écran
d'administration des comptes. En attendant, la création passe par un script
côté serveur (empreinte scrypt calculée avec le code de l'application) :

```bash
# Sur le serveur, depuis /home/remote/lucepress-facturation
node --import tsx -e '
import("./server/_core/password.ts").then(async ({ hashPassword }) => {
  const email = "prenom.nom@lucepress.com";
  const motDePasse = "<mot de passe fort>";
  const role = "user";              // ou "admin"
  console.log(await hashPassword(motDePasse));
});
'
```

L'empreinte obtenue est ensuite insérée dans la colonne `passwordHash` de la
table `users`, avec `loginMethod = "email"` et le rôle voulu.

> **Amélioration à prévoir :** un écran d'administration des comptes (invitation
> par e-mail, réinitialisation de mot de passe). C'est la suite logique de ce
> chantier.

---

## 9. Vérifier que tout fonctionne

### Tests automatisés

```bash
pnpm vitest run server/authLoginRateLimit.test.ts \
                server/authLoginRoute.test.ts \
                server/_core/authContextSecurity.test.ts
```

| Fichier | Ce qu'il garantit |
| --- | --- |
| `_core/authContextSecurity.test.ts` | Aucun accès privilégié sans session ; le repli `local-admin` ne peut pas revenir. |
| `authLoginRateLimit.test.ts` | Quotas, blocage progressif, normalisation, **résistance à l'attaque par lot**, plafond mémoire. |
| `authLoginRoute.test.ts` | Le garde-fou est réellement branché sur `auth.login` ; l'amorçage du premier compte fonctionne. |
| `mfa.test.ts` | Calcul TOTP (vecteurs RFC 6238), secret jamais en clair, jeton de défi qui n'est pas une session, anti-rejeu, codes de secours consommés. |
| `mfaLogin.test.ts` | **Connexion inchangée pour un compte sans MFA**, `mfaRequired` sans session, défis expirés ou fabriqués, code de secours. |
| `mfaLoginRateLimit.test.ts` | Un mot de passe connu **ne purge pas** le compteur du compte : le second facteur reste protégé de la force brute. |
| `systemConsoleMfa.test.ts` | `403` pour un compte système sans MFA, enrôlement toujours atteignable, refus muet et **journalisé**. |

### Contrôles manuels sur le serveur

```bash
# 1. Un visiteur anonyme n'est PAS administrateur -> doit afficher null
curl -s https://<domaine>/api/trpc/auth.me

# 2. Les données métier sont protégées -> doit répondre 403
curl -s -o /dev/null -w "%{http_code}\n" https://<domaine>/api/trpc/billing.clients.list

# 3. L'inscription libre est fermée -> doit répondre 403
curl -s -X POST https://<domaine>/api/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{"json":{"email":"test@exemple.com","password":"MotDePasse12345"}}'
```

---

## 10. Fichiers concernés

| Fichier | Rôle |
| --- | --- |
| `server/_core/password.ts` | Hachage et vérification scrypt. |
| `server/_core/localAuth.ts` | Signature et vérification du JWT de session. |
| `server/_core/totp.ts` | Calcul et vérification TOTP (RFC 4226/6238), sans dépendance. |
| `server/_core/mfaSecret.ts` | Chiffrement du secret TOTP au repos (AES-256-GCM, clé HKDF depuis `JWT_SECRET`). |
| `server/_core/mfaChallenge.ts` | Jeton de défi du second facteur (clé dérivée distincte de celle des sessions). |
| `server/mfa.ts` | Persistance et règles MFA : enrôlement, vérification, anti-rejeu, codes de secours, désactivation. |
| `server/_core/context.ts` | Résolution de l'utilisateur par requête. **Aucun repli.** |
| `server/_core/loginRateLimit.ts` | Garde-fou anti-brute-force (réservation atomique). |
| `server/_core/clientIp.ts` | Résolution de l'IP derrière le proxy. |
| `server/routers.ts` | Procédures `auth.login`, `auth.register`, `auth.me`, `auth.logout`. |
| `server/db.ts` | `getUserByEmail`, `createLocalUser`, `countUsersWithPassword`. |
| `client/src/pages/LoginPage.tsx` | Écran de connexion. |
| `client/src/_core/hooks/useAuth.ts` | État d'authentification côté navigateur. |

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `JWT_SECRET` | Clé de signature des sessions. **Obligatoire en production.** En dérive aussi, par HKDF, la clé qui chiffre les secrets TOTP et celle qui signe les jetons de défi MFA. **La faire tourner rend les secrets TOTP existants illisibles** : remettre à zéro les colonnes `users.mfa%` avant, sinon les comptes enrôlés ne peuvent plus présenter de code valide. |
| `TRUST_PROXY` | À définir (`1`) uniquement si un reverse proxy est en place. |
| `DATABASE_URL` | Connexion MySQL. |
