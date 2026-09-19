"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Home, Users, FileText, WalletCards, Mail, Sparkles, BarChart3, FlaskConical } from "lucide-react";
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
    title: "Bienvenue — parcours cash-loop",
    description: "Devis → facture → paiement → créances. En 5 minutes tu vois le fil complet.",
    position: "top",
  },
  {
    id: "dashboard",
    title: "Aujourd’hui",
    description: "Ta file du jour : urgents, devis à envoyer, retards. C’est le cockpit.",
    targetSelector: "[data-testid=\"dashboard-main\"]",
    position: "top",
  },
  {
    id: "bootstrap-demo",
    title: "Jeu demo un clic",
    description: "Base vide ? Charge Client Demo Kaloum, un devis accepté, un acompte payé et une facture en retard.",
    targetSelector: "[data-testid=\"bootstrap-demo-button\"]",
    position: "bottom",
  },
  {
    id: "clients",
    title: "Clients",
    description: "Le répertoire commercial. Chaque devis et chaque créance part d’ici.",
    targetSelector: "[data-testid=\"sidebar-clients\"]",
    position: "right",
  },
  {
    id: "create-quote",
    title: "Nouveau devis",
    description: "Crée un devis à la main ou avec l’assistant IA.",
    targetSelector: "[data-testid=\"create-quote-button\"]",
    position: "bottom",
  },
  {
    id: "receivables",
    title: "Créances",
    description: "Suis les soldes, retards et promesses de paiement.",
    targetSelector: "[data-testid=\"sidebar-cr-ances\"]",
    position: "right",
  },
  {
    id: "reminders",
    title: "Relances",
    description: "Prépare et envoie les rappels par e-mail quand SMTP est configuré.",
    targetSelector: "[data-testid=\"sidebar-relances\"]",
    position: "right",
  },
  {
    id: "conclusion",
    title: "Tour terminé",
    description: "Tu es prêt pour le smoke OP. Lance le jeu demo si la base est vide, puis enchaîne Créances.",
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

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tourKey]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
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

  const stepIcons: Record<string, React.ReactNode> = {
    welcome: <Home className="h-8 w-8 text-primary" />,
    dashboard: <BarChart3 className="h-8 w-8 text-primary" />,
    "bootstrap-demo": <FlaskConical className="h-8 w-8 text-primary" />,
    clients: <Users className="h-8 w-8 text-primary" />,
    "create-quote": <FileText className="h-8 w-8 text-primary" />,
    receivables: <WalletCards className="h-8 w-8 text-primary" />,
    reminders: <Mail className="h-8 w-8 text-primary" />,
    conclusion: <Sparkles className="h-8 w-8 text-primary" />,
  };

  const icon = stepIcons[currentStep.id] || <Sparkles className="h-8 w-8 text-primary" />;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 pointer-events-auto">
        <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
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

          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-4 p-3 bg-primary/10 rounded-xl">
              {icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          </div>

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

      {currentStep.targetSelector && (
        <div className={cn("absolute pointer-events-none animate-pulse")}>
          <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[15px] border-b-primary" />
        </div>
      )}
    </div>
  );
}
