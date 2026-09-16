# `docs/sql` — instructions de base préparées, à appliquer par le propriétaire

Ces fichiers sont des **instructions SQL destinées au propriétaire de la base**.
L’application ne les lit pas, ne les exécute pas, et aucun code du dépôt ne les
référence. Ils sont là pour être copiés-collés à la main.

## Ce que contient ce dossier

| Fichier | Objet |
|---|---|
| `phase3-mfa-sessions.sql` | Étape B de la Phase 3 « Protéger » : colonnes MFA sur `users`, table `sessions` révocables, table `permission_overrides`. |

## Pourquoi l’application ne peut pas appliquer elle-même ces instructions

Trois raisons, dans l’ordre de force.

**1. Aucun exécuteur de migration n’est embarqué dans le serveur.**
C’est un choix de conception, pas un oubli. La seule commande DDL du projet est
`pnpm db:push` (`drizzle-kit generate && drizzle-kit migrate`), lancée à la main
par un développeur. Aucun fichier du serveur (`server/**`) n’émet de
`CREATE`/`ALTER` : le module de supervision `systemMetrics.ts` et le module
d’accès `systemAccess.ts` ne font que des `select`, et aucune procédure tRPC
n’expose de DDL. Il n’existe donc aucun chemin de code par lequel l’application
pourrait créer ces tables — même depuis la console, qui est en lecture seule par
principe.

**2. `ALTER TABLE "users"` exige d’être propriétaire de la table.**
La connexion de l’application vient de `DATABASE_URL`. Sur PostgreSQL, modifier
une table existante exige que le rôle connecté en soit **propriétaire**. Le rôle
applicatif ne l’est typiquement pas : l’hébergeur (Supabase) crée les tables avec
un rôle propriétaire distinct, et la bonne pratique est de donner à
l’application un rôle qui ne fait que lire et écrire des **lignes**. Avec un
rôle non propriétaire, l’instruction échoue sur :

```
ERROR:  must be owner of table users     (SQLSTATE 42501, insufficient_privilege)
```

> Transparence : ce point dépend du rôle réellement configuré dans
> `DATABASE_URL`, que ce dépôt ne contient pas (et ne doit pas contenir). Il n’a
> **pas** été vérifié contre la base de production depuis ce dépôt. Si votre rôle
> applicatif est bien propriétaire du schéma, l’instruction passerait — mais
> accorder la propriété du schéma au rôle applicatif est justement ce qu’on
> cherche à éviter : c’est l’élargissement de privilèges que le passage par
> l’éditeur SQL contourne proprement.

**3. Le rôle applicatif est un rôle de données, partagé par l’application et par
son hébergement.**
Le faire exécuter du DDL lui donnerait le pouvoir de modifier le schéma au
démarrage ou à la demande — un pouvoir qu’aucun écran de l’application ne
surveille et que la console ne journalise pas. La séparation « le propriétaire
change le schéma, l’application change les données » reste la règle.

## Comment appliquer `phase3-mfa-sessions.sql`

1. Ouvrir la console de l’hébergeur de base (Supabase → **SQL Editor**).
2. Se connecter avec un rôle **propriétaire** du schéma `public`
   (sur Supabase : le rôle `postgres` du projet).
3. Créer une nouvelle requête, coller **l’intégralité** du fichier
   `phase3-mfa-sessions.sql`.
4. Exécuter. Le script est **idempotent** : tout est en `IF NOT EXISTS`, il peut
   être relancé sans erreur et sans perte de données.
5. Vérifier avec les requêtes de lecture fournies en fin de fichier
   (section « Vérification après exécution »).
6. Noter la date d’application : elle servira de repère à l’étape B.

Le fichier peut être exécuté d’un seul bloc : aucune instruction n’y est
incompatible avec une transaction. La seule exception possible dans ce projet
serait un `ALTER TYPE … ADD VALUE` — il n’y en a pas ici (le rôle `systeme` est
déjà dans l’énumération depuis la Phase 1bis), et le fichier explique en tête
comment le traiter si le besoin apparaissait.

## Ce qui reste à faire après (étape B, côté code)

L’exploitation manuelle des tables livrées :

- **MFA** : enrôlement (génération du secret, chiffrement, QR code), vérification
  du premier code, codes de secours, obligation de MFA pour l’accès à la console
  (cahier des charges § 6).
- **Sessions** : écriture d’une ligne à la connexion, mise à jour de `lastSeenAt`,
  liste des sessions actives, révocation depuis la console.
- **Permissions** : lecture des `permission_overrides`, écran d’édition, et
  application de la surcharge dans les gardes (`canAccessPath` côté UI,
  `server/_core/trpc.ts` côté serveur).
- **Console** : remplacer les mentions « non implémentée — migration requise »
  par l’état réel, une fois les fonctions livrées.

Tant que ces développements ne sont pas faits, la console continue d’annoncer
honnêtement MFA indisponible et sessions non révocables : la base seule ne
change pas le comportement de l’application.

## Annuler (à n’utiliser que volontairement)

Aucune instruction de ce dossier ne détruit de données. Si vous devez revenir en
arrière, ces ordres suffisent — **ils ne sont pas exécutés par l’application** et
ne doivent l’être que si vous le décidez explicitement :

```sql
-- À N’EXÉCUTER QUE POUR ANNULER L’ÉTAPE B.
-- Les dérogations de permissions et les sessions en cours seraient perdues.
DROP TABLE IF EXISTS "permission_overrides";
DROP TABLE IF EXISTS "sessions";

ALTER TABLE "users" DROP COLUMN IF EXISTS "mfaLastUsedStep";
ALTER TABLE "users" DROP COLUMN IF EXISTS "mfaRecoveryCodes";
ALTER TABLE "users" DROP COLUMN IF EXISTS "mfaEnrolledAt";
ALTER TABLE "users" DROP COLUMN IF EXISTS "mfaEnabled";
ALTER TABLE "users" DROP COLUMN IF EXISTS "mfaSecretCipher";
```

`users.role` et l’énumération `role_admin_directeur` ne sont pas touchées : la
valeur `systeme` reste en place, la console continuerait de fonctionner.

## Règle pour la suite

Tout nouveau fichier de ce dossier suit les mêmes règles : commenté en français,
idempotent (`IF NOT EXISTS`), sans `DROP` ni `UPDATE` destructeur, sans secret ni
donnée de production, et **jamais** exécuté par l’application.
