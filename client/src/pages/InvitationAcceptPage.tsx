import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function InvitationAcceptPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const accept = trpc.acceptInvitation.useMutation();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Lien d'invitation invalide</CardTitle>
            <CardDescription>Ce lien ne contient pas de jeton d'invitation.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      console.log("[DEBUG_FRONT] token:", token);
      console.log("[DEBUG_FRONT] name:", name);
      console.log("[DEBUG_FRONT] password length:", password.length);
      const result = await accept.mutateAsync({ token, name, password });
      toast.success("Compte créé. Connectez-vous avec votre mot de passe.");
      window.location.href = "/login";
    } catch (err: any) {
      console.error("[DEBUG_FRONT] error:", err?.message);
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
          <CardTitle className="text-2xl">Rejoindre Lucepres</CardTitle>
          <CardDescription>
            Définissez votre nom et votre mot de passe pour activer votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Votre nom</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prénom Nom"
                autoComplete="name"
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
                placeholder="Au moins 8 caractères"
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Création en cours…" : "Activer mon compte"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
