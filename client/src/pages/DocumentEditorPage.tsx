import DashboardLayout from "@/components/DashboardLayout";
import { ClientPrefillCard } from "@/components/ClientPrefillCard";
import { Button } from "@/components/ui/button";
import { calculateDocumentTotals, formatGnf, type DocumentStatus, type EditableDocumentLine } from "@shared/billing";
import { findPrefilledClient, getPrefilledClientId } from "@shared/clientPrefill";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { calculateDocumentDiscount } from "@shared/discounts";
import { calculateQuotePaymentSchedule, validateQuotePaymentSchedule } from "@shared/paymentSchedule";
import { buildQuoteTemplateDraft, QUOTE_TEMPLATES, type QuoteTemplateCategory, type QuoteTemplateSector } from "@shared/quoteTemplates";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowLeft, Bot, Building2, Check, CheckCircle2, ChevronLeft, CircleHelp, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

type Kind = "devis" | "facture";
type EditorLine = EditableDocumentLine & { key: string };
type AiQuoteLine = { description: string; quantity: number; unit: string; unitPrice: number; taxRate: number; note: string };
type AiQuoteProposal = { title: string; projectName: string; summary: string; scope: string[]; executionTimeline: string; paymentTerms: string; validityDays: number; technicalNotes: string[]; assumptions: string[]; lines: AiQuoteLine[] };
const blankLine = (): EditorLine => ({ key: crypto.randomUUID(), description: "", quantity: 1, unit: "unité", unitPrice: 0, taxRate: 0 });
const toDateValue = (value?: Date | string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const futureDate = (days: number) => new Date(Date.now() + Math.max(1, days) * 86_400_000).toISOString().slice(0, 10);
const quoteGuideSteps = [
  { title: "Choisissez le cadre", body: "Sélectionnez d’abord le client et, si besoin, le chantier concerné." },
  { title: "Partez d’une base", body: "Un modèle BTP structure vos postes ; l’assistant peut aussi préparer un brouillon à relire." },
  { title: "Chiffrez puis relisez", body: "Vérifiez les quantités, prix et conditions avant d’enregistrer votre devis." },
] as const;
const invoiceGuideSteps = [
  { title: "Sélectionnez le client", body: "Choisissez le client facturé et, si nécessaire, le chantier lié pour garder un suivi clair." },
  { title: "Ajoutez les prestations", body: "Sélectionnez une prestation du catalogue ou saisissez une ligne ; les quantités et prix restent modifiables." },
  { title: "Vérifiez puis enregistrez", body: "Contrôlez l’échéance, le statut et le total en GNF avant d’enregistrer la facture." },
] as const;
const QUOTE_GUIDE_KEY = "lucepress-quote-editor-guide-seen";
const INVOICE_GUIDE_KEY = "lucepress-invoice-editor-guide-seen";
const QUOTE_WIZARD_STEP_KEY = "lucepress-quote-wizard-step";
type QuoteWizardStep = 0 | 1 | 2 | 3 | 4;
const quoteWizardSteps: { title: string; subtitle: string }[] = [
  { title: "Client & chantier", subtitle: "Pour qui est ce devis ?" },
  { title: "Point de départ", subtitle: "Modèle ou assistant IA" },
  { title: "Prestations & chiffrage", subtitle: "Les lignes du devis" },
  { title: "Conditions", subtitle: "Remise, échéancier, notes" },
  { title: "Vérification", subtitle: "Récapitulatif avant enregistrement" },
];

export default function DocumentEditorPage({ kind, mode }: { kind: Kind; mode: "create" | "edit" }) {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const documentId = Number(params.id);
  const suggestedClientId = typeof window === "undefined" ? "" : getPrefilledClientId(window.location.search);
  const { data: clients = [] } = trpc.billing.clients.list.useQuery();
  const { data: projects = [] } = trpc.billing.projects.list.useQuery();
  const { data: services = [] } = trpc.billing.services.list.useQuery();
  const { data: existing, isLoading: isDocumentLoading } = trpc.billing.documents.get.useQuery({ id: documentId || 1 }, { enabled: mode === "edit" && Boolean(documentId) });
  const utils = trpc.useUtils();
  const [clientId, setClientId] = useState(mode === "create" ? suggestedClientId : "");
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState<DocumentStatus>("brouillon");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditorLine[]>([blankLine()]);
  const [needDescription, setNeedDescription] = useState("");
  const [isAiDraft, setIsAiDraft] = useState(false);
  const [quoteTemplateId, setQuoteTemplateId] = useState<QuoteTemplateCategory | "">("");
  const [quoteTemplateSector, setQuoteTemplateSector] = useState<QuoteTemplateSector>("btp");
  const [showEditorGuide, setShowEditorGuide] = useState(() => mode === "create" && (typeof window === "undefined" || window.localStorage?.getItem(kind === "devis" ? QUOTE_GUIDE_KEY : INVOICE_GUIDE_KEY) !== "true"));
  const [editorGuideStep, setEditorGuideStep] = useState(0);
  const [isPaymentScheduleEnabled, setIsPaymentScheduleEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState(0);
  const [depositDueDate, setDepositDueDate] = useState("");
  const [balanceDueDate, setBalanceDueDate] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [wizardStep, setWizardStep] = useState<QuoteWizardStep>(() => {
    if (mode !== "create" || kind !== "devis" || typeof window === "undefined") return 0;
    const saved = Number(window.localStorage?.getItem(QUOTE_WIZARD_STEP_KEY));
    return saved >= 0 && saved <= 4 ? (saved as QuoteWizardStep) : 0;
  });
  const totals = useMemo(() => calculateDocumentDiscount(lines, kind === "devis" ? discountPercent : 0), [discountPercent, kind, lines]);
  const paymentSchedule = useMemo(() => isPaymentScheduleEnabled ? calculateQuotePaymentSchedule(totals.totalAfterDiscount, depositPercent) : null, [depositPercent, isPaymentScheduleEnabled, totals.totalAfterDiscount]);
  const paymentScheduleErrors = useMemo(() => isPaymentScheduleEnabled ? validateQuotePaymentSchedule({ depositPercent, depositDueDate, balanceDueDate }) : {}, [balanceDueDate, depositDueDate, depositPercent, isPaymentScheduleEnabled]);
  const visibleProjects = projects.filter(project => !clientId || project.clientId === Number(clientId));
  const selectedClient = findPrefilledClient(clients, clientId);
  const isDocumentCreation = mode === "create";
  const isQuoteCreation = isDocumentCreation && kind === "devis";
  const editorGuideSteps = kind === "devis" ? quoteGuideSteps : invoiceGuideSteps;
  const editorGuideKey = kind === "devis" ? QUOTE_GUIDE_KEY : INVOICE_GUIDE_KEY;
  const galleryTemplates = QUOTE_TEMPLATES.filter(template => template.sector === quoteTemplateSector);
  const isQuoteWizard = isQuoteCreation;
  const canAdvanceStep0 = Boolean(clientId);
  const validLines = lines.filter(line => line.description.trim().length > 0);
  const canAdvanceStep2 = validLines.length > 0;
  const canAdvanceStep3 = !isPaymentScheduleEnabled || Object.keys(paymentScheduleErrors).length === 0;
  const canSaveFromWizard = canAdvanceStep0 && canAdvanceStep2 && canAdvanceStep3;

  useEffect(() => {
    if (!existing || mode !== "edit") return;
    setClientId(String(existing.clientId)); setProjectId(existing.projectId ? String(existing.projectId) : ""); setIssueDate(toDateValue(existing.issueDate)); setDueDate(toDateValue(existing.dueDate)); setValidUntil(toDateValue(existing.validUntil)); setStatus(existing.status); setNotes(existing.notes || ""); setIsAiDraft(existing.isAiDraft === "oui"); setIsPaymentScheduleEnabled(Boolean(existing.depositPercent)); setDepositPercent(existing.depositPercent || 0); setDepositDueDate(toDateValue(existing.depositDueDate)); setBalanceDueDate(toDateValue(existing.balanceDueDate)); setDiscountPercent(existing.discountPercent || 0);
    setLines(existing.lines.map(line => ({ key: crypto.randomUUID(), description: line.description, quantity: Number(line.quantity), unit: line.unit, unitPrice: line.unitPrice, taxRate: line.taxRate, serviceId: line.serviceId || undefined })));
  }, [existing, mode]);
  useEffect(() => { if (mode === "create" && kind === "devis" && selectedClient) setDiscountPercent(selectedClient.defaultDiscountPercent || 0); }, [clientId, kind, mode, selectedClient]);
  useEffect(() => { if (isQuoteWizard && typeof window !== "undefined") window.localStorage?.setItem(QUOTE_WIZARD_STEP_KEY, String(wizardStep)); }, [isQuoteWizard, wizardStep]);

  const assistant = trpc.billing.assistant.proposeQuote.useMutation({ onSuccess: ({ proposal }) => { const completeProposal = proposal as AiQuoteProposal; setLines(completeProposal.lines.map(line => ({ key: crypto.randomUUID(), description: line.description, quantity: line.quantity || 1, unit: line.unit || "unité", unitPrice: line.unitPrice || 0, taxRate: line.taxRate || 0 }))); setValidUntil(futureDate(completeProposal.validityDays || 15)); setNotes([`Objet : ${completeProposal.title}`, `Chantier : ${completeProposal.projectName}`, completeProposal.summary, completeProposal.scope.length ? `Périmètre proposé :\n${completeProposal.scope.map(item => `• ${item}`).join("\n")}` : "", `Délai d’exécution : ${completeProposal.executionTimeline}`, `Conditions de paiement : ${completeProposal.paymentTerms}`, completeProposal.technicalNotes.length ? `Notes techniques :\n${completeProposal.technicalNotes.map(item => `• ${item}`).join("\n")}` : "", completeProposal.assumptions.length ? `Hypothèses à vérifier :\n${completeProposal.assumptions.map(item => `• ${item}`).join("\n")}` : ""].filter(Boolean).join("\n\n")); setIsAiDraft(true); toast.success("Devis complet préparé : relisez chaque ligne, condition et prix avant validation."); }, onError: error => toast.error(error.message) });
  const create = trpc.billing.documents.create.useMutation({ onSuccess: result => { if (isQuoteWizard && typeof window !== "undefined") window.localStorage?.removeItem(QUOTE_WIZARD_STEP_KEY); utils.billing.dashboard.invalidate(); utils.billing.documents.list.invalidate(); toast.success(`${kind === "devis" ? "Devis" : "Facture"} ${result.number} enregistré(e).`); setLocation(`/documents/${result.id}`); }, onError: error => toast.error(error.message) });
  const update = trpc.billing.documents.update.useMutation({ onSuccess: () => { utils.billing.dashboard.invalidate(); utils.billing.documents.list.invalidate(); utils.billing.documents.get.invalidate({ id: documentId }); toast.success("Document mis à jour."); setLocation(`/documents/${documentId}`); }, onError: error => toast.error(error.message) });
  const isSaving = create.isPending || update.isPending;

  function changeLine(key: string, patch: Partial<EditorLine>) { setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line)); }
  function useService(key: string, serviceId: string) { const service = services.find(item => item.id === Number(serviceId)); if (!service) return; changeLine(key, { serviceId: service.id, description: service.name, unit: service.unit, unitPrice: service.defaultUnitPrice, taxRate: service.defaultTaxRate }); }
  function save() {
    const validLines = lines.filter(line => line.description.trim().length > 0);
    if (!clientId) return toast.error("Sélectionnez un client avant d’enregistrer.");
    if (!validLines.length) return toast.error("Ajoutez au moins une prestation chiffrée.");
    if (kind === "devis" && Object.keys(paymentScheduleErrors).length) return toast.error("Corrigez l’échéancier d’acompte et solde avant l’enregistrement.");
    const schedulePayload = kind === "devis" && isPaymentScheduleEnabled ? { depositPercent, depositDueDate, balanceDueDate } : {};
    const payload = { clientId: Number(clientId), projectId: projectId ? Number(projectId) : undefined, status, issueDate, dueDate: dueDate || undefined, validUntil: validUntil || undefined, notes: notes || undefined, ...(kind === "devis" ? { discountPercent } : {}), ...schedulePayload, lines: validLines.map(({ key, ...line }) => line) };
    if (mode === "edit") update.mutate({ id: documentId, expectedUpdatedAt: existing?.updatedAt ? new Date(existing.updatedAt).toISOString() : undefined, ...payload }); else create.mutate({ kind, ...payload, isAiDraft });
  }
  function applyQuoteTemplate() {
    if (!quoteTemplateId) return toast.error("Choisissez un modèle de devis.");
    const draft = buildQuoteTemplateDraft(quoteTemplateId, services);
    if (!draft) return;
    setLines(draft.lines.map(line => ({ key: crypto.randomUUID(), ...line })));
    setNotes(draft.template.notes);
    setIsAiDraft(false);
    toast.success(`Modèle ${draft.template.label} appliqué : adaptez les lignes, prix et conditions avant envoi.`);
  }
  function finishEditorGuide() { setShowEditorGuide(false); if (typeof window !== "undefined") window.localStorage?.setItem(editorGuideKey, "true"); }
  function advanceEditorGuide() { if (editorGuideStep < editorGuideSteps.length - 1) setEditorGuideStep(step => step + 1); else finishEditorGuide(); }
  function askAssistant() { if (needDescription.trim().length < 20) return toast.error("Décrivez le besoin en au moins une phrase pour obtenir un devis complet."); assistant.mutate({ description: needDescription, taxRate: 0 }); }
  const wizardGuard = (step: QuoteWizardStep): string | null => {
    if (step === 0 && !canAdvanceStep0) return "Sélectionnez d’abord un client pour continuer.";
    if (step === 2 && !canAdvanceStep2) return "Ajoutez au moins une prestation chiffrée pour continuer.";
    if (step === 3 && !canAdvanceStep3) return "Corrigez l’échéancier d’acompte et solde pour continuer.";
    return null;
  };
  function nextWizardStep() { setWizardStep(current => { const target = Math.min(4, current + 1) as QuoteWizardStep; const blocked = wizardGuard(current); if (blocked) { toast.error(blocked); return current; } return target; }); }
  function prevWizardStep() { setWizardStep(current => Math.max(0, current - 1) as QuoteWizardStep); }
  function goToWizardStep(target: QuoteWizardStep) { const blocked = wizardGuard(target); if (blocked) { toast.error(blocked); return; } setWizardStep(target); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }
  const title = mode === "edit" ? `Modifier ${existing?.number || "le document"}` : kind === "devis" ? "Nouveau devis" : "Nouvelle facture";

  if (mode === "edit" && isDocumentLoading) return <DashboardLayout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></DashboardLayout>;
  return <DashboardLayout><div className="mx-auto max-w-7xl"><header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><div><button onClick={() => setLocation(kind === "devis" ? "/devis" : "/factures")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"><ChevronLeft className="h-3.5 w-3.5" />Retour à la liste</button><h1 className="font-editorial mt-3 text-3xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">Tous les montants sont enregistrés et présentés en francs guinéens (GNF).</p></div><div className="flex flex-wrap gap-2">{isDocumentCreation && <Button type="button" variant="outline" onClick={() => { setEditorGuideStep(0); setShowEditorGuide(true); }} className="h-11 rounded-xl border-border bg-card font-bold"><CircleHelp className="mr-2 h-4 w-4 text-primary" />Guide de création</Button>}<Button onClick={save} disabled={isSaving} className="h-11 rounded-xl bg-primary font-extrabold text-primary-foreground shadow-lg shadow-primary/15">{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === "edit" ? "Enregistrer les modifications" : "Enregistrer le document"}</Button></div></header>
    {isDocumentCreation && showEditorGuide && <DocumentEditorQuickGuide steps={editorGuideSteps} step={editorGuideStep} kind={kind} onAdvance={advanceEditorGuide} onDismiss={finishEditorGuide} />}
    {isQuoteWizard && <QuoteWizardStepper steps={quoteWizardSteps} current={wizardStep} onSelect={goToWizardStep} />}
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-6">{(!isQuoteWizard || wizardStep === 0) && <section className="card-shadow rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="text-sm font-extrabold">Informations du document</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Client"><select value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(""); }}><option value="">Sélectionner un client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.companyName}</option>)}</select></Field><Field label="Chantier associé"><select value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Aucun chantier associé</option>{visibleProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>{selectedClient && <ClientPrefillCard client={selectedClient} />}<Field label="Date d’émission"><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></Field>{kind === "devis" ? <Field label="Validité jusqu’au"><input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></Field> : <Field label="Échéance de paiement"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>}<Field label="Statut"><select value={status} onChange={e => setStatus(e.target.value as DocumentStatus)}><option value="brouillon">Brouillon</option><option value="a_envoyer">À envoyer</option><option value="envoye">Envoyé</option>{kind === "devis" && <><option value="accepte">Accepté</option><option value="refuse">Refusé</option></>}{kind === "facture" && <><option value="partiellement_paye">Partiellement payé</option><option value="paye">Payé</option><option value="en_retard">En retard</option></>}</select></Field></div></section>}
      {(!isQuoteWizard || wizardStep === 1) && isQuoteCreation && <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.035]"><div className="flex items-start gap-3 p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Building2 className="h-4 w-4" /></div><div><h2 className="text-sm font-extrabold">Galerie de modèles de devis</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Choisissez un point de départ BTP ou multi-services. Les quantités, prix et conditions restent intégralement modifiables et à valider.</p></div></div><div className="border-t border-primary/15 p-5"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setQuoteTemplateSector("btp")} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition-colors ${quoteTemplateSector === "btp" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>BTP</button><button type="button" onClick={() => setQuoteTemplateSector("multiservices")} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition-colors ${quoteTemplateSector === "multiservices" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>Multi-services</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{galleryTemplates.map(template => <button type="button" key={template.id} onClick={() => setQuoteTemplateId(template.id)} className={`group rounded-xl border p-4 text-left transition-colors ${quoteTemplateId === template.id ? "border-primary bg-primary/[0.06] ring-1 ring-primary/15" : "border-border bg-card hover:border-primary/35 hover:bg-primary/[0.02]"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${quoteTemplateId === template.id ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>{quoteTemplateId === template.id ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span><span className="mt-3 block text-sm font-extrabold">{template.label}</span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{template.summary}</span><span className="mt-3 inline-flex items-center text-[11px] font-extrabold text-primary">{quoteTemplateId === template.id ? "Sélectionné" : "Choisir"}<ArrowRight className="ml-1 h-3.5 w-3.5" /></span></button>)}</div><div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/15 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-muted-foreground">{quoteTemplateId ? `Modèle sélectionné : ${QUOTE_TEMPLATES.find(template => template.id === quoteTemplateId)?.label}.` : "Sélectionnez un modèle pour préremplir les postes du devis."}</p><Button type="button" onClick={applyQuoteTemplate} disabled={!quoteTemplateId} className="h-10 shrink-0 rounded-xl bg-primary font-bold text-primary-foreground">Appliquer le modèle</Button></div></div></section>}
      {(!isQuoteWizard || wizardStep === 1) && mode === "create" && kind === "devis" && <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.035]"><div className="flex items-start gap-3 p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div><div><h2 className="text-sm font-extrabold">Devis complet assisté par IA</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Décrivez simplement le chantier. L’assistant structure le périmètre, les lignes, les conditions et la validité du devis, à relire avant toute validation.</p></div></div><div className="border-t border-primary/15 p-5"><textarea value={needDescription} onChange={e => setNeedDescription(e.target.value)} placeholder="Ex. Réaliser une intervention hydraulique, d’hygiène ou de maintenance, avec le périmètre et les équipements nécessaires…" className="min-h-28 w-full resize-y rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><Button onClick={askAssistant} disabled={assistant.isPending} className="mt-3 h-10 rounded-xl bg-primary font-bold text-primary-foreground">{assistant.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}Générer le devis complet</Button></div></section>}
      {(!isQuoteWizard || wizardStep === 3) && kind === "devis" && <section className="card-shadow rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-sm font-extrabold">Remise commerciale client</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">La remise par défaut de la fiche client est préremplie et reste modifiable pour ce devis.</p></div><label className="text-xs font-extrabold">Remise (%)<input aria-label="Remise (%)" type="number" min="0" max="99" value={discountPercent || ""} onChange={e => setDiscountPercent(Number(e.target.value))} className="ml-3 h-10 w-24 rounded-lg border border-border bg-card px-3 text-sm" placeholder="0" /></label></div>{totals.discountAmount > 0 && <p className="mt-4 rounded-lg bg-primary/[0.035] px-3 py-2 text-xs text-primary">Remise appliquée : <strong>{formatGnf(totals.discountAmount)}</strong> sur le total TTC.</p>}</section>}
      {(!isQuoteWizard || wizardStep === 3) && kind === "devis" && <section className="card-shadow rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-extrabold">Échéancier de règlement</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Préparez un acompte et un solde ; les montants sont calculés sur le total TTC du devis.</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-primary"><input type="checkbox" checked={isPaymentScheduleEnabled} onChange={e => setIsPaymentScheduleEnabled(e.target.checked)} />Prévoir un échéancier</label></div>{isPaymentScheduleEnabled && <><div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="Acompte (%)"><input type="number" min="1" max="99" value={depositPercent || ""} onChange={e => setDepositPercent(Number(e.target.value))} /></Field><Field label="Échéance acompte"><input type="date" value={depositDueDate} onChange={e => setDepositDueDate(e.target.value)} /></Field><Field label="Échéance solde"><input type="date" value={balanceDueDate} onChange={e => setBalanceDueDate(e.target.value)} /></Field></div>{Object.keys(paymentScheduleErrors).length > 0 && <p role="alert" className="mt-3 text-xs font-semibold text-destructive">{Object.values(paymentScheduleErrors).join(" ")}</p>}{paymentSchedule && <div className="mt-5 grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4 sm:grid-cols-2"><div><p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Acompte · {paymentSchedule.depositPercent}%</p><p className="mt-1 font-mono text-sm font-extrabold text-primary">{formatGnf(paymentSchedule.depositAmount)}</p></div><div><p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Solde · {paymentSchedule.balancePercent}%</p><p className="mt-1 font-mono text-sm font-extrabold text-primary">{formatGnf(paymentSchedule.balanceAmount)}</p></div></div>}</>}</section>}
      {(!isQuoteWizard || wizardStep === 2 || wizardStep === 3) && isAiDraft && <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/70 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"><strong>Relecture requise.</strong> Cette proposition est une aide à la préparation. Vérifiez les quantités, prix, hypothèses et conditions avant d’enregistrer ou d’envoyer le document.</div>}
      {(!isQuoteWizard || wizardStep === 2) && <section className="card-shadow rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Prestations et chiffrage</h2><p className="mt-1 text-xs text-muted-foreground">Les taxes et le total sont calculés automatiquement.</p></div><Button variant="outline" onClick={() => setLines(current => [...current, blankLine()])} className="h-9 rounded-lg border-border text-xs font-bold"><Plus className="mr-1 h-3.5 w-3.5" />Ajouter une ligne</Button></div><div className="mt-5 space-y-4">{lines.map((line, index) => <div key={line.key} className="rounded-xl border border-border bg-muted/25 p-3.5"><div className="flex items-center justify-between"><p className="text-xs font-extrabold text-muted-foreground">LIGNE {index + 1}</p>{lines.length > 1 && <button onClick={() => setLines(current => current.filter(item => item.key !== line.key))} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Supprimer la ligne"><Trash2 className="h-4 w-4" /></button>}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><select value={line.serviceId || ""} onChange={e => useService(line.key, e.target.value)} className="mb-2 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"><option value="">Choisir une prestation enregistrée</option>{services.map(service => <option value={service.id} key={service.id}>{service.code} — {service.name}</option>)}</select><input value={line.description} onChange={e => changeLine(line.key, { description: e.target.value, serviceId: undefined })} placeholder="Description de la prestation" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div><NumberField label="Quantité" value={line.quantity} onChange={value => changeLine(line.key, { quantity: value })} step="0.01" /><div><label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Unité</label><input value={line.unit} onChange={e => changeLine(line.key, { unit: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></div><NumberField label="Prix GNF" value={line.unitPrice} onChange={value => changeLine(line.key, { unitPrice: value })} /><NumberField label="Taxe %" value={line.taxRate} onChange={value => changeLine(line.key, { taxRate: value })} /></div><p className="mt-3 text-right font-mono text-xs font-bold text-primary">{formatGnf(Math.round(line.quantity * line.unitPrice * (1 + line.taxRate / 100)))}</p></div>)}</div><label className="mt-5 block text-xs font-extrabold">Conditions ou notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Délais, conditions de paiement, hypothèses techniques…" className="mt-2 min-h-28 w-full resize-y rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><p className="mt-3 text-xs leading-5 text-muted-foreground">La signature « {LUCEPRES_PUBLIC_PROFILE.documentFooter} » est ajoutée automatiquement au pied de chaque document.</p></section>}
      {isQuoteWizard && wizardStep === 4 && <QuoteWizardSummary selectedClient={selectedClient} visibleProjects={visibleProjects} projectId={projectId} issueDate={issueDate} validUntil={validUntil} status={status} discountPercent={discountPercent} paymentSchedule={paymentSchedule} isPaymentScheduleEnabled={isPaymentScheduleEnabled} validLines={validLines} notes={notes} totals={totals} canSave={canSaveFromWizard} isSaving={isSaving} onSave={save} onPrev={prevWizardStep} />}
      {isQuoteWizard && wizardStep < 4 && <QuoteWizardNav step={wizardStep} canAdvance={wizardStep === 0 ? canAdvanceStep0 : wizardStep === 2 ? canAdvanceStep2 : wizardStep === 3 ? canAdvanceStep3 : true} onNext={nextWizardStep} onPrev={prevWizardStep} />}
      </div>
      <aside className="h-fit rounded-2xl bg-primary p-5 text-primary-foreground xl:sticky xl:top-8"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f3d48b]">Synthèse en GNF</p><div className="mt-6 space-y-3 border-b border-white/15 pb-5 text-sm"><div className="flex justify-between text-primary-foreground/75"><span>Sous-total</span><span className="font-mono">{formatGnf(totals.subtotal)}</span></div><div className="flex justify-between text-primary-foreground/75"><span>Taxes</span><span className="font-mono">{formatGnf(totals.taxTotal)}</span></div>{kind === "devis" && totals.discountAmount > 0 && <div className="flex justify-between text-[#f3d48b]"><span>Remise · {totals.discountPercent}%</span><span className="font-mono">− {formatGnf(totals.discountAmount)}</span></div>}</div><div className="mt-5 flex justify-between gap-3"><span className="font-editorial text-lg font-semibold">Total TTC</span><span className="font-mono text-lg font-bold text-[#f3d48b]">{formatGnf(totals.totalAfterDiscount)}</span></div><p className="mt-5 text-xs leading-5 text-primary-foreground/65">Lucepress conserve ce document dans un espace sécurisé. Une prévisualisation prête à imprimer est disponible après enregistrement.</p></aside></div></div></DashboardLayout>;
}

function DocumentEditorQuickGuide({ steps, step, kind, onAdvance, onDismiss }: { steps: readonly { title: string; body: string }[]; step: number; kind: Kind; onAdvance: () => void; onDismiss: () => void }) {
  const guidance = steps[step] || steps[0];
  const isLastStep = step === steps.length - 1;
  const label = kind === "devis" ? "devis" : "facture";
  return <section aria-labelledby="document-guide-title" className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5"><div className="flex min-w-0 gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-extrabold text-primary-foreground">{step + 1}/{steps.length}</div><div><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-primary">Guide express · {label}</p><h2 id="document-guide-title" className="mt-1 text-sm font-extrabold">{guidance.title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{guidance.body}</p></div></div><div className="mt-4 flex shrink-0 items-center justify-between gap-3 sm:mt-0"><button type="button" onClick={onDismiss} className="text-xs font-bold text-muted-foreground hover:text-primary hover:underline">Passer le guide</button><Button type="button" size="sm" onClick={onAdvance} className="h-9 rounded-lg bg-primary px-3 text-xs font-extrabold text-primary-foreground">{isLastStep ? <><Check className="mr-1.5 h-3.5 w-3.5" />J’ai compris</> : <>Suivant<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>}</Button></div></section>;
}

function QuoteWizardStepper({ steps, current, onSelect }: { steps: { title: string; subtitle: string }[]; current: QuoteWizardStep; onSelect: (step: QuoteWizardStep) => void }) {
  return <nav aria-label="Étapes de création du devis" className="mt-6 flex flex-wrap items-center gap-2"><ol className="flex flex-wrap items-center gap-1.5">
    {steps.map((step, index) => {
      const isActive = index === current;
      const isDone = index < current;
      const reachable = index <= current;
      return <li key={step.title} className="flex items-center gap-1.5">
        <button type="button" disabled={!reachable} onClick={() => onSelect(index as QuoteWizardStep)} aria-current={isActive ? "step" : undefined} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition-colors ${isActive ? "border-primary bg-primary text-primary-foreground" : isDone ? "border-primary/30 bg-primary/[0.06] text-primary" : "border-border bg-card text-muted-foreground"} ${reachable ? "cursor-pointer hover:border-primary/40" : "cursor-not-allowed opacity-60"}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${isActive ? "bg-primary-foreground/20" : isDone ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{isDone ? <Check className="h-3 w-3" /> : index + 1}</span>
          <span className="hidden sm:inline">{step.title}</span>
        </button>
        {index < steps.length - 1 && <span aria-hidden="true" className="hidden h-px w-4 bg-border sm:inline-block" />}
      </li>;
    })}
  </ol></nav>;
}

function QuoteWizardNav({ step, canAdvance, onNext, onPrev }: { step: QuoteWizardStep; canAdvance: boolean; onNext: () => void; onPrev: () => void }) {
  return <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
    {step > 0 ? <Button type="button" variant="outline" onClick={onPrev} className="h-11 rounded-xl border-border bg-card font-bold"><ArrowLeft className="mr-2 h-4 w-4" />Étape précédente</Button> : <span />}
    <div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground">Étape {step + 1}/5</span><Button type="button" onClick={onNext} disabled={!canAdvance} className="h-11 rounded-xl bg-primary font-extrabold text-primary-foreground shadow-lg shadow-primary/15">Étape suivante<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
  </div>;
}

function QuoteWizardSummary({ selectedClient, visibleProjects, projectId, issueDate, validUntil, status, discountPercent, paymentSchedule, isPaymentScheduleEnabled, validLines, notes, totals, canSave, isSaving, onSave, onPrev }: {
  selectedClient: ReturnType<typeof findPrefilledClient> | undefined;
  visibleProjects: { id: number; name: string }[];
  projectId: string;
  issueDate: string;
  validUntil: string;
  status: DocumentStatus;
  discountPercent: number;
  paymentSchedule: ReturnType<typeof calculateQuotePaymentSchedule>;
  isPaymentScheduleEnabled: boolean;
  validLines: EditorLine[];
  notes: string;
  totals: ReturnType<typeof calculateDocumentDiscount>;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  onPrev: () => void;
}) {
  const projectName = visibleProjects.find(project => String(project.id) === projectId)?.name;
  return <section className="card-shadow rounded-2xl border border-primary/25 bg-primary/[0.025] p-5 sm:p-6">
    <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><CheckCircle2 className="h-5 w-5" /></div>
      <div><h2 className="text-sm font-extrabold">Vérification du devis</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Relisez ce récapitulatif avant l’enregistrement. Tout reste modifiable après coup.</p></div>
    </div>
    <div className="mt-5 space-y-3 text-sm">
      <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Client</span><span className="text-right font-extrabold">{selectedClient?.companyName || "—"}</span></div>
      {projectName && <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Chantier</span><span className="text-right font-extrabold">{projectName}</span></div>}
      <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Date d’émission</span><span className="text-right font-extrabold">{issueDate || "—"}</span></div>
      {validUntil && <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Valide jusqu’au</span><span className="text-right font-extrabold">{validUntil}</span></div>}
      <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Statut</span><span className="text-right font-extrabold capitalize">{status}</span></div>
      <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Prestations</span><span className="text-right font-extrabold">{validLines.length} ligne{validLines.length > 1 ? "s" : ""}</span></div>
      {discountPercent > 0 && <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Remise</span><span className="text-right font-extrabold text-primary">{discountPercent}% · − {formatGnf(totals.discountAmount)}</span></div>}
      {isPaymentScheduleEnabled && paymentSchedule && <div className="flex justify-between gap-3 border-b border-border pb-3"><span className="font-bold text-muted-foreground">Échéancier</span><span className="text-right font-extrabold">Acompte {paymentSchedule.depositPercent}% · Solde {paymentSchedule.balancePercent}%</span></div>}
      {notes.trim() && <div className="border-b border-border pb-3"><p className="font-bold text-muted-foreground">Conditions / notes</p><p className="mt-1 whitespace-pre-line text-xs leading-5 text-foreground/80">{notes}</p></div>}
      <div className="flex justify-between gap-3 pt-1"><span className="font-editorial text-lg font-semibold">Total TTC</span><span className="font-mono text-lg font-bold text-primary">{formatGnf(totals.totalAfterDiscount)}</span></div>
    </div>
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onPrev} className="h-11 rounded-xl border-border bg-card font-bold"><ArrowLeft className="mr-2 h-4 w-4" />Étape précédente</Button>
      <Button type="button" onClick={onSave} disabled={!canSave || isSaving} className="h-11 rounded-xl bg-primary font-extrabold text-primary-foreground shadow-lg shadow-primary/15">{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer le devis</Button>
    </div>
    {!canSave && <p className="mt-3 text-xs font-semibold text-destructive">Complétez le client et au moins une prestation pour enregistrer.</p>}
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-extrabold">{label}<div className="mt-2 [&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-border [&_input]:bg-card [&_input]:px-3 [&_input]:text-sm [&_input]:outline-none [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-border [&_select]:bg-card [&_select]:px-3 [&_select]:text-sm [&_select]:outline-none">{children}</div></label>; }
function NumberField({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) { return <div><label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</label><input type="number" min="0" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>; }
