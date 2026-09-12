import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, ShieldAlert } from "lucide-react";

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const reset = trpc.auth.resetPassword.useMutation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell
        kicker="Lien invalide"
        title="Ce lien est incomplet."
        description="Le lien de réinitialisation ne contient pas l'identifiant nécessaire. Demandez un nouveau lien depuis la page « Mot de passe oublié »."
        footerLink={
          <a href="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
            <ArrowLeft className="h-3.5 w-3.5" />Demander un nouveau lien
          </a>
        }
      >
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/[0.04] p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <p className="text-sm leading-6 text-muted-foreground">Vérifiez que vous avez ouvert le lien complet depuis votre e-mail.</p>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        kicker="C'est fait"
        title="Mot de passe modifié."
        description="Votre nouveau mot de passe est actif. Vous pouvez vous connecter."
      >
        <div className="flex flex-col items-center gap-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <Button onClick={() => (window.location.href = "/login")} className="group h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_18px_40px_-26px_oklch(0.3_0.079_166/70%)] transition-transform duration-150 hover:-translate-y-0.5">
            Aller à la connexion
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Button>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    try {
      await reset.mutateAsync({ token, newPassword: password });
      setDone(true);
    } catch (err: any) {
      const msg = err?.message || "Une erreur est survenue.";
      toast.error(msg);
    }
  };

  return (
    <AuthShell
      kicker="Nouveau mot de passe"
      title="Choisissez votre accès."
      description="Définissez un nouveau mot de passe pour votre compte Lucepres."
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
            Nouveau mot de passe
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 8 caractères"
              autoComplete="new-password"
              minLength={8}
              className="lucepress-field h-12 rounded-xl pl-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
            Confirmer le mot de passe
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retapez le mot de passe"
              autoComplete="new-password"
              minLength={8}
              className="lucepress-field h-12 rounded-xl pl-11"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={reset.isPending}
          className="group h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_18px_40px_-26px_oklch(0.3_0.079_166/70%)] transition-transform duration-150 hover:-translate-y-0.5"
        >
          {reset.isPending ? "Enregistrement…" : "Enregistrer"}
          {!reset.isPending && <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />}
        </Button>
      </form>
    </AuthShell>
  );
}
