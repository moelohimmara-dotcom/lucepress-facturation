"use client";

import type { ReactNode } from "react";
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";
import type { ToasterProps } from "sonner";
import { CheckCircle, AlertCircle, Info, XCircle, Clock, Sparkles, TrendingUp, UserPlus, FileText, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ToastPosition = NonNullable<ToasterProps["position"]>;

export type EnhancedToastType = "success" | "error" | "info" | "warning" | "loading" | "ai" | "financial" | "client";

export type EnhancedToastProps = {
  type?: EnhancedToastType;
  title?: string;
  message: string;
  icon?: ReactNode;
  duration?: number;
  position?: ToastPosition;
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: boolean;
};

const toastIcons: Record<EnhancedToastType, ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-success" />,
  error: <XCircle className="h-5 w-5 text-destructive" />,
  info: <Info className="h-5 w-5 text-info" />,
  warning: <AlertCircle className="h-5 w-5 text-warning" />,
  loading: <Clock className="h-5 w-5 text-primary animate-spin" />,
  ai: <Sparkles className="h-5 w-5 text-purple-500" />,
  financial: <TrendingUp className="h-5 w-5 text-emerald-500" />,
  client: <UserPlus className="h-5 w-5 text-blue-500" />,
};

const toastStyles: Record<EnhancedToastType, string> = {
  success: "bg-success/10 border-success/20 text-success",
  error: "bg-destructive/10 border-destructive/20 text-destructive",
  info: "bg-info/10 border-info/20 text-info",
  warning: "bg-warning/10 border-warning/20 text-warning",
  loading: "bg-primary/10 border-primary/20 text-primary",
  ai: "bg-purple-500/10 border-purple-500/20 text-purple-500",
  financial: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
  client: "bg-blue-500/10 border-blue-500/20 text-blue-500",
};

export function enhancedToast({
  type = "info",
  title,
  message,
  icon,
  duration = 4000,
  position = "top-right",
  action,
  progress,
}: EnhancedToastProps) {
  const finalIcon = icon || toastIcons[type];
  const styleClasses = toastStyles[type];

  sonnerToast.custom(
    (id) => (
      <div
        className={cn(
          "relative flex items-start gap-4 p-4 rounded-lg border",
          styleClasses,
          "w-full max-w-sm shadow-lg"
        )}
      >
        <div className="flex-shrink-0">{finalIcon}</div>
        <div className="flex-1">
          {title && <h4 className="font-semibold mb-1">{title}</h4>}
          <p className="text-sm">{message}</p>
          {progress && (
            <div className="mt-2 h-1 bg-black/10 rounded-full overflow-hidden">
              <div className="h-full bg-white/30 animate-pulse" />
            </div>
          )}
        </div>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              action.onClick();
            }}
            className="ml-2 h-6 px-2"
          >
            {action.label}
          </Button>
        )}
        <button
          onClick={() => sonnerToast.dismiss(id)}
          className="absolute top-2 right-2 p-1 rounded hover:bg-black/5 transition-colors"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    ),
    {
      duration,
      position,
    }
  );
}

export function EnhancedToaster() {
  return <SonnerToaster position="top-right" richColors closeButton />;
}

export const toast = {
  success: (message: string, title?: string, props?: Omit<EnhancedToastProps, "type" | "message">) =>
    enhancedToast({ type: "success", message, title, ...props }),

  error: (message: string, title?: string, props?: Omit<EnhancedToastProps, "type" | "message">) =>
    enhancedToast({ type: "error", message, title, duration: 6000, ...props }),

  info: (message: string, title?: string, props?: Omit<EnhancedToastProps, "type" | "message">) =>
    enhancedToast({ type: "info", message, title, ...props }),

  warning: (message: string, title?: string, props?: Omit<EnhancedToastProps, "type" | "message">) =>
    enhancedToast({ type: "warning", message, title, duration: 5000, ...props }),

  loading: (message: string, title?: string, props?: Omit<EnhancedToastProps, "type" | "message">) =>
    enhancedToast({ type: "loading", message, title, duration: Infinity, progress: true, ...props }),

  quote: {
    created: (number?: string) =>
      enhancedToast({
        type: "success",
        title: "Devis créé",
        message: number ? `Devis n°${number} enregistré avec succès.` : "Devis enregistré avec succès.",
        icon: <FileText className="h-5 w-5 text-success" />,
      }),
    updated: (number?: string) =>
      enhancedToast({
        type: "success",
        title: "Devis mis à jour",
        message: number ? `Devis n°${number} modifié.` : "Devis modifié avec succès.",
        icon: <FileText className="h-5 w-5 text-success" />,
      }),
    sent: (number?: string) =>
      enhancedToast({
        type: "success",
        title: "Devis envoyé",
        message: number ? `Devis n°${number} envoyé au client.` : "Devis envoyé avec succès.",
        icon: <FileText className="h-5 w-5 text-success" />,
      }),
  },

  invoice: {
    created: (number?: string) =>
      enhancedToast({
        type: "success",
        title: "Facture créée",
        message: number ? `Facture n°${number} enregistrée.` : "Facture enregistrée avec succès.",
        icon: <ReceiptText className="h-5 w-5 text-success" />,
      }),
    paid: (number?: string, amount?: string) =>
      enhancedToast({
        type: "financial",
        title: "Paiement enregistré",
        message: number ? `Facture n°${number} marquée comme payée.${amount ? ` Montant: ${amount}` : ""}` : "Paiement enregistré.",
        icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
      }),
    partial: (number?: string, amount?: string) =>
      enhancedToast({
        type: "financial",
        title: "Paiement partiel",
        message: number ? `Paiement partiel pour la facture n°${number}.${amount ? ` Montant: ${amount}` : ""}` : "Paiement partiel enregistré.",
        icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
      }),
  },

  client: {
    created: (name?: string) =>
      enhancedToast({
        type: "client",
        title: "Client ajouté",
        message: name ? `Client ${name} ajouté au répertoire.` : "Nouveau client ajouté.",
        icon: <UserPlus className="h-5 w-5 text-blue-500" />,
      }),
    updated: (name?: string) =>
      enhancedToast({
        type: "client",
        title: "Client mis à jour",
        message: name ? `Fiche client ${name} mise à jour.` : "Client mis à jour.",
        icon: <UserPlus className="h-5 w-5 text-blue-500" />,
      }),
  },

  ai: {
    generating: () =>
      enhancedToast({
        type: "ai",
        title: "Génération en cours",
        message: "L'assistant IA prépare votre devis...",
        icon: <Sparkles className="h-5 w-5 text-purple-500 animate-pulse" />,
        duration: Infinity,
        progress: true,
      }),
    generated: () =>
      enhancedToast({
        type: "ai",
        title: "Devis généré",
        message: "Votre devis a été généré par l'IA. Vérifiez et validez avant envoi.",
        icon: <Sparkles className="h-5 w-5 text-purple-500" />,
      }),
  },

  withAction: {
    undo: (message: string, onUndo: () => void) =>
      enhancedToast({
        type: "info",
        title: "Action effectuée",
        message,
        icon: <Clock className="h-5 w-5 text-primary" />,
        action: {
          label: "Annuler",
          onClick: onUndo,
        },
      }),
  },
};
