import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, MailCheck, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const forgot = trpc.auth.forgotPassword.useMutation();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgot.mutateAsync({ email });
      setDone(true);
    } catch (err: any) {
      const msg = err?.message || "Une erreur est survenue.";
      toast.error(msg);
    }
  };

  if (done) {
    return (
      <AuthShell
        kicker="Demande envoyée"
        title="Regardez votre boîte."
        description="Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation dans quelques instants. Vérifiez votre boîte de réception et vos spams."
        footerLink={
          <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
            <ArrowLeft className="h-3.5 w-3.5" />Retour à la connexion
          </a>
        }
      >
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/15 bg-primary/[0.03] p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="font-editorial text-xl font-semibold">{email}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Réinitialisation"
      title="Mot de passe oublié ?"
      description="Entrez votre adresse e-mail et nous vous enverrons un lien pour créer un nouveau mot de passe."
      footerLink={
        <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
          <ArrowLeft className="h-3.5 w-3.5" />Retour à la connexion
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
        <Button
          type="submit"
          disabled={forgot.isPending}
          className="group h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_18px_40px_-26px_oklch(0.3_0.079_166/70%)] transition-transform duration-150 hover:-translate-y-0.5"
        >
          {forgot.isPending ? "Envoi en cours…" : "Envoyer le lien"}
          {!forgot.isPending && <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />}
        </Button>
      </form>
    </AuthShell>
  );
}
