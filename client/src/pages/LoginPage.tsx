import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { MfaChallengePanel } from "@/components/SystemMfaPanels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Lock, Mail } from "lucide-react";

/** Réponse de `auth.login` : session délivrée, ou second facteur à présenter. */
type LoginResponse = { mfaRequired?: boolean; challengeToken?: string; expiresInSeconds?: number } | undefined;

/**
 * CONNEXION EN DEUX TEMPS.
 *
 * PREMIER TEMPS — e-mail + mot de passe, inchangé pour tous les comptes qui
 * n’ont pas de double authentification : `auth.login` délivre la session et
 * l’écran passe à l’application. Aucun comportement nouveau pour eux.
 *
 * SECOND TEMPS — uniquement si le compte porte une MFA. `auth.login` répond
 * alors `mfaRequired` et NE DÉLIVRE AUCUNE SESSION : le mot de passe seul ne
 * suffit plus, et rien n’est ouvert tant que le code n’a pas été validé.
 *
 * DEUX ÉCHECS SONT PRÉVUS EXPLICITEMENT (cahier des charges, étape B2) :
 *   - CODE ERRONÉ : le message s’affiche, le champ reste utilisable, on peut
 *     réessayer immédiatement ;
 *   - DÉFI EXPIRÉ : retour à la première étape, avec un message clair. Le défi
 *     vit quelques minutes, et son échéance est surveillée LOCALEMENT (compte à
 *     rebours) autant que par le serveur — un défi expiré côté serveur répond
 *     « recommencez », que cette page traduit en retour à l’étape 1.
 */
export default function LoginPage() {
  const { login, mfaLogin } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  // État du second temps. `challenge` non nul = l’écran de code remplace le
  // formulaire de connexion.
  const [challenge, setChallenge] = useState<{ token: string; expiresAt: number } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Compte à rebours du défi. À zéro, l’écran revient de lui-même à la première
  // étape : c’est le « retour à la première étape » demandé, sans attendre que
  // l’utilisateur présente un code que le serveur refuserait.
  useEffect(() => {
    if (!challenge) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((challenge.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        setChallenge(null);
        setCode("");
        setCodeError("Votre défi a expiré. Reconnectez-vous pour en ouvrir un nouveau.");
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const result = (await login({ email, password })) as LoginResponse;
      if (result?.mfaRequired && result.challengeToken) {
        // AUCUNE SESSION N’EXISTE ENCORE : on n’entre pas dans l’application.
        setChallenge({
          token: result.challengeToken,
          expiresAt: Date.now() + (result.expiresInSeconds ?? 300) * 1000,
        });
        setCode("");
        setCodeError(null);
        return;
      }
      toast.success("Connexion réussie.");
      navigate("/");
    } catch (err: any) {
      const msg = err?.message || "Une erreur est survenue.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const submitCode = async () => {
    if (!challenge) return;
    setPending(true);
    try {
      await mfaLogin({ challengeToken: challenge.token, code });
      toast.success("Connexion réussie.");
      navigate("/");
    } catch (err: any) {
      const message: string = err?.message || "Code refusé.";
      // Le serveur ne distingue pas les motifs d’expiration : il répond
      // « expiré ou plus valable ». Ce message-là ramène à l’étape 1, les
      // autres (code faux, code déjà utilisé) laissent réessayer sur place.
      if (message.includes("expiré")) {
        setChallenge(null);
        setCode("");
        setCodeError(message);
      } else {
        setCodeError(message);
      }
    } finally {
      setPending(false);
    }
  };

  if (challenge) {
    return (
      <AuthShell
        kicker="Vérification en deux étapes"
        title="Un dernier contrôle."
        description="Votre compte est protégé par une application d’authentification."
        footerLink={
          <button
            type="button"
            className="text-sm text-muted-foreground underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setCodeError(null);
            }}
          >
            Revenir à la connexion
          </button>
        }
      >
        <MfaChallengePanel
          code={code}
          onCodeChange={setCode}
          onSubmit={() => void submitCode()}
          pending={pending}
          error={codeError}
          secondsRemaining={secondsRemaining}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Espace sécurisé"
      title="Bon retour."
      description="Connectez-vous avec votre e-mail et votre mot de passe."
      footerLink={
        <a href="/forgot-password" className="text-sm text-muted-foreground underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
          Mot de passe oublié ?
        </a>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
            E-mail
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.gn"
              autoComplete="email"
              className="lucepress-field h-12 rounded-xl pl-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
            Mot de passe
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              minLength={8}
              className="lucepress-field h-12 rounded-xl pl-11"
            />
          </div>
        </div>
        {codeError && (
          <p role="alert" data-testid="login-notice" className="text-xs leading-5 text-amber-800 dark:text-amber-200">
            {codeError}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending}
          className="group h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_18px_40px_-26px_oklch(0.3_0.079_166/70%)] transition-transform duration-150 hover:-translate-y-0.5"
        >
          {pending ? "Veuillez patienter…" : "Se connecter"}
          {!pending && <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />}
        </Button>
      </form>
    </AuthShell>
  );
}
