import { Button } from "@/components/ui/button";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { Loader2, Lock } from "lucide-react";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

type Mode = "login" | "register";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register"
        ? { email, password, companyName }
        : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'authentification");
      setLocation("/");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface-grid flex min-h-screen items-center justify-center bg-background p-5">
      <div className="card-shadow w-full max-w-md rounded-[1.75rem] border border-border bg-card p-8 text-center sm:p-10">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <span className="font-editorial text-3xl italic">L</span>
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">{LUCEPRES_PUBLIC_PROFILE.displayName}</p>
        <h1 className="font-editorial text-3xl font-semibold leading-tight">
          {mode === "register" ? "Créez votre espace" : "Connexion"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {mode === "register"
            ? "Essai gratuit de 48 heures, sans carte bancaire. Gérez vos devis, factures et chantiers."
            : "Accédez à votre espace de gestion commerciale."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
          {mode === "register" && (
            <label className="block text-xs font-extrabold">
              Nom de l'entreprise
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                required
                minLength={2}
                className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ex. Bati Guinée SARL"
              />
            </label>
          )}
          <label className="block text-xs font-extrabold">
            Adresse e-mail
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="vous@entreprise.com"
            />
          </label>
          <label className="block text-xs font-extrabold">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Minimum 8 caractères"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "register" ? "Démarrer l'essai gratuit" : "Se connecter"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}
          className="mt-5 text-xs font-bold text-primary hover:underline"
        >
          {mode === "register" ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire"}
        </button>

        {mode === "register" && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] leading-3 text-muted-foreground">
            <Lock className="h-3 w-3" />
            Essai de 48h · Aucune carte requise · Annulez quand vous voulez
          </p>
        )}
      </div>
    </div>
  );
}
