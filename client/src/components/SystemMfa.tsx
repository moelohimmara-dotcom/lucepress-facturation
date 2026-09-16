import {
  ConsoleMfaPanel,
  MfaEnrollIntro,
  MfaEnrollSecret,
  MfaRecoveryCodes,
} from "@/components/SystemMfaPanels";
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
 * CE QU’ILS NE DÉCIDENT PAS
 * -------------------------
 * L’ouverture de la console. `ConsoleMfaEnrollment` ne rend rien d’autre que
 * l’enrôlement, et c’est `SystemGate` qui rouvre l’accès — après avoir RELU
 * `mfa.status` auprès du serveur. Aucun drapeau local ne vaut autorisation :
 * l’interface constate, elle ne décrète pas.
 *
 * `ConsoleMfaManager` ne sert qu’à gérer un second facteur DÉJÀ actif : il est
 * affiché sur le tableau de bord, donc derrière le verrou. S’il désactive la
 * MFA, la console se referme au rechargement de l’état — comportement voulu, et
 * annoncé dans le panneau.
 */

function MfaShell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <div className="lucepress-panel rounded-[1.35rem] p-6">
        <p className="lucepress-kicker text-primary">{kicker}</p>
        <h1 className="font-editorial mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-5">{children}</div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Les modules de la console restent fermés tant que la double authentification n’est pas active.
      </p>
    </div>
  );
}

/**
 * Verrou d’enrôlement de la console : remplace TOUS les modules tant que la MFA
 * n’est pas active.
 *
 * Trois temps — générer le secret, le confirmer, noter les codes de secours —
 * et un seul appel serveur par étape. Rien n’est conservé d’une étape à l’autre
 * au-delà de ce qui doit être affiché : le secret n’est pas mémorisé en dehors
 * de l’étape 2, et les codes de secours ne sont pas rejouables une fois notés.
 */
export function ConsoleMfaEnrollment({ onActivated }: { onActivated: () => void }) {
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
      <MfaShell kicker="Exploitation · Sécurité" title="Enrôlez votre application">
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
    <MfaShell kicker="Exploitation · Sécurité" title="Double authentification">
      <MfaEnrollIntro onStart={() => start.mutate()} pending={start.isPending} error={error} />
    </MfaShell>
  );
}

/**
 * Panneau de gestion de sa propre MFA, affiché sur le tableau de bord de la
 * console une fois l’enrôlement fait.
 */
export function ConsoleMfaManager() {
  const utils = trpc.useUtils();
  const status = trpc.mfa.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
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

  return (
    <ConsoleMfaPanel
      status={status.data}
      isLoading={status.isLoading}
      disableOpen={disableOpen}
      onToggleDisable={() => {
        setDisableOpen(open => !open);
        setError(null);
      }}
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
