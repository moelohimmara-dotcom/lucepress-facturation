import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { EMAIL_TEMPLATES } from "@/shared/emailTemplates";
import { Mail, Plus, Eye, Pencil, Trash2, X, Sparkles, Wand2, FileText } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type EmailTemplate = {
  id: number;
  tenantId: number | null;
  slug: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  enabled: "oui" | "non";
};

const emptyTemplate = { name: "", subject: "", html: "", text: "" };

export default function EmailTemplatesPage() {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.emailTemplates.list.useQuery();
  const [editing, setEditing] = useState<null | EmailTemplate>(null);
  const [draft, setDraft] = useState(emptyTemplate);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateBrief, setGenerateBrief] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    if (editing) {
      setDraft({ name: editing.name, subject: editing.subject, html: editing.html, text: editing.text ?? "" });
    }
  }, [editing]);

  const createMut = trpc.emailTemplates.create.useMutation({
    onSuccess: () => { utils.emailTemplates.list.invalidate(); toast.success("Template créé."); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.emailTemplates.update.useMutation({
    onSuccess: () => { utils.emailTemplates.list.invalidate(); toast.success("Template mis à jour."); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.emailTemplates.delete.useMutation({
    onSuccess: () => { utils.emailTemplates.list.invalidate(); toast.success("Template supprimé."); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });

  const generateMut = trpc.emailTemplates.generate.useMutation({
    onSuccess: (data) => {
      setShowGenerate(false);
      setEditing({ id: 0, tenantId: null, slug: "", name: data.name, subject: data.subject, html: data.html, text: data.text, enabled: "oui" });
      setDraft({ name: data.name, subject: data.subject, html: data.html, text: data.text });
      setGenerateBrief("");
      toast.success("Modèle généré par l'IA. Vérifiez puis enregistrez.");
    },
    onError: (e) => toast.error(e.message),
  });

  function renderLocalPreview(html: string): string {
    let result = html;
    const sampleVars: Record<string, string> = {
      inviteLink: "https://lucepress-app.netlify.app/invite/abc123",
      inviterName: "Malika Morgan",
      organization: "Lucepress SARL",
      expiresAt: "15 septembre 2026",
      resetLink: "https://lucepress-app.netlify.app/reset/xyz789",
      clientName: "Mamadou Diallo",
      documentNumber: "DEV-2026-0012",
      amount: "1 500 000 GNF",
      dueDate: "30 septembre 2026",
      validUntil: "30 septembre 2026",
      paymentDate: "12 septembre 2026",
      documentLink: "https://lucepress-app.netlify.app/d/exemple",
      pdfDownloadLink: "https://lucepress-app.netlify.app/api/d/exemple.pdf",
      companyEmail: "moelohimmara@gmail.com",
      linkExpiresAt: "01 décembre 2026",
      paymentMethod: "virement bancaire",
      userName: "Malika",
      loginLink: "https://lucepress-app.netlify.app/login",
      daysOverdue: "5",
      alertTitle: "Échéance dépassée",
      recipientName: "Mamadou Diallo",
      alertBody: "La facture DEV-2026-0012 est en retard de 5 jours.",
      actionLink: "https://lucepress-app.netlify.app/alert/123",
    };
    for (const [key, value] of Object.entries(sampleVars)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
    }
    result = result.replace(/\bhref\s*=\s*(["'])[\s\S]*?\1/gi, 'href="#"');
    result = result.replace(/\bhref\s*=\s*\{\{[^}]+\}\}/gi, 'href="#"');
    return result;
  }

  function startNew() {
    setEditing({ id: 0, tenantId: null, slug: "", name: "", subject: "", html: "", text: "", enabled: "oui" });
    setDraft(emptyTemplate);
  }

  function loadCatalogTemplate(idx: number) {
    const t = EMAIL_TEMPLATES[idx];
    setShowCatalog(false);
    setEditing({ id: 0, tenantId: null, slug: t.id, name: t.name, subject: t.subject, html: t.html, text: t.text, enabled: "oui" });
    setDraft({ name: t.name, subject: t.subject, html: t.html, text: t.text });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editing.id === 0) {
      createMut.mutate({ ...draft, slug: (editing.slug || draft.name).toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    } else {
      updateMut.mutate({ id: editing.id, ...draft });
    }
  }

  function requestDelete(t: EmailTemplate) {
    if (confirm(`Supprimer le template "${t.name}" ?`)) deleteMut.mutate({ id: t.id });
  }

  function runGenerate() {
    if (generateBrief.trim().length < 8) {
      toast.error("Décrivez le modèle à générer (au moins 8 caractères).");
      return;
    }
    generateMut.mutate({ brief: generateBrief.trim() });
  }

  return (
    <DashboardLayout title="Templates d'e-mail" subtitle="Modèles préconçus, éditeur et génération par l'agent IA pour vos communications.">
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <p className="text-sm text-muted-foreground">{templates.length} template(s) enregistré(s)</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowCatalog(true)} className="gap-2">
              <FileText className="h-4 w-4" /> Modèles préconçus
            </Button>
            <Button variant="outline" onClick={() => setShowGenerate(true)} className="gap-2">
              <Sparkles className="h-4 w-4" /> Générer avec l'IA
            </Button>
            <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> Nouveau template</Button>
          </div>
        </div>

        {isLoading && <p>Chargement...</p>}

        {!isLoading && templates.length === 0 && !editing && (
          <div className="border rounded-xl p-8 text-center bg-card">
            <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Aucun template enregistré. Les modèles par défaut sont amorcés automatiquement au démarrage du serveur.
              Vous pouvez aussi choisir un modèle préconçu ou en générer un avec l'IA.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setShowCatalog(true)} className="gap-2">
                <FileText className="h-4 w-4" /> Choisir un modèle préconçu
              </Button>
              <Button variant="outline" onClick={() => setShowGenerate(true)} className="gap-2">
                <Sparkles className="h-4 w-4" /> Générer avec l'IA
              </Button>
            </div>
          </div>
        )}

        {!isLoading && templates.length > 0 && (
          <div className="grid gap-3">
            {templates.map((t) => (
              <div key={t.id} className="border rounded-xl p-4 flex items-center justify-between bg-card">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Mail className="h-4 w-4" />
                    {t.name}
                    {t.tenantId === null && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Global</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewHtml(renderLocalPreview(t.html))}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => requestDelete(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <form onSubmit={submit} className="border rounded-xl p-5 space-y-4 bg-card">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">{editing.id === 0 ? "Nouveau template" : `Modifier: ${editing.name}`}</h3>
              <button type="button" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Nom *</Label>
                <Input className="mt-1" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              </div>
              <div>
                <Label className="text-sm font-medium">Objet *</Label>
                <Input className="mt-1" value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })} required />
              </div>
              <div>
                <Label className="text-sm font-medium">HTML *</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Variables : <code>{"{{clientName}}"}</code>, <code>{"{{documentNumber}}"}</code>, <code>{"{{amount}}"}</code>, <code>{"{{documentLink}}"}</code>, <code>{"{{pdfDownloadLink}}"}</code>, <code>{"{{companyEmail}}"}</code>, <code>{"{{organization}}"}</code>, etc.
                </p>
                <Textarea className="mt-1 font-mono text-xs" rows={12} value={draft.html}
                  onChange={(e) => setDraft({ ...draft, html: e.target.value })} required />
              </div>
              <div>
                <Label className="text-sm font-medium">Texte brut (fallback)</Label>
                <Textarea className="mt-1 text-sm" rows={4} value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPreviewHtml(renderLocalPreview(draft.html))}>
                <Eye className="h-4 w-4 mr-1" /> Aperçu
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            </div>
          </form>
        )}

        {previewHtml && (
          <div className="border rounded-xl p-5 bg-card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Prévisualisation</h3>
              <button onClick={() => setPreviewHtml(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="email-preview border rounded-lg bg-white overflow-hidden" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}
      </div>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Générer un modèle avec l'IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Décrivez le modèle d'e-mail souhaité (objet, ton, contenu). L'agent IA générera le HTML, l'objet et la version texte. Vous pourrez ajuster le résultat avant l'enregistrement.
            </p>
            <div>
              <Label htmlFor="brief">Description du modèle *</Label>
              <Textarea
                id="brief"
                className="mt-1"
                rows={5}
                placeholder="Ex : E-mail de remerciement après l'acceptation d'un devis, ton chaleureux, avec le nom du client et un lien vers le portail."
                value={generateBrief}
                onChange={(e) => setGenerateBrief(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Annuler</Button>
            <Button onClick={runGenerate} disabled={generateMut.isPending} className="gap-2">
              {generateMut.isPending ? (
                <><Wand2 className="h-4 w-4 animate-pulse" /> Génération...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Générer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Modèles préconçus ({EMAIL_TEMPLATES.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {EMAIL_TEMPLATES.map((t, idx) => (
              <div key={t.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.variables.slice(0, 4).map((v) => (
                      <span key={v} className="text-xs bg-muted px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>
                    ))}
                    {t.variables.length > 4 && (
                      <span className="text-xs text-muted-foreground">+{t.variables.length - 4}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setPreviewHtml(renderLocalPreview(t.html))}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => loadCatalogTemplate(idx)} className="gap-1">
                    <Plus className="h-4 w-4" /> Utiliser
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatalog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
