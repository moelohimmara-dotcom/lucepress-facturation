import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      if (mode === "register") {
        await register({ email, password, name: name || undefined });
        toast.success("Compte créé. Vous êtes connecté.");
      } else {
        await login({ email, password });
        toast.success("Connexion réussie.");
      }
      navigate("/");
    } catch (err: any) {
      const msg = err?.message || "Une erreur est survenue.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Lucepres — Espace sécurisé</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Connectez-vous avec votre e-mail et mot de passe."
              : "Créez votre compte pour accéder à la gestion commerciale."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nom (optionnel)</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Direction Lucepres"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.gn"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Au moins 8 caractères" : "Votre mot de passe"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foreground"
                onClick={() => setMode("register")}
              >
                Pas encore de compte ? Créer un compte
              </button>
            ) : (
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foreground"
                onClick={() => setMode("login")}
              >
                Déjà inscrit ? Se connecter
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
