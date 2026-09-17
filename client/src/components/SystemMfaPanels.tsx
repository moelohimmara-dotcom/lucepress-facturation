import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MFA_CODE_LENGTH, MFA_ISSUER, normalizeTotpCode } from "@shared/mfa";
import {
  BadgeCheck,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  TriangleAlert,
} from "lucide-react";
import { useRef } from "react";


/**
 * ÉCRANS DE L’AUTHENTIFICATION À DEUX FACTEURS (TOTP) — PARTIES PRÉSENTATIONNELLES.
 *
 * Deux usages, deux familles :
 *   1. la CONNEXION (`MfaChallengePanel`) — le second temps de `auth.login`,
 *      quand le compte porte une MFA ;
 *   2. la CONSOLE (`MfaEnrollIntro`, `MfaEnrollSecret`, `MfaRecoveryCodes`,
 *      `ConsoleMfaPanel`) — l’enrôlement PROPOSÉ depuis le tableau de bord,
 *      puis la gestion de sa propre MFA, activation comme désactivation.
 *
 * LA MFA EST FACULTATIVE ICI, ET LES TEXTES LE DISENT
 * ---------------------------------------------------
 * Ces panneaux ont d’abord porté une obligation (« requise », « les modules
 * restent fermés »). Ce n’est plus vrai depuis que le propriétaire de
 * l’instance a demandé à garder le choix : la console s’ouvre au seul rôle
 * `systeme` (`SystemGate`), et ce qui est proposé ici ne bloque rien. Les
 * libellés disent donc le compromis — RECOMMANDÉE pour un compte
 * d’administration, JAMAIS imposée — au lieu de promettre une barrière qui
 * n’existe plus.
 *
 * POURQUOI CE FICHIER NE CONNAÎT NI tRPC NI ROUTEUR
 * ------------------------------------------------
 * Tout arrive par propriétés. Ces panneaux sont donc rendus statiquement, sans
 * réseau ni contexte React — ce dont les tests se servent pour épingler les
 * textes. Les appels serveur vivent dans `SystemMfa.tsx`, qui les conteneurs.
 * Même séparation que `SystemConsoleDashboard` (rendu) et `SystemConsolePage`
 * (données).
 *
 * AUCUN SECRET N’EST RELU EN BASE
 * --------------------------------
 * Le secret TOTP n’est affiché que le temps de l’enrôlement, et il vient de la
 * réponse d’enrôlement — jamais d’une relecture : `mfa.status` ne renvoie ni
 * secret, ni empreinte, ni code. Les codes de secours, eux aussi, ne sont
 * montrés qu’une fois (la base n’en garde que les empreintes scrypt), et
 * l’écran le dit.
 */

/** Découpe un secret base32 en groupes de quatre, pour une recopie sans faute. */
export function formatSecretForDisplay(secret: string): string {
  const normalized = secret.replace(/[\s-]/g, "").toUpperCase();
  const groups: string[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    groups.push(normalized.slice(index, index + 4));
  }
  return groups.join(" ");
}

/** Compte à rebours lisible : « 4 min 12 s ». */
export function formatRemainingTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${rest.toString().padStart(2, "0")} s`;
}

/** Champ de code — un seul composant pour les trois écrans qui en demandent. */
export function MfaCodeField({
  id,
  value,
  onChange,
  label,
  hint,
  disabled,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
        {label}
      </Label>
      <Input
        id={id}
        // `inputMode` numérique : le clavier du téléphone propose les chiffres.
        // `autoComplete="one-time-code"` laisse le système remplir le champ.
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="123456"
        // On accepte les espaces et les tirets saisis : la normalisation les
        // retire, et un code de secours est plus long que six chiffres.
        maxLength={MFA_CODE_LENGTH + 4}
        className="lucepress-field h-12 rounded-xl font-mono text-lg tracking-[0.3em]"
      />
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Encadré d’erreur, sobre et lisible. */
export function MfaErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      data-testid="mfa-error"
      className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-900 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-xs leading-5">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Second temps de la connexion                                     */
/* ------------------------------------------------------------------ */

/**
 * Écran de saisie du second facteur, affiché À LA PLACE de l’application
 * lorsque `auth.login` répond `mfaRequired`.
 *
 * Deux issues sont prévues explicitement : le code erroné (message, le champ
 * reste rempli pour correction) et le défi expiré (`onExpired`, qui renvoie à la
 * première étape — mot de passe).
 */
export function MfaChallengePanel({
  code,
  onCodeChange,
  onSubmit,
  pending,
  error,
  secondsRemaining,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
  secondsRemaining: number;
}) {
  return (
    <form
      data-testid="mfa-challenge"
      className="space-y-5"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/50 p-3">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-5 text-muted-foreground">
          Votre mot de passe est reconnu. Saisissez maintenant le code à {MFA_CODE_LENGTH} chiffres affiché par votre
          application d’authentification, ou l’un de vos codes de secours.
        </p>
      </div>

      <MfaCodeField
        id="mfa-login-code"
        label="Code à 6 chiffres"
        value={code}
        onChange={onCodeChange}
        disabled={pending}
        autoFocus
        hint="Le code change toutes les 30 secondes. Un code de secours est aussi accepté."
      />

      {error && <MfaErrorNotice message={error} />}

      <Button
        type="submit"
        disabled={pending || normalizeTotpCode(code).length === 0}
        className="h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground"
      >
        {pending ? "Vérification…" : "Valider le code"}
        {pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Ce défi expire dans {formatRemainingTime(secondsRemaining)}. Passé ce délai, il faudra ressaisir votre mot de
        passe.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Enrôlement proposé depuis la console                             */
/* ------------------------------------------------------------------ */

/**
 * Première étape : DIRE LE COMPROMIS, puis générer un secret.
 *
 * Le ton a changé avec la règle. Cet écran annonçait « Authentification à deux
 * facteurs requise » et « les modules restent fermés — y compris pour vous » :
 * c’était vrai tant que la console était verrouillée par la MFA, et ce n’est
 * plus le cas. Promettre une barrière qui n’existe plus serait un mensonge
 * d’interface — et découragerait précisément le geste qu’on veut proposer.
 */
export function MfaEnrollIntro({ onStart, pending, error }: { onStart: () => void; pending: boolean; error: string | null }) {
  return (
    <div className="space-y-5" data-testid="mfa-enroll-intro">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-extrabold">Double authentification — recommandée, jamais imposée</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Rien ne vous y oblige : la console reste ouverte sans elle. L’activer ajoute un code à 6 chiffres à chaque
            connexion, et vous recevrez des codes de secours pour ne jamais rester bloqué. Vous pourrez la désactiver
            plus tard, avec un code valide.
          </p>
        </div>
      </div>

      <ol className="space-y-2 text-sm leading-6 text-muted-foreground">
        <li>1. Installez une application d’authentification (Google Authenticator, Authy, FreeOTP…).</li>
        <li>2. Enregistrez le compte à partir du secret qui s’affichera à l’étape suivante.</li>
        <li>3. Saisissez le code à {MFA_CODE_LENGTH} chiffres qu’elle produit pour confirmer.</li>
      </ol>

      {error && <MfaErrorNotice message={error} />}

      <Button
        onClick={onStart}
        disabled={pending}
        className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground"
      >
        {pending ? "Préparation…" : "Générer mon secret"}
        {pending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <KeyRound className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}

/** Seconde étape : le secret, l’URI, puis le premier code de confirmation. */
export function MfaEnrollSecret({
  secret,
  otpauthUri,
  account,
  issuer = MFA_ISSUER,
  code,
  onCodeChange,
  onSubmit,
  pending,
  error,
}: {
  secret: string;
  otpauthUri: string;
  account: string;
  issuer?: string;
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}) {
  const secretRef = useRef<HTMLElement | null>(null);

  return (
    <form
      data-testid="mfa-enroll-secret"
      className="space-y-5"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Secret à recopier</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code
            ref={secretRef}
            data-testid="mfa-secret"
            className="flex-1 break-all rounded-xl bg-secondary px-3 py-2 font-mono text-sm font-bold tracking-[0.18em] text-foreground"
          >
            {formatSecretForDisplay(secret)}
          </code>
          {/*
            Le bouton partagé copie le secret BRUT (celui de l’URI), pas sa
            présentation par groupes de quatre, et n’annonce « Copié » que si la
            copie a réellement eu lieu ; sinon il sélectionne le secret affiché.
          */}
          <CopyButton value={secret} targetRef={secretRef} className="h-9 rounded-xl border-border text-xs font-bold" testId="mfa-secret-copy" />
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Dans votre application : « Ajouter un compte » → « Saisir une clé de configuration », puis collez ce secret.
          Compte à nommer : <span className="font-mono">{account}</span> (service {issuer}).
        </p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Certaines applications acceptent aussi le lien complet :{" "}
          <span className="break-all font-mono text-[11px] text-foreground/70">{otpauthUri}</span>
        </p>
      </div>

      <MfaCodeField
        id="mfa-enroll-code"
        label="Premier code de confirmation"
        value={code}
        onChange={onCodeChange}
        disabled={pending}
        autoFocus
        hint="Le code courant de votre application — celui qui change toutes les 30 secondes."
      />

      {error && <MfaErrorNotice message={error} />}

      <Button
        type="submit"
        disabled={pending || normalizeTotpCode(code).length !== MFA_CODE_LENGTH}
        className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground"
      >
        {pending ? "Activation…" : "Activer la double authentification"}
        {pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
      </Button>
    </form>
  );
}

/** Troisième étape : les codes de secours, montrés UNE SEULE FOIS. */
export function MfaRecoveryCodes({ codes, onAcknowledge }: { codes: readonly string[]; onAcknowledge: () => void }) {
  return (
    <div className="space-y-5" data-testid="mfa-recovery-codes">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/50 p-4">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-extrabold">Double authentification active</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Voici vos {codes.length} codes de secours. Ils ne seront plus jamais affichés : la base n’en conserve que
            des empreintes, personne — pas même l’administrateur système — ne peut les relire.
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {codes.map((entry, index) => (
          <li
            key={entry}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
            data-testid={`mfa-recovery-code-${index + 1}`}
          >
            <span className="font-mono text-[10px] font-bold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <span className="font-mono text-sm font-bold tracking-[0.12em]">{entry}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-5 text-muted-foreground">
        Notez-les maintenant, sur un support hors ligne. Un code de secours remplace le code à 6 chiffres, et il ne
        sert qu’une fois.
      </p>

      <Button onClick={onAcknowledge} className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground">
        J’ai noté mes codes de secours
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Gestion de sa MFA depuis la console                              */
/* ------------------------------------------------------------------ */

export type ConsoleMfaStatus = {
  readable: boolean;
  enabled: boolean;
  pending: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
};

/**
 * État lisible d’un compte au regard de la MFA.
 *
 * Le libellé NOMME le facteur (« MFA : … ») au lieu de laisser un « Active »
 * flottant : c’est la formulation demandée pour la console, et elle évite
 * qu’un état se lise comme celui d’autre chose.
 */
export function mfaStatusSummary(status: ConsoleMfaStatus | undefined): { label: string; tone: "ok" | "warn" | "down" } {
  if (!status || !status.readable) return { label: "MFA : état inconnu", tone: "warn" };
  if (status.enabled) return { label: "MFA : activée", tone: "ok" };
  if (status.pending) return { label: "MFA : enrôlement inachevé", tone: "warn" };
  return { label: "MFA : non activée", tone: "down" };
}

/**
 * Panneau « Ma double authentification » de la console — état, activation,
 * codes restants, désactivation.
 *
 * LA MFA N’EST PAS UN VERROU, ET LE PANNEAU LE DIT
 * -----------------------------------------------
 * Il a d’abord géré un second facteur DÉJÀ actif, l’activation étant imposée
 * par la garde de la console. Ce n’est plus le cas : c’est donc ici, et nulle
 * part ailleurs, que le compte système décide — « Activer la double
 * authentification » quand elle ne l’est pas, « Désactiver » quand elle l’est.
 * Les textes annoncent la recommandation sans jamais promettre d’obligation :
 * la console s’ouvre sans second facteur, et rien n’est imposé.
 *
 * POURQUOI LA DÉSACTIVATION EST EN DEUX TEMPS
 * -------------------------------------------
 * Un premier clic ouvre le champ de code, le second l’envoie. C’est le principe
 * des actions destructives du cahier des charges (§ 5) : on ne retire pas un
 * second facteur sur un clic malencontreux — le serveur exige de toute façon un
 * code valide, mais le geste mérite d’être confirmé avant d’être envoyé.
 */
export function ConsoleMfaPanel({
  status,
  disableOpen,
  onToggleDisable,
  onStartEnroll,
  onRetry,
  code,
  onCodeChange,
  onDisable,
  pending,
  error,
  isLoading,
}: {
  status: ConsoleMfaStatus | undefined;
  disableOpen: boolean;
  onToggleDisable: () => void;
  /** Ouvre le flux d’enrôlement — proposé, jamais déclenché d’office. */
  onStartEnroll: () => void;
  /** Relit l’état auprès du serveur quand il n’a pas pu être lu. */
  onRetry: () => void;
  code: string;
  onCodeChange: (value: string) => void;
  onDisable: () => void;
  pending: boolean;
  error: string | null;
  isLoading: boolean;
}) {
  const summary = mfaStatusSummary(status);
  const toneClass =
    summary.tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
      : summary.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
        : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200";

  // TROIS ÉTATS, ET PAS DEUX. `known` est le seul qui autorise une action :
  // l'état a été LU, et il dit ce qui est en place. « En cours de lecture »
  // n'est pas « absent », et une requête en échec non plus — dans les deux cas
  // on ne propose rien, parce qu'un enrôlement lancé sur un compte déjà enrôlé
  // serait refusé (`deja_active`) et qu'une désactivation à l'aveugle n'a pas
  // de sens.
  const known = status?.readable === true;
  const enabled = known && status.enabled;
  const unknown = !isLoading && !known;

  return (
    <section className="lucepress-panel rounded-[1.35rem] p-5" data-testid="console-mfa-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="lucepress-kicker">Ma double authentification</h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
            Recommandée pour un compte d’administration — jamais imposée. La console reste ouverte sans elle : activer
            ou désactiver ce facteur est votre décision, et elle se prend ici.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] ${toneClass}`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {isLoading ? "Vérification…" : summary.label}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card px-3 py-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Méthode</dt>
          <dd className="mt-1 font-mono text-sm font-bold">{enabled ? "TOTP · 6 chiffres · 30 s" : "—"}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-card px-3 py-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Activée le</dt>
          <dd className="mt-1 font-mono text-sm font-bold">
            {enabled && status?.enrolledAt ? new Date(status.enrolledAt).toLocaleDateString("fr-FR") : "—"}
          </dd>
        </div>
        <div className="rounded-2xl border border-border bg-card px-3 py-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Codes de secours</dt>
          <dd className="mt-1 font-mono text-sm font-bold">
            {enabled ? `${status?.recoveryCodesRemaining} restant(s)` : "—"}
          </dd>
        </div>
      </dl>

      {enabled && status?.recoveryCodesRemaining === 0 && (
        <p className="mt-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
          Il ne reste aucun code de secours. Si vous perdez votre téléphone, plus aucun code ne pourra ouvrir votre
          session : désactivez puis réenrôlez la double authentification pour en obtenir un nouveau lot.
        </p>
      )}

      {error && <div className="mt-4"><MfaErrorNotice message={error} /></div>}

      {unknown && (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            L’état de votre double authentification n’a pas pu être lu. Rien n’est décidé à votre place : on ne
            propose ni activation ni désactivation tant qu’on ne sait pas ce qui est déjà en place.
          </p>
          <Button variant="outline" onClick={onRetry} disabled={isLoading} className="h-10 rounded-xl border-border font-bold">
            <RefreshCw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        </div>
      )}

      {!isLoading && known && !enabled && (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            Aucun second facteur n’est actif sur ce compte. L’activer ajoute un code à 6 chiffres à chaque connexion, et
            vous remet un lot de codes de secours à usage unique. Rien n’est imposé : vous pouvez commencer maintenant
            et revenir en arrière quand vous voulez, avec un code valide.
          </p>
          <Button onClick={onStartEnroll} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground">
            <ShieldPlus className="mr-2 h-4 w-4" />
            Activer la double authentification
          </Button>
        </div>
      )}

      {enabled && !disableOpen && (
        <Button
          variant="outline"
          onClick={onToggleDisable}
          disabled={isLoading}
          className="mt-4 h-10 rounded-xl border-border font-bold"
        >
          <ShieldOff className="mr-2 h-4 w-4" />
          Désactiver la double authentification
        </Button>
      )}

      {enabled && disableOpen && (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            La désactivation retire le second facteur de ce compte : la console reste ouverte, mais votre prochaine
            connexion ne demandera plus qu’un mot de passe. Présentez un code à 6 chiffres ou un code de secours.
          </p>
          <MfaCodeField id="mfa-disable-code" label="Code de confirmation" value={code} onChange={onCodeChange} disabled={pending} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={onDisable} disabled={pending} variant="destructive" className="h-10 rounded-xl font-bold">
              {pending ? "Désactivation…" : "Confirmer la désactivation"}
            </Button>
            <Button onClick={onToggleDisable} disabled={pending} variant="outline" className="h-10 rounded-xl border-border font-bold">
              Annuler
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}