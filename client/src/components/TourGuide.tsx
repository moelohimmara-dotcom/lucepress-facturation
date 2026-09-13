"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Home, Users, FileText, ReceiptText, TrendingUp, Sparkles, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export const appTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Bienvenue sur Lucepres Facturation",
    description: "Découvrez les fonctionnalités clés en quelques étapes.",
    position: "top",
  },
  {
    id: "sidebar",
    title: "Barre latérale",
    description: "Accédez rapidement à toutes les sections de l'application.",
    targetSelector: "[data-testid=\"sidebar-shell\"]",
    position: "right",
  },
  {
    id: "dashboard",
    title: "Tableau de bord",
    description: "Visualisez l'état général de votre activité en un coup d'œil.",
    targetSelector: "[data-testid=\"dashboard-main\"]",
    position: "top",
  },
  {
    id: "clients",
    title: "Gestion des clients",
    description: "Créez et gérez votre répertoire clients.",
    targetSelector: "[data-testid=\"sidebar-clients\"]",
    position: "right",
  },
  {
    id: "receivables",
    title: "Créances",
    description: "Suivez les paiements et les factures en attente.",
    targetSelector: "[data-testid=\"sidebar-receivables\"]",
    position: "right",
  },
  {
    id: "create-quote",
    title: "Nouveau devis",
    description: "Créez un nouveau devis rapidement avec l'assistant.",
    targetSelector: "[data-testid=\"create-quote-button\"]",
    position: "bottom",
  },
  {
    id: "workspace-search",
    title: "Recherche globale",
    description: "Trouvez n'importe quel document ou client en quelques caractères.",
    targetSelector: "[data-testid=\"workspace-search-trigger\"]",
    position: "bottom",
  },
  {
    id: "ai-assistant",
    title: "Assistant IA",
    description: "Utilisez l'intelligence artificielle pour générer des devis automatiquement.",
    targetSelector: "[data-testid=\"sidebar-ai-assistant\"]",
    position: "right",
  },
  {
    id: "conclusion",
    title: "Tour terminé !",
    description: "Vous êtes prêt à utiliser Lucepres Facturation. Bonne exploration !",
    position: "top",
  },
];

interface TourGuideProps {
  steps: TourStep[];
  tourKey: string;
}

export function TourGuide({ steps, tourKey }: TourGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    const hasCompleted = localStorage.getItem(`lucepress-tour-${tourKey}-completed`);
    if (hasCompleted) {
      setIsCompleted(true);
      return;
    }

    // Show tour on first visit
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tourKey]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Tour completed
      localStorage.setItem(`lucepress-tour-${tourKey}-completed`, "true");
      setIsCompleted(true);
      setIsOpen(false);
    }
  }, [currentStepIndex, steps.length, tourKey]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSkip = useCallback(() => {
    localStorage.setItem(`lucepress-tour-${tourKey}-completed`, "true");
    setIsCompleted(true);
    setIsOpen(false);
  }, [tourKey]);

  if (isCompleted || !isOpen) {
    return null;
  }

  // Icons for each step
  const stepIcons: Record<string, React.ReactNode> = {
    welcome: <Home className="h-8 w-8 text-primary" />,
    sidebar: <Settings className="h-8 w-8 text-primary" />,
    dashboard: <BarChart3 className="h-8 w-8 text-primary" />,
    clients: <Users className="h-8 w-8 text-primary" />,
    receivables: <TrendingUp className="h-8 w-8 text-primary" />,
    "create-quote": <FileText className="h-8 w-8 text-primary" />,
    "workspace-search": <Sparkles className="h-8 w-8 text-primary" />,
    "ai-assistant": <Sparkles className="h-8 w-8 text-primary" />,
    conclusion: <CheckCircle className="h-8 w-8 text-success" />,
  };

  const icon = stepIcons[currentStep.id] || <Info className="h-8 w-8 text-primary" />;

  // Calculate progress
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Tour Card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 pointer-events-auto">
        <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Étape {currentStepIndex + 1} sur {steps.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkip}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-4 p-3 bg-primary/10 rounded-xl">
              {icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          </div>

          {/* Navigation */}
          <div className="flex gap-3 justify-end">
            {currentStepIndex > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Précédent
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStepIndex < steps.length - 1 ? (
                <>
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                "Terminer"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Arrow indicator */}
      {currentStep.targetSelector && (
        <div className="absolute pointer-events-none animate-pulse">
          <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[15px] border-b-primary" />
        </div>
      )}
    </div>
  );
}

// Helper component for step indicators
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-8 w-8", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// Helper component for Info icon
function Info({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-8 w-8", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
