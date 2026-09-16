-- =====================================================================
-- Lucepress Facturation — Phase 3 « Protéger », étape B
-- MFA (TOTP), sessions révocables, surcharges de permissions
-- =====================================================================
--
-- À QUOI SERT CE FICHIER
-- ----------------------
-- L’étape A de la Phase 3 (console « Accès & comptes » et « Rôles &
-- permissions ») est en lecture seule, parce que les colonnes et tables
-- nécessaires n’existent pas encore. Ce script les crée, pour que l’étape B
-- (enrôlement MFA, révocation de session, édition de la matrice) puisse être
-- codée.
--
-- QUI DOIT L’EXÉCUTER
-- -------------------
-- Le PROPRIÉTAIRE de la base, depuis l’éditeur SQL de l’hébergeur
-- (Supabase → SQL Editor → coller → Run). Voir `docs/sql/README.md` pour la
-- raison exacte (le rôle applicatif n’est pas propriétaire des tables ; un
-- `ALTER TABLE "users"` échouerait avec « must be owner of table users »).
--
-- L’APPLICATION N’EXÉCUTE JAMAIS CE FICHIER. Aucun exécuteur de migration
-- n’est embarqué dans le serveur : la seule commande DDL du projet est
-- `pnpm db:push` (drizzle-kit), lancée à la main par un développeur.
--
-- IDEMPOTENCE
-- -----------
-- Tout est en `IF NOT EXISTS` : le script peut être relancé sans erreur ni
-- perte de données. Il ne contient AUCUN `DROP`, aucun `DELETE`, aucun
-- `UPDATE`. Il ajoute des colonnes NULLables ou dotées d’un défaut : aucune
-- ligne existante n’est réécrite (PostgreSQL 11+ ajoute un défaut constant
-- sans réécrire la table).
--
-- ORDRE
-- -----
--   1. colonnes MFA sur `users`   (la table existe déjà)
--   2. table `sessions`           (référence `users` et `tenants`)
--   3. table `permission_overrides` (référence `tenants` et `users`)
--   4. index
--   5. commentaires de colonnes
--
-- TRANSACTIONS
-- ------------
-- Aucun `ALTER TYPE … ADD VALUE` n’est nécessaire ici : l’énumération
-- `role_admin_directeur` porte déjà `systeme` depuis la Phase 1bis, et ce
-- script n’ajoute aucune valeur d’énumération. Si un jour une valeur devait
-- être ajoutée : sur PostgreSQL < 12 l’instruction est interdite dans un bloc
-- transactionnel, et sur PostgreSQL >= 12 la valeur ajoutée n’est pas
-- utilisable dans la même transaction. Elle doit donc être une instruction
-- ISOLÉE, hors `BEGIN`/`COMMIT`, exécutée avant tout usage.
--
-- Le reste du script peut, lui, être exécuté d’un seul bloc.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Authentification à deux facteurs (TOTP) sur `users`
-- ---------------------------------------------------------------------

-- Secret TOTP CHIFFRÉ côté application (AES-256-GCM, clé fournie par
-- l’environnement). La base ne doit jamais contenir de secret en clair :
-- aucune colonne de ce fichier ne stocke de valeur exploitable telle quelle.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaSecretCipher" text;

-- État d’activation. Un secret présent mais `false` = enrôlement commencé,
-- pas encore confirmé par un premier code valide.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaEnabled" boolean NOT NULL DEFAULT false;

-- Date d’enrôlement confirmé (NULL tant que la MFA n’est pas active).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaEnrolledAt" timestamp;

-- Codes de secours : tableau JSON d’EMPREINTES scrypt (`salt:hash`), jamais
-- les codes en clair — même hachage que les mots de passe, aucune dépendance
-- nouvelle. Un code consommé est retiré du tableau.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaRecoveryCodes" text;

-- Dernier code TOTP accepté, pour refuser la réutilisation d’un même code
-- dans sa fenêtre de validité (anti-rejeu).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaLastUsedStep" bigint;

COMMENT ON COLUMN "users"."mfaSecretCipher" IS
  'Secret TOTP chiffré (AES-256-GCM, clé en variable d''environnement). Jamais en clair.';
COMMENT ON COLUMN "users"."mfaEnabled" IS
  'MFA confirmée par un premier code valide. false = non enrôlée ou enrôlement inachevé.';
COMMENT ON COLUMN "users"."mfaEnrolledAt" IS
  'Horodatage de l''enrôlement MFA confirmé.';
COMMENT ON COLUMN "users"."mfaRecoveryCodes" IS
  'Tableau JSON d''empreintes scrypt des codes de secours. Jamais les codes en clair.';
COMMENT ON COLUMN "users"."mfaLastUsedStep" IS
  'Compteur de pas TOTP du dernier code accepté — anti-rejeu.';


-- ---------------------------------------------------------------------
-- 2. Sessions révocables
-- ---------------------------------------------------------------------
-- Aujourd’hui la session est un JWT autoporteur : ni listable, ni révocable
-- avant expiration. Cette table donne une session adossée à la base, ce qui
-- permet à la console d’afficher les sessions actives et d’en révoquer une.
--
-- `tokenHash` ne contient QUE l’empreinte du jeton (même principe que
-- `invitations.tokenHash` et `password_resets.tokenHash`) : une fuite de la
-- table ne permet pas de rejouer une session.

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer REFERENCES "tenants"("id") ON DELETE cascade,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "tokenHash" varchar(255) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "lastSeenAt" timestamp NOT NULL DEFAULT now(),
  "expiresAt" timestamp NOT NULL,
  "userAgent" text,
  "ip" varchar(64),
  "revokedAt" timestamp
);

COMMENT ON TABLE "sessions" IS
  'Sessions actives adossées à la base, révocables. Ne contient que l''empreinte du jeton.';
COMMENT ON COLUMN "sessions"."tokenHash" IS
  'Empreinte du jeton de session. Le jeton en clair ne circule qu''une fois, vers le client.';
COMMENT ON COLUMN "sessions"."revokedAt" IS
  'Horodatage de révocation (déconnexion à distance). NULL = session encore valable si non expirée.';

-- Un jeton ne peut correspondre qu’à une session. Index UNIQUE : la
-- contrainte est aussi la garantie d’unicité de l’empreinte.
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_tokenHash_unique" ON "sessions" ("tokenHash");

-- Sessions d’un compte, les plus récentes d’abord : écran « sessions actives ».
CREATE INDEX IF NOT EXISTS "sessions_user_lastSeen_idx" ON "sessions" ("userId", "lastSeenAt" DESC);

-- Purge des sessions expirées.
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" ("expiresAt");

-- Filtrage par tenant (le reste de l’application est tenant-scopé).
CREATE INDEX IF NOT EXISTS "sessions_tenant_idx" ON "sessions" ("tenantId");


-- ---------------------------------------------------------------------
-- 3. Surcharges de permissions (édition de la matrice)
-- ---------------------------------------------------------------------
-- La matrice de l’étape A est dérivée du code (`shared/roles.ts`) : elle est
-- en lecture seule. Pour la rendre éditable, il faut un endroit où poser la
-- dérogation — une surcharge par (tenant, rôle, capacité), qui prime sur la
-- valeur par défaut du code. Sans cette table, la seule alternative serait de
-- réécrire le code à chaque ajustement.
--
-- `capability` reprend la clé du descripteur partagé (ex. « metier.creances »).
-- Aucune contrainte de clé étrangère n’est posée : le vocabulaire des
-- capacités vit dans le code, pas en base ; une capacité inconnue est ignorée
-- à la lecture, ce qui évite qu’une suppression de code ne bloque une migration.

CREATE TABLE IF NOT EXISTS "permission_overrides" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "role" "role_admin_directeur" NOT NULL,
  "capability" varchar(120) NOT NULL,
  "allowed" boolean NOT NULL,
  "updatedBy" integer REFERENCES "users"("id") ON DELETE set null,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

COMMENT ON TABLE "permission_overrides" IS
  'Dérogations à la matrice de référence. Absence de ligne = valeur du code (shared/roles.ts).';
COMMENT ON COLUMN "permission_overrides"."allowed" IS
  'true = capacité accordée malgré le code ; false = capacité retirée malgré le code.';
COMMENT ON COLUMN "permission_overrides"."capability" IS
  'Clé de capacité du descripteur partagé (ex. « metier.creances »).';

-- Une seule dérogation par (tenant, rôle, capacité).
CREATE UNIQUE INDEX IF NOT EXISTS "permission_overrides_scope_unique"
  ON "permission_overrides" ("tenantId", "role", "capability");

-- Lecture « toutes les dérogations d’un tenant », cas d’usage principal.
CREATE INDEX IF NOT EXISTS "permission_overrides_tenant_idx" ON "permission_overrides" ("tenantId");


-- ---------------------------------------------------------------------
-- 4. Vérification après exécution (lecture seule, à lancer à part)
-- ---------------------------------------------------------------------
-- Décommentez pour contrôler le résultat :
--
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'users'
--    AND column_name LIKE 'mfa%'
--  ORDER BY column_name;
--
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public' AND table_name IN ('sessions', 'permission_overrides');
--
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public' AND tablename IN ('sessions', 'permission_overrides')
--  ORDER BY indexname;


-- ---------------------------------------------------------------------
-- 5. Ce que ce script NE fait PAS
-- ---------------------------------------------------------------------
-- * Il n’active la MFA pour PERSONNE : `mfaEnabled` arrive à false pour tous
--   les comptes, y compris l’administrateur système. L’obligation de MFA pour
--   la console (cahier des charges § 6) exige un enrôlement, donc du code.
-- * Il n’ajoute aucune contrainte « au moins un administrateur ».
-- * Il ne modifie ni `users.role`, ni `invitations`, ni aucun rôle existant.
-- * Il ne supprime rien, ne renomme rien, ne convertit rien.
--
-- Tant que l’étape B n’est pas codée, la console continue d’annoncer
-- honnêtement « MFA : non implémentée », « Sessions : non révocables ».
-- =====================================================================
