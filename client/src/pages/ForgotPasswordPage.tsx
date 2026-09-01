import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const forgot = trpc.forgotPassword.useMutation();

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
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">E-mail envoyé</CardTitle>
            <CardDescription>
              Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation dans quelques instants.
              Vérifiez votre boîte de réception et vos spams.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Mot de passe oublié ?</CardTitle>
          <CardDescription>
            Entrez votre adresse e-mail et nous vous enverrons un lien pour créer un nouveau mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={forgot.isLoading}>
              {forgot.isLoading ? "Envoi en cours…" : "Envoyer le lien de réinitialisation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
