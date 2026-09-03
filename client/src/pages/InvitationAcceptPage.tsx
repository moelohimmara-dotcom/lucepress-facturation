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
      // #region agent log
      fetch('http://127.0.0.1:7581/ingest/cbc96c89-ed00-4715-9c49-6a3427fcaddd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c0039'},body:JSON.stringify({sessionId:'9c0039',runId:'pre-fix',hypothesisId:'D',location:'InvitationAcceptPage.tsx:submit',message:'client submit acceptInvitation',data:{tokenLen:token.length,tokenPrefix:token.slice(0,8),nameLen:name.trim().length,passwordLen:password.length,hrefPath:typeof window!=='undefined'?window.location.pathname:null,hasQueryToken:typeof window!=='undefined'?new URLSearchParams(window.location.search).has('token'):null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await accept.mutateAsync({ token, name, password });
      // #region agent log
      fetch('http://127.0.0.1:7581/ingest/cbc96c89-ed00-4715-9c49-6a3427fcaddd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c0039'},body:JSON.stringify({sessionId:'9c0039',runId:'pre-fix',hypothesisId:'D',location:'InvitationAcceptPage.tsx:success',message:'client accept success',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.success("Compte créé. Connectez-vous avec votre mot de passe.");
      window.location.href = "/login";
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7581/ingest/cbc96c89-ed00-4715-9c49-6a3427fcaddd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c0039'},body:JSON.stringify({sessionId:'9c0039',runId:'pre-fix',hypothesisId:'E',location:'InvitationAcceptPage.tsx:error',message:'client accept error',data:{errorMessage:String(err?.message||'').slice(0,400),errorDataCode:err?.data?.code??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
