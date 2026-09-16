import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MFA_CODE_LENGTH, MFA_ISSUER, normalizeTotpCode } from "@shared/mfa";
import {
  BadgeCheck,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
} from "lucide-react";


/**
 * ÉCRANS DE L’AUTHENTIFICATION À DEUX FACTEURS (TOTP) — PARTIES PRÉSENTATIONNELLES.
 *
 * Deux usages, deux familles :
 *   1. la CONNEXION (`MfaChallengePanel`) — le second temps de `auth.login`,
 *      quand le compte porte une MFA ;
 *   2. la CONSOLE (`MfaEnrollIntro`, `MfaEnrollSecret`, `MfaRecoveryCodes`,
 *      `ConsoleMfaPanel`) — l’enrôlement obligatoire avant d’ouvrir les modules,
 *      puis la gestion de sa propre MFA.
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
/* 2. Enrôlement obligatoire de la console                             */
/* ------------------------------------------------------------------ */

/** Première étape : expliquer POURQUOI, puis générer un secret. */
export function MfaEnrollIntro({ onStart, pending, error }: { onStart: () => void; pending: boolean; error: string | null }) {
  return (
    <div className="space-y-5" data-testid="mfa-enroll-intro">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-extrabold">Authentification à deux facteurs requise</p>
          <p className="mt-1 text-xs leading-5">
            Cette zone est réservée à l’administration système et exige un second facteur. Tant qu’il n’est pas actif,
            les modules restent fermés — y compris pour vous.
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
  onCopySecret,
  copied,
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
  onCopySecret?: () => void;
  copied?: boolean;
  pending: boolean;
  error: string | null;
}) {
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
            data-testid="mfa-secret"
            className="flex-1 break-all rounded-xl bg-secondary px-3 py-2 font-mono text-sm font-bold tracking-[0.18em] text-foreground"
          >
            {formatSecretForDisplay(secret)}
          </code>
          {onCopySecret && (
            <Button type="button" variant="outline" onClick={onCopySecret} className="h-9 rounded-xl border-border text-xs font-bold">
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied ? "Copié" : "Copier"}
            </Button>
          )}
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

/** État lisible d’un compte au regard de la MFA. */
export function mfaStatusSummary(status: ConsoleMfaStatus | undefined): { label: string; tone: "ok" | "warn" | "down" } {
  if (!status || !status.readable) return { label: "État inconnu", tone: "warn" };
  if (status.enabled) return { label: "Active", tone: "ok" };
  if (status.pending) return { label: "Enrôlement inachevé", tone: "warn" };
  return { label: "Inactive", tone: "down" };
}

/**
 * Panneau « Ma MFA » de la console — état, codes restants, désactivation.
 *
 * La désactivation est en DEUX TEMPS : un premier clic ouvre le champ de code,
 * le second l’envoie. C’est le même principe que les actions destructives du
 * cahier des charges (§ 5) : on ne retire pas un second facteur sur un clic
 * malencontreux, d’autant que la console se referme immédiatement après.
 */
export function ConsoleMfaPanel({
  status,
  disableOpen,
  onToggleDisable,
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

  return (
    <section className="lucepress-panel rounded-[1.35rem] p-5" data-testid="console-mfa-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="lucepress-kicker">Ma double authentification</h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
            Facteur exigé pour ouvrir cette console. Il reste facultatif pour les autres comptes de l’instance.
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
          <dd className="mt-1 font-mono text-sm font-bold">{status?.enabled ? "TOTP · 6 chiffres · 30 s" : "—"}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-card px-3 py-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Activée le</dt>
          <dd className="mt-1 font-mono text-sm font-bold">
            {status?.enrolledAt ? new Date(status.enrolledAt).toLocaleDateString("fr-FR") : "—"}
          </dd>
        </div>
        <div className="rounded-2xl border border-border bg-card px-3 py-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Codes de secours</dt>
          <dd className="mt-1 font-mono text-sm font-bold">
            {status?.enabled ? `${status.recoveryCodesRemaining} restant(s)` : "—"}
          </dd>
        </div>
      </dl>

      {status?.enabled && status.recoveryCodesRemaining === 0 && (
        <p className="mt-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
          Il ne reste aucun code de secours. Si vous perdez votre téléphone, plus aucun code ne pourra ouvrir votre
          session : désactivez puis réenrôlez la double authentification pour en obtenir un nouveau lot.
        </p>
      )}

      {error && <div className="mt-4"><MfaErrorNotice message={error} /></div>}

      {!disableOpen ? (
        <Button
          variant="outline"
          onClick={onToggleDisable}
          disabled={isLoading || !status?.enabled}
          className="mt-4 h-10 rounded-xl border-border font-bold"
        >
          <ShieldOff className="mr-2 h-4 w-4" />
          Désactiver la double authentification
        </Button>
      ) : (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            La désactivation ferme immédiatement l’accès à cette console : un nouveau code de confirmation sera exigé
            pour la rouvrir. Présentez un code à 6 chiffres ou un code de secours.
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