import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useParams } from "wouter";
import DocumentEditorPage from "./DocumentEditorPage";

export default function DocumentEditRoute() {
  const { id } = useParams<{ id: string }>();
  const documentId = Number(id);
  const { data: document, isLoading } = trpc.billing.documents.get.useQuery({ id: documentId || 1 });
  if (isLoading) return <DashboardLayout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></DashboardLayout>;
  if (!document) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Ce document est introuvable.</div></DashboardLayout>;
  return <DocumentEditorPage kind={document.kind} mode="edit" />;
}
