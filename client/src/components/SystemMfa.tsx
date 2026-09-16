import {
  ConsoleMfaPanel,
  MfaEnrollIntro,
  MfaEnrollSecret,
  MfaRecoveryCodes,
} from "@/components/SystemMfaPanels";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { normalizeRecoveryCode } from "@shared/mfa";
import { useCallback, useState, type ReactNode } from "react";

/**
 * CONTENEURS DES ÉCRANS MFA — LES SEULS À PARLER AU SERVEUR.
 *
 * Les panneaux de `SystemMfaPanels.tsx` reçoivent tout par propriétés et ne
 * connaissent ni tRPC ni routeur ; c’est ici que les appels ont lieu, et nulle
 * part ailleurs. Même partage que dans la console entre son tableau de bord
 * (rendu) et sa page (données).
 *
 * CE QU’ILS NE DÉCIDENT PAS, ET CE QUI A CHANGÉ
 * ---------------------------------------------
 * L’ouverture de la console. Elle était subordonnée à un enrôlement forcé,
 * piloté par `SystemGate` : ce n’est plus le cas, la console s’ouvre au seul
 * rôle `systeme` et la double authentification s’y propose. `ConsoleMfaManager`
 * est donc devenu LE point d’entrée des deux gestes — activer quand le facteur
 * est absent, désactiver quand il est présent — et il n’impose ni l’un ni
 * l’autre : chaque étape attend un clic.
 *
 * Aucun drapeau local ne vaut autorisation, et aucun n’en refuse une : après
 * chaque geste, c’est la relecture de `mfa.status` auprès du serveur qui dit ce
 * qui est vrai, et l’interface ne fait que l’afficher.
 */

function MfaShell({
  kicker,
  title,
  children,
  onCancel,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  /** Fourni quand on peut abandonner l’enrôlement en cours sans rien casser. */
  onCancel?: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <div className="lucepress-panel rounded-[1.35rem] p-6">
        <p className="lucepress-kicker text-primary">{kicker}</p>
        <h1 className="font-editorial mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-5">{children}</div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        La double authentification reste facultative : elle est recommandée pour un compte d’administration, et rien ne
        l’impose pour ouvrir la console.
      </p>
      {onCancel && (
        <div className="mt-3 text-center">
          <Button variant="outline" onClick={onCancel} className="h-9 rounded-xl border-border font-bold">
            Annuler l’activation
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Enrôlement de la double authentification, PROPOSÉ depuis le tableau de bord.
 *
 * Trois temps — générer le secret, le confirmer, noter les codes de secours —
 * et un seul appel serveur par étape. Rien n’est conservé d’une étape à l’autre
 * au-delà de ce qui doit être affiché : le secret n’est pas mémorisé en dehors
 * de l’étape 2, et les codes de secours ne sont pas rejouables une fois notés.
 *
 * Un enrôlement abandonné en cours de route ne bloque RIEN : tant qu’aucun code
 * n’a confirmé l’enrôlement, la colonne reste « en attente » et la connexion
 * n’exige aucun second facteur (voir `server/mfa.ts`, `pending`).
 */
export function ConsoleMfaEnrollment({ onActivated, onCancel }: { onActivated: () => void; onCancel?: () => void }) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"intro" | "secret" | "codes">("intro");
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string; account: string; issuer: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const start = trpc.mfa.enrollStart.useMutation({
    onSuccess: data => {
      setEnrollment({ secret: data.secret, otpauthUri: data.otpauthUri, account: data.account, issuer: data.issuer });
      setError(null);
      setStep("secret");
    },
    onError: err => setError(err.message),
  });

  const confirm = trpc.mfa.enrollConfirm.useMutation({
    onSuccess: async data => {
      setCodes(data.recoveryCodes);
      setError(null);
      setStep("codes");
      await utils.mfa.status.invalidate();
    },
    onError: err => setError(err.message),
  });

  const copySecret = useCallback(async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
    } catch {
      // Le presse-papiers peut être indisponible (contexte non sécurisé) : le
      // secret reste affiché, l’utilisateur le recopie à la main.
      setCopied(false);
    }
  }, [enrollment]);

  if (step === "codes") {
    return (
      <MfaShell kicker="Exploitation · Sécurité" title="Codes de secours">
        <MfaRecoveryCodes codes={codes} onAcknowledge={onActivated} />
      </MfaShell>
    );
  }

  if (step === "secret" && enrollment) {
    return (
      <MfaShell kicker="Exploitation · Sécurité" title="Enrôlez votre application" onCancel={onCancel}>
        <MfaEnrollSecret
          secret={enrollment.secret}
          otpauthUri={enrollment.otpauthUri}
          account={enrollment.account}
          issuer={enrollment.issuer}
          code={code}
          onCodeChange={setCode}
          onSubmit={() => confirm.mutate({ code })}
          onCopySecret={() => void copySecret()}
          copied={copied}
          pending={confirm.isPending}
          error={error}
        />
      </MfaShell>
    );
  }

  return (
    <MfaShell kicker="Exploitation · Sécurité" title="Double authentification" onCancel={onCancel}>
      <MfaEnrollIntro onStart={() => start.mutate()} pending={start.isPending} error={error} />
    </MfaShell>
  );
}

/**
 * Panneau de gestion de sa propre MFA, affiché sur le tableau de bord de la
 * console : état, activation, désactivation.
 *
 * C’EST ICI QUE SE PREND LA DÉCISION — et seulement ici. Le panneau expose
 * l’état réel du compte, propose l’activation quand aucun second facteur n’est
 * actif, et la désactivation (avec un code valide) quand il l’est. L’activation
 * bascule sur le flux d’enrôlement existant, à l’identique : mêmes procédures,
 * mêmes écrans, mêmes codes de secours.
 */
export function ConsoleMfaManager() {
  const utils = trpc.useUtils();
  const status = trpc.mfa.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [enrolling, setEnrolling] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const disable = trpc.mfa.disable.useMutation({
    onSuccess: async () => {
      setDisableOpen(false);
      setCode("");
      setError(null);
      await utils.mfa.status.invalidate();
    },
    onError: err => setError(err.message),
  });

  if (enrolling) {
    return (
      <ConsoleMfaEnrollment
        onCancel={() => {
          setEnrolling(false);
          setError(null);
        }}
        onActivated={() => {
          // Le serveur vient de confirmer l’activation : on relit l’état, et
          // c’est CETTE relecture — pas un drapeau local — qui décide de ce que
          // le panneau affichera.
          setEnrolling(false);
          void utils.mfa.status.invalidate();
          void utils.mfa.status.refetch();
        }}
      />
    );
  }

  return (
    <ConsoleMfaPanel
      status={status.data}
      isLoading={status.isLoading}
      disableOpen={disableOpen}
      onToggleDisable={() => {
        setDisableOpen(open => !open);
        setError(null);
      }}
      onStartEnroll={() => {
        setError(null);
        setEnrolling(true);
      }}
      onRetry={() => void status.refetch()}
      code={code}
      onCodeChange={setCode}
      // Un code de secours se recopie avec des tirets et parfois en minuscules :
      // la normalisation du module partagé retire ce qui n’est pas significatif,
      // et laisse un code TOTP intact.
      onDisable={() => disable.mutate({ code: normalizeRecoveryCode(code) || code })}
      pending={disable.isPending}
      error={error}
    />
  );
}
