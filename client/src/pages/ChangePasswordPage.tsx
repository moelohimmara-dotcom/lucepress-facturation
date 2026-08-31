import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { KeyRound, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const MIN_LENGTH = 8;

export default function ChangePasswordPage() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Mot de passe modifié avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    },
    onError: (error) => toast.error(error.message),
  });

  const tentativeFaible = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const neCorrespondPas = confirm.length > 0 && confirm !== newPassword;
  const identique = newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tentativeFaible) return toast.error(`Le nouveau mot de passe doit faire au moins ${MIN_LENGTH} caractères.`);
    if (neCorrespondPas) return toast.error("La confirmation ne correspond pas au nouveau mot de passe.");
    if (identique) return toast.error("Le nouveau mot de passe doit être différent de l'actuel.");
    change.mutate({ currentPassword, newPassword });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-xl">
        <header className="flex flex-col gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Mon compte</p>
            <h1 className="font-editorial mt-2 text-3xl font-semibold">Changer mon mot de passe</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {user?.email ? `Connecté en tant que ${user.email}. ` : ""}
              Saisissez votre mot de passe actuel, puis choisissez-en un nouveau.
            </p>
          </div>
        </header>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" /> Sécurité du compte
            </CardTitle>
            <CardDescription>
              Le nouveau mot de passe doit comporter au moins {MIN_LENGTH} caractères. Pour plus de
              sécurité, mélangez lettres, chiffres et symboles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Mot de passe actuel</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="next">Nouveau mot de passe</Label>
                <Input
                  id="next"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                {tentativeFaible && (
                  <p role="alert" className="text-[11px] font-medium leading-4 text-destructive">
                    Trop court ({newPassword.length}/{MIN_LENGTH} caractères minimum).
                  </p>
                )}
                {identique && (
                  <p role="alert" className="text-[11px] font-medium leading-4 text-destructive">
                    Le nouveau mot de passe doit être différent de l'actuel.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                {neCorrespondPas && (
                  <p role="alert" className="text-[11px] font-medium leading-4 text-destructive">
                    Les deux champs ne correspondent pas.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={change.isPending}>
                {change.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {change.isPending ? "Modification…" : "Modifier mon mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
