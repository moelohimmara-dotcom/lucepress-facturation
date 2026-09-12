import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await login({ email, password });
      toast.success("Connexion réussie.");
      navigate("/");
    } catch (err: any) {
      const msg = err?.message || "Une erreur est survenue.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

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
