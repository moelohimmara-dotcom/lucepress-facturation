CREATE TYPE "public"."authType" AS ENUM('oauth2', 'api_key', 'none');--> statement-breakpoint
CREATE TYPE "public"."canActivate" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."canApprove" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."category_btp_forage" AS ENUM('btp', 'forage', 'hydraulique', 'hygiene', 'maintenance', 'etude', 'transport', 'autre');--> statement-breakpoint
CREATE TYPE "public"."category_communication_collaboration" AS ENUM('communication', 'collaboration', 'chantier', 'comptabilite');--> statement-breakpoint
CREATE TYPE "public"."category_materiaux_main_oeuvre" AS ENUM('materiaux', 'main_oeuvre', 'transport', 'equipement', 'sous_traitance', 'autre');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."collectionStatus" AS ENUM('a_traiter', 'contacte', 'a_rappeler');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('autorise', 'refuse', 'information');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('lecture', 'ecriture', 'bidirectionnel');--> statement-breakpoint
CREATE TYPE "public"."enabled" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."identityKind" AS ENUM('immatriculee', 'en_immatriculation', 'personne_physique', 'sans_immatriculation', 'autre');--> statement-breakpoint
CREATE TYPE "public"."invoiceStage" AS ENUM('standard', 'acompte', 'solde');--> statement-breakpoint
CREATE TYPE "public"."isActive" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."isAiDraft" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."isSupported" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."kind" AS ENUM('devis', 'facture');--> statement-breakpoint
CREATE TYPE "public"."lastExecutionStatus" AS ENUM('pending', 'success', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."method" AS ENUM('especes', 'virement', 'cheque', 'mobile_money', 'autre');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."processingStatus" AS ENUM('accepted', 'rejected', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."purpose" AS ENUM('relance_facture', 'suivi_devis');--> statement-breakpoint
CREATE TYPE "public"."requiresApproval" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."requiresSecondApproval" AS ENUM('oui', 'non');--> statement-breakpoint
CREATE TYPE "public"."riskLevel" AS ENUM('faible', 'moyen', 'eleve');--> statement-breakpoint
CREATE TYPE "public"."role_admin_directeur" AS ENUM('admin', 'directeur', 'cadre', 'client');--> statement-breakpoint
CREATE TYPE "public"."role_admin_member" AS ENUM('admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."role_directeur_general_responsable_commercial" AS ENUM('directeur_general', 'responsable_commercial');--> statement-breakpoint
CREATE TYPE "public"."scope" AS ENUM('global', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."signatureStatus" AS ENUM('valid', 'invalid', 'pending');--> statement-breakpoint
CREATE TYPE "public"."status_actif_en_pause" AS ENUM('actif', 'en_pause', 'termine');--> statement-breakpoint
CREATE TYPE "public"."status_active_suspendue" AS ENUM('active', 'suspendue', 'revoquee');--> statement-breakpoint
CREATE TYPE "public"."status_active_trial" AS ENUM('active', 'trial', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."status_authorization_ready_completed" AS ENUM('authorization_ready', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."status_brouillon_a_approuver" AS ENUM('brouillon', 'a_approuver', 'active_simulation', 'suspendue', 'expiree', 'revoquee');--> statement-breakpoint
CREATE TYPE "public"."status_brouillon_a_envoyer" AS ENUM('brouillon', 'a_envoyer', 'envoye', 'accepte', 'refuse', 'partiellement_paye', 'paye', 'en_retard', 'annule');--> statement-breakpoint
CREATE TYPE "public"."status_brouillon_simulee" AS ENUM('brouillon', 'simulee', 'a_approuver', 'approuvee', 'active_simulation', 'suspendue', 'archivee');--> statement-breakpoint
CREATE TYPE "public"."status_eligible_credentials_pending" AS ENUM('eligible', 'credentials_pending', 'testing', 'active', 'degraded', 'revoked', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."status_pending_accepted" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."status_previsualise_remis_test" AS ENUM('previsualise', 'remis_test', 'annule');--> statement-breakpoint
CREATE TYPE "public"."status_queued_approved" AS ENUM('queued', 'approved', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."status_simulation_prete_remis_test" AS ENUM('simulation_prete', 'remis_test', 'bloquee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."tone" AS ENUM('courtois', 'professionnel', 'ferme', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."transport" AS ENUM('api', 'mcp');--> statement-breakpoint
CREATE TYPE "public"."type_btp_forage" AS ENUM('btp', 'forage', 'mixte');--> statement-breakpoint
CREATE TYPE "public"."type_relance_preparee_note" AS ENUM('relance_preparee', 'note', 'statut_recouvrement', 'responsable_recouvrement', 'date_rappel_recouvrement', 'email_envoye', 'statut_document');--> statement-breakpoint
CREATE TABLE "agent_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"delegationId" integer,
	"campaignId" integer,
	"actorId" integer,
	"action" varchar(100) NOT NULL,
	"target" varchar(255),
	"decision" "decision" DEFAULT 'information' NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"delegationId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"status" "status_brouillon_simulee" DEFAULT 'brouillon' NOT NULL,
	"scheduledFor" timestamp,
	"scheduleCronTaskUid" varchar(65),
	"scheduleCronExpression" varchar(80),
	"scheduleTimeZone" varchar(80) DEFAULT 'Africa/Conakry' NOT NULL,
	"nextExecutionAt" timestamp,
	"lastExecutedAt" timestamp,
	"lastExecutionStatus" "lastExecutionStatus" DEFAULT 'pending' NOT NULL,
	"eligibleCount" integer DEFAULT 0 NOT NULL,
	"preparedById" integer NOT NULL,
	"approvedById" integer,
	"approvedAt" timestamp,
	"secondApprovedById" integer,
	"secondApprovedAt" timestamp,
	"activatedById" integer,
	"suspendedById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_delegations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"purpose" "purpose" NOT NULL,
	"channel" "channel" NOT NULL,
	"tone" "tone" DEFAULT 'professionnel' NOT NULL,
	"status" "status_brouillon_a_approuver" DEFAULT 'brouillon' NOT NULL,
	"startsAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"dailyLimit" integer DEFAULT 60 NOT NULL,
	"contactCooldownDays" integer DEFAULT 7 NOT NULL,
	"requiresSecondApproval" "requiresSecondApproval" DEFAULT 'non' NOT NULL,
	"scheduleCronTaskUid" varchar(65),
	"policyVersion" integer DEFAULT 1 NOT NULL,
	"ownerId" integer NOT NULL,
	"approvedById" integer,
	"approvedAt" timestamp,
	"secondApprovedById" integer,
	"secondApprovedAt" timestamp,
	"activatedById" integer,
	"suspendedById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_message_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"campaignId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"idempotencyKey" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"contentHash" varchar(128) NOT NULL,
	"status" "status_simulation_prete_remis_test" DEFAULT 'simulation_prete' NOT NULL,
	"blockedReason" varchar(500),
	"scheduledFor" timestamp,
	"policySnapshot" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_message_jobs_idempotency_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "agent_operator_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "role_directeur_general_responsable_commercial" NOT NULL,
	"canApprove" "canApprove" DEFAULT 'oui' NOT NULL,
	"canActivate" "canActivate" DEFAULT 'non' NOT NULL,
	"scope" "scope" DEFAULT 'commercial' NOT NULL,
	"status" "status_active_suspendue" DEFAULT 'active' NOT NULL,
	"expiresAt" timestamp,
	"grantedById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_operator_grants_user_role_unique" UNIQUE("userId","role")
);
--> statement-breakpoint
CREATE TABLE "agent_test_email_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"campaignId" integer NOT NULL,
	"messageJobId" integer NOT NULL,
	"testRecipient" varchar(255) DEFAULT 'Boîte de test Lucepress' NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"status" "status_previsualise_remis_test" DEFAULT 'previsualise' NOT NULL,
	"runKey" varchar(255) NOT NULL,
	"deliveredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_test_email_deliveries_run_key_unique" UNIQUE("runKey")
);
--> statement-breakpoint
CREATE TABLE "client_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"documentId" integer,
	"type" "type_relance_preparee_note" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"contentType" varchar(120) NOT NULL,
	"size" integer NOT NULL,
	"storageKey" varchar(512) NOT NULL,
	"storageUrl" varchar(512) NOT NULL,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"companyName" varchar(180) NOT NULL,
	"contactName" varchar(180),
	"email" varchar(320),
	"phone" varchar(64),
	"address" text,
	"taxId" varchar(100),
	"identityKind" "identityKind" DEFAULT 'immatriculee' NOT NULL,
	"registrationNumber" varchar(100),
	"notes" text,
	"defaultDiscountPercent" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"legalName" varchar(180) DEFAULT 'Lucepress' NOT NULL,
	"legalAddress" text,
	"phone" varchar(64),
	"email" varchar(320),
	"website" varchar(255),
	"identityKind" "identityKind" DEFAULT 'immatriculee' NOT NULL,
	"taxId" varchar(100),
	"registrationNumber" varchar(100),
	"bankName" varchar(180),
	"accountName" varchar(180),
	"accountNumber" varchar(120),
	"iban" varchar(120),
	"swift" varchar(32),
	"paymentInstructions" text,
	"documentFooter" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1.00' NOT NULL,
	"unit" varchar(30) DEFAULT 'unité' NOT NULL,
	"unitPrice" bigint DEFAULT 0 NOT NULL,
	"taxRate" integer DEFAULT 0 NOT NULL,
	"lineTotal" bigint DEFAULT 0 NOT NULL,
	"serviceId" integer,
	CONSTRAINT "document_lines_document_position_unique" UNIQUE("documentId","position")
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"kind" "kind" NOT NULL,
	"lastValue" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_sequences_kind_unique" UNIQUE("kind")
);
--> statement-breakpoint
CREATE TABLE "document_share_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"recipientEmail" varchar(320),
	"createdById" integer,
	"expiresAt" timestamp NOT NULL,
	"revokedAt" timestamp,
	"lastAccessAt" timestamp,
	"accessCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_share_links_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"kind" "kind" NOT NULL,
	"number" varchar(80) NOT NULL,
	"clientId" integer NOT NULL,
	"projectId" integer,
	"relatedDocumentId" integer,
	"invoiceStage" "invoiceStage" DEFAULT 'standard' NOT NULL,
	"status" "status_brouillon_a_envoyer" DEFAULT 'brouillon' NOT NULL,
	"issueDate" date NOT NULL,
	"dueDate" date,
	"validUntil" date,
	"depositPercent" integer,
	"depositDueDate" date,
	"balanceDueDate" date,
	"discountPercent" integer DEFAULT 0 NOT NULL,
	"discountAmount" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'GNF' NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"taxTotal" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"isAiDraft" "isAiDraft" DEFAULT 'non' NOT NULL,
	"collectionStatus" "collectionStatus" DEFAULT 'a_traiter' NOT NULL,
	"collectionReminderDate" date,
	"collectionOwnerId" integer,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "documents_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"html" text NOT NULL,
	"text" text,
	"enabled" "enabled" DEFAULT 'oui' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_tenant_slug_unique" UNIQUE("tenantId","slug")
);
--> statement-breakpoint
CREATE TABLE "integration_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connectionId" integer,
	"actorId" integer,
	"action" varchar(100) NOT NULL,
	"target" varchar(255),
	"decision" "decision" DEFAULT 'information' NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"providerId" integer NOT NULL,
	"code" varchar(100) NOT NULL,
	"label" varchar(180) NOT NULL,
	"direction" "direction" NOT NULL,
	"riskLevel" "riskLevel" DEFAULT 'moyen' NOT NULL,
	"requiresApproval" "requiresApproval" DEFAULT 'oui' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_capabilities_provider_code_unique" UNIQUE("providerId","code")
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"providerId" integer NOT NULL,
	"status" "status_eligible_credentials_pending" DEFAULT 'eligible' NOT NULL,
	"grantedScopes" text,
	"secretRef" varchar(255),
	"lastHealthCheckAt" timestamp,
	"lastError" text,
	"enabledById" integer,
	"connectedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connections_provider_unique" UNIQUE("providerId")
);
--> statement-breakpoint
CREATE TABLE "integration_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connectionId" integer NOT NULL,
	"operation" varchar(100) NOT NULL,
	"idempotencyKey" varchar(255) NOT NULL,
	"payloadHash" varchar(128) NOT NULL,
	"status" "status_queued_approved" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"approvedById" integer,
	"approvedAt" timestamp,
	"approvalNote" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_jobs_idempotency_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "integration_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"connectionId" integer NOT NULL,
	"entityType" varchar(80) NOT NULL,
	"internalId" integer NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"externalVersion" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_mappings_connection_entity_internal_unique" UNIQUE("connectionId","entityType","internalId")
);
--> statement-breakpoint
CREATE TABLE "integration_oauth_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"connectionId" integer NOT NULL,
	"providerId" integer NOT NULL,
	"clientId" varchar(255) NOT NULL,
	"redirectUri" varchar(512) NOT NULL,
	"requestedScopes" text NOT NULL,
	"stateHash" varchar(128) NOT NULL,
	"status" "status_authorization_ready_completed" DEFAULT 'authorization_ready' NOT NULL,
	"error" text,
	"expiresAt" timestamp NOT NULL,
	"completedAt" timestamp,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_oauth_sessions_state_hash_unique" UNIQUE("stateHash")
);
--> statement-breakpoint
CREATE TABLE "integration_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "category_communication_collaboration" NOT NULL,
	"transport" "transport" NOT NULL,
	"documentationUrl" varchar(512),
	"authType" "authType" NOT NULL,
	"isSupported" "isSupported" DEFAULT 'oui' NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "integration_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"connectionId" integer NOT NULL,
	"externalEventId" varchar(255) NOT NULL,
	"eventType" varchar(120) NOT NULL,
	"deliveryStatus" varchar(120),
	"signatureStatus" "signatureStatus" DEFAULT 'pending' NOT NULL,
	"processingStatus" "processingStatus" DEFAULT 'accepted' NOT NULL,
	"payloadHash" varchar(128) NOT NULL,
	"summary" varchar(500),
	"error" text,
	"occurredAt" timestamp NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	CONSTRAINT "integration_webhook_events_connection_external_unique" UNIQUE("connectionId","externalEventId")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"tokenHash" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "role_admin_directeur" DEFAULT 'cadre' NOT NULL,
	"invitedBy" integer NOT NULL,
	"status" "status_pending_accepted" DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"acceptedByUser" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"tokenHash" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "payment_promises" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"promisedDate" date NOT NULL,
	"note" varchar(500),
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_promises_document_unique" UNIQUE("documentId")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"amount" bigint NOT NULL,
	"paidAt" date NOT NULL,
	"method" "method" DEFAULT 'autre' NOT NULL,
	"reference" varchar(120),
	"notes" text,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_cost_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"projectCostId" integer NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"contentType" varchar(120) NOT NULL,
	"size" integer NOT NULL,
	"storageKey" varchar(512) NOT NULL,
	"storageUrl" varchar(512) NOT NULL,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"projectId" integer NOT NULL,
	"category" "category_materiaux_main_oeuvre" NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount" bigint NOT NULL,
	"incurredAt" date NOT NULL,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"reference" varchar(80),
	"type" "type_btp_forage" NOT NULL,
	"status" "status_actif_en_pause" DEFAULT 'actif' NOT NULL,
	"location" varchar(255),
	"description" text,
	"plannedBudget" bigint DEFAULT 0 NOT NULL,
	"minimumMarginRate" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_price_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"previousUnitPrice" bigint NOT NULL,
	"nextUnitPrice" bigint NOT NULL,
	"previousTaxRate" integer NOT NULL,
	"nextTaxRate" integer NOT NULL,
	"changedById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(180) NOT NULL,
	"category" "category_btp_forage" DEFAULT 'autre' NOT NULL,
	"description" text,
	"unit" varchar(30) DEFAULT 'unité' NOT NULL,
	"defaultUnitPrice" bigint DEFAULT 0 NOT NULL,
	"defaultTaxRate" integer DEFAULT 0 NOT NULL,
	"isActive" "isActive" DEFAULT 'oui' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"role" "role_admin_member" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_user_tenant_unique" UNIQUE("userId","tenantId")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"stripeCustomerId" varchar(255),
	"trialEndsAt" timestamp,
	"status" "status_active_trial" DEFAULT 'trial' NOT NULL,
	"currency" varchar(3) DEFAULT 'GNF' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"passwordHash" varchar(255),
	"loginMethod" varchar(64),
	"role" "role_admin_directeur" DEFAULT 'cadre' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_delegationId_agent_delegations_id_fk" FOREIGN KEY ("delegationId") REFERENCES "public"."agent_delegations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_campaignId_agent_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."agent_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_campaigns" ADD CONSTRAINT "agent_campaigns_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_campaigns" ADD CONSTRAINT "agent_campaigns_delegationId_agent_delegations_id_fk" FOREIGN KEY ("delegationId") REFERENCES "public"."agent_delegations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_campaigns" ADD CONSTRAINT "agent_campaigns_preparedById_users_id_fk" FOREIGN KEY ("preparedById") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_campaigns" ADD CONSTRAINT "agent_campaigns_approvedById_users_id_fk" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_campaigns" ADD CONSTRAINT "agent_campaigns_secondApprovedById_users_id_fk" FOREIGN KEY ("secondApprovedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_campaigns" ADD CONSTRAINT "agent_campaigns_activatedById_users_id_fk" FOREIGN KEY ("activatedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_campaigns" ADD CONSTRAINT "agent_campaigns_suspendedById_users_id_fk" FOREIGN KEY ("suspendedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_approvedById_users_id_fk" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_secondApprovedById_users_id_fk" FOREIGN KEY ("secondApprovedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_activatedById_users_id_fk" FOREIGN KEY ("activatedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_suspendedById_users_id_fk" FOREIGN KEY ("suspendedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message_jobs" ADD CONSTRAINT "agent_message_jobs_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message_jobs" ADD CONSTRAINT "agent_message_jobs_campaignId_agent_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."agent_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message_jobs" ADD CONSTRAINT "agent_message_jobs_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message_jobs" ADD CONSTRAINT "agent_message_jobs_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_operator_grants" ADD CONSTRAINT "agent_operator_grants_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_operator_grants" ADD CONSTRAINT "agent_operator_grants_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_operator_grants" ADD CONSTRAINT "agent_operator_grants_grantedById_users_id_fk" FOREIGN KEY ("grantedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_test_email_deliveries" ADD CONSTRAINT "agent_test_email_deliveries_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_test_email_deliveries" ADD CONSTRAINT "agent_test_email_deliveries_campaignId_agent_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."agent_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_test_email_deliveries" ADD CONSTRAINT "agent_test_email_deliveries_messageJobId_agent_message_jobs_id_fk" FOREIGN KEY ("messageJobId") REFERENCES "public"."agent_message_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_attachments" ADD CONSTRAINT "client_attachments_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_attachments" ADD CONSTRAINT "client_attachments_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_attachments" ADD CONSTRAINT "client_attachments_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_collectionOwnerId_users_id_fk" FOREIGN KEY ("collectionOwnerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_connectionId_integration_connections_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."integration_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_capabilities" ADD CONSTRAINT "integration_capabilities_providerId_integration_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."integration_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_providerId_integration_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."integration_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_enabledById_users_id_fk" FOREIGN KEY ("enabledById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_connectionId_integration_connections_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_approvedById_users_id_fk" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_connectionId_integration_connections_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_sessions" ADD CONSTRAINT "integration_oauth_sessions_connectionId_integration_connections_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_sessions" ADD CONSTRAINT "integration_oauth_sessions_providerId_integration_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."integration_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_sessions" ADD CONSTRAINT "integration_oauth_sessions_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_events" ADD CONSTRAINT "integration_webhook_events_connectionId_integration_connections_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_attachments" ADD CONSTRAINT "project_cost_attachments_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_attachments" ADD CONSTRAINT "project_cost_attachments_projectCostId_project_costs_id_fk" FOREIGN KEY ("projectCostId") REFERENCES "public"."project_costs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_attachments" ADD CONSTRAINT "project_cost_attachments_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_price_revisions" ADD CONSTRAINT "service_price_revisions_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_price_revisions" ADD CONSTRAINT "service_price_revisions_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_price_revisions" ADD CONSTRAINT "service_price_revisions_changedById_users_id_fk" FOREIGN KEY ("changedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_audit_logs_delegation_date_idx" ON "agent_audit_logs" USING btree ("delegationId","createdAt");--> statement-breakpoint
CREATE INDEX "agent_audit_logs_campaign_date_idx" ON "agent_audit_logs" USING btree ("campaignId","createdAt");--> statement-breakpoint
CREATE INDEX "agent_audit_logs_actor_date_idx" ON "agent_audit_logs" USING btree ("actorId","createdAt");--> statement-breakpoint
CREATE INDEX "agent_campaigns_delegation_status_idx" ON "agent_campaigns" USING btree ("delegationId","status");--> statement-breakpoint
CREATE INDEX "agent_campaigns_scheduled_status_idx" ON "agent_campaigns" USING btree ("scheduledFor","status");--> statement-breakpoint
CREATE INDEX "agent_campaigns_schedule_uid_idx" ON "agent_campaigns" USING btree ("scheduleCronTaskUid");--> statement-breakpoint
CREATE INDEX "agent_delegations_owner_status_idx" ON "agent_delegations" USING btree ("ownerId","status");--> statement-breakpoint
CREATE INDEX "agent_delegations_status_expiry_idx" ON "agent_delegations" USING btree ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "agent_delegations_schedule_uid_idx" ON "agent_delegations" USING btree ("scheduleCronTaskUid");--> statement-breakpoint
CREATE INDEX "agent_message_jobs_campaign_status_idx" ON "agent_message_jobs" USING btree ("campaignId","status");--> statement-breakpoint
CREATE INDEX "agent_message_jobs_document_idx" ON "agent_message_jobs" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "agent_operator_grants_user_status_idx" ON "agent_operator_grants" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "agent_test_email_deliveries_campaign_date_idx" ON "agent_test_email_deliveries" USING btree ("campaignId","createdAt");--> statement-breakpoint
CREATE INDEX "agent_test_email_deliveries_job_idx" ON "agent_test_email_deliveries" USING btree ("messageJobId");--> statement-breakpoint
CREATE INDEX "client_activities_clientId_createdAt_idx" ON "client_activities" USING btree ("clientId","createdAt");--> statement-breakpoint
CREATE INDEX "client_attachments_clientId_idx" ON "client_attachments" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "clients_companyName_idx" ON "clients" USING btree ("companyName");--> statement-breakpoint
CREATE INDEX "document_lines_documentId_idx" ON "document_lines" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "document_share_links_document_idx" ON "document_share_links" USING btree ("documentId","revokedAt");--> statement-breakpoint
CREATE INDEX "document_share_links_tenant_expires_idx" ON "document_share_links" USING btree ("tenantId","expiresAt");--> statement-breakpoint
CREATE INDEX "documents_kind_status_idx" ON "documents" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "documents_clientId_idx" ON "documents" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "documents_dueDate_idx" ON "documents" USING btree ("dueDate");--> statement-breakpoint
CREATE INDEX "documents_related_stage_idx" ON "documents" USING btree ("relatedDocumentId","invoiceStage");--> statement-breakpoint
CREATE INDEX "documents_collection_owner_status_idx" ON "documents" USING btree ("collectionOwnerId","collectionStatus");--> statement-breakpoint
CREATE INDEX "documents_updatedAt_idx" ON "documents" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "documents_kind_updatedAt_idx" ON "documents" USING btree ("kind","updatedAt");--> statement-breakpoint
CREATE INDEX "documents_projectId_idx" ON "documents" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "email_templates_slug_idx" ON "email_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "integration_audit_logs_connection_created_idx" ON "integration_audit_logs" USING btree ("connectionId","createdAt");--> statement-breakpoint
CREATE INDEX "integration_audit_logs_actor_created_idx" ON "integration_audit_logs" USING btree ("actorId","createdAt");--> statement-breakpoint
CREATE INDEX "integration_capabilities_provider_idx" ON "integration_capabilities" USING btree ("providerId");--> statement-breakpoint
CREATE INDEX "integration_connections_status_idx" ON "integration_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_jobs_connection_status_idx" ON "integration_jobs" USING btree ("connectionId","status");--> statement-breakpoint
CREATE INDEX "integration_mappings_external_idx" ON "integration_mappings" USING btree ("connectionId","externalId");--> statement-breakpoint
CREATE INDEX "integration_oauth_sessions_connection_status_idx" ON "integration_oauth_sessions" USING btree ("connectionId","status");--> statement-breakpoint
CREATE INDEX "integration_providers_category_idx" ON "integration_providers" USING btree ("category","sortOrder");--> statement-breakpoint
CREATE INDEX "integration_webhook_events_connection_received_idx" ON "integration_webhook_events" USING btree ("connectionId","receivedAt");--> statement-breakpoint
CREATE INDEX "integration_webhook_events_signature_idx" ON "integration_webhook_events" USING btree ("signatureStatus","receivedAt");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "password_resets_user_idx" ON "password_resets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "password_resets_status_idx" ON "password_resets" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "payment_promises_date_idx" ON "payment_promises" USING btree ("promisedDate");--> statement-breakpoint
CREATE INDEX "payments_documentId_idx" ON "payments" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "payments_paidAt_idx" ON "payments" USING btree ("paidAt");--> statement-breakpoint
CREATE INDEX "project_cost_attachments_cost_idx" ON "project_cost_attachments" USING btree ("projectCostId");--> statement-breakpoint
CREATE INDEX "project_costs_project_date_idx" ON "project_costs" USING btree ("projectId","incurredAt");--> statement-breakpoint
CREATE INDEX "project_costs_category_idx" ON "project_costs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "projects_clientId_idx" ON "projects" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_price_revisions_serviceId_createdAt_idx" ON "service_price_revisions" USING btree ("serviceId","createdAt");