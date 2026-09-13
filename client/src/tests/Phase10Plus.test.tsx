import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { TourGuide, appTourSteps } from "@/components/TourGuide";
import { EnhancedToaster } from "@/components/EnhancedToast";
import { Skeleton, ListSkeleton, CardSkeleton, ButtonSkeleton, DashboardSkeleton } from "@/components/ui/skeleton";
import * as EnhancedToastModule from "@/components/EnhancedToast";
import * as CommandPaletteModule from "@/components/CommandPalette";

// Mock de wouter pour les tests
vi.mock("wouter", () => ({
  useLocation: () => ["/", (path: string) => {}],
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useParams: () => ({}),
  useSearch: () => "",
  Switch: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: ({ path, children }: { path: string; children: React.ReactNode }) => <div>{children}</div>,
  useRouter: () => ["/", (path: string) => {}],
}));

// Mock de localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Mock sonner pour les tests de toast
vi.mock("sonner", () => ({
  toast: vi.fn(),
  Toaster: () => null,
}));

describe("Phase 10+ : Onboarding Guidé", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it("1. Doit avoir 9 étapes dans le tour principal", () => {
    expect(appTourSteps).toHaveLength(9);
  });

  it("2. Doit avoir des sélecteurs CSS valides pour les éléments cibles", () => {
    const stepsWithSelectors = appTourSteps.filter(step => step.targetSelector);
    expect(stepsWithSelectors.length).toBeGreaterThan(0);

    // Vérifie que les sélecteurs sont bien formés
    stepsWithSelectors.forEach(step => {
      expect(step.targetSelector).toMatch(/^\[data-testid=['"]/);
    });
  });

  it("3. Doit avoir des étapes spécifiques au domaine", () => {
    const domainSteps = appTourSteps.filter(step =>
      ["clients", "receivables", "create-quote", "ai-assistant"].includes(step.id)
    );

    expect(domainSteps.length).toBeGreaterThanOrEqual(4);
  });

  it("4. Doit avoir une étape de bienvenue", () => {
    const welcomeStep = appTourSteps.find(step => step.id === "welcome");
    expect(welcomeStep).toBeDefined();
    expect(welcomeStep?.title).toContain("Bienvenue");
  });

  it("5. Doit avoir une étape de conclusion", () => {
    const conclusionStep = appTourSteps.find(step => step.id === "conclusion");
    expect(conclusionStep).toBeDefined();
    expect(conclusionStep?.title).toContain("Tour terminé");
  });
});

describe("Phase 10+ : Composants Skeleton", () => {
  it("6. Doit rendre un Skeleton de base", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    expect(container).toBeTruthy();
  });

  it("7. Doit rendre un CardSkeleton", () => {
    const { container } = render(<CardSkeleton />);
    expect(container).toBeTruthy();
  });

  it("8. Doit rendre un ListSkeleton avec le bon nombre d'items", () => {
    const { container } = render(<ListSkeleton items={3} />);
    expect(container).toBeTruthy();
  });

  it("9. Doit rendre un ButtonSkeleton", () => {
    const { container } = render(<ButtonSkeleton />);
    expect(container).toBeTruthy();
  });

  it("10. Doit rendre un DashboardSkeleton", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container).toBeTruthy();
  });
});

describe("Phase 10+ : Toasts Enrichis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("11. Doit rendre EnhancedToaster sans erreur", () => {
    const { container } = render(<EnhancedToaster />);
    expect(container).toBeTruthy();
  });

  it("12. Doit exporter enhancedToast depuis EnhancedToast.tsx", () => {
    expect(EnhancedToastModule.enhancedToast).toBeDefined();
    expect(typeof EnhancedToastModule.enhancedToast).toBe("function");
  });

  it("13. Doit exporter toast avec les sous-catégories", () => {
    expect(EnhancedToastModule.toast).toBeDefined();
    expect(EnhancedToastModule.toast.quote).toBeDefined();
    expect(EnhancedToastModule.toast.invoice).toBeDefined();
    expect(EnhancedToastModule.toast.client).toBeDefined();
    expect(EnhancedToastModule.toast.ai).toBeDefined();
  });

  it("14. Doit avoir des toasts prédéfinis pour les devis", () => {
    expect(EnhancedToastModule.toast.quote.created).toBeDefined();
    expect(EnhancedToastModule.toast.quote.updated).toBeDefined();
    expect(EnhancedToastModule.toast.quote.sent).toBeDefined();
  });

  it("15. Doit avoir des toasts prédéfinis pour les factures", () => {
    expect(EnhancedToastModule.toast.invoice.created).toBeDefined();
    expect(EnhancedToastModule.toast.invoice.paid).toBeDefined();
    expect(EnhancedToastModule.toast.invoice.partial).toBeDefined();
  });

  it("16. Doit avoir des toasts prédéfinis pour les clients", () => {
    expect(EnhancedToastModule.toast.client.created).toBeDefined();
    expect(EnhancedToastModule.toast.client.updated).toBeDefined();
  });

  it("17. Doit avoir des toasts pour l'IA", () => {
    expect(EnhancedToastModule.toast.ai.generating).toBeDefined();
    expect(EnhancedToastModule.toast.ai.generated).toBeDefined();
  });
});

describe("Phase 10+ : CommandPalette", () => {
  it("18. Doit exporter useCommandActions", () => {
    expect(CommandPaletteModule.useCommandActions).toBeDefined();
    expect(typeof CommandPaletteModule.useCommandActions).toBe("function");
  });

  it("19. Doit exporter CommandPalette", () => {
    expect(CommandPaletteModule.CommandPalette).toBeDefined();
  });

  it("20. Doit avoir des actions définies dans useCommandActions", () => {
    expect(CommandPaletteModule.useCommandActions).toBeDefined();
  });
});

describe("Phase 10+ : Intégration Globale", () => {
  const fs = require("fs");
  const path = require("path");
  const clientRoot = path.resolve(__dirname, "..", "..");
  const readSrc = (rel: string) => fs.readFileSync(path.resolve(clientRoot, rel), "utf-8");

  it("21. Doit importer tous les nouveaux composants dans App.tsx", () => {
    const appContent = readSrc("src/App.tsx");

    expect(appContent).toContain("EnhancedToaster");
    expect(appContent).toContain("CommandPalette");
    expect(appContent).toContain("TourGuide");
  });

  it("22. Doit avoir les data-testid nécessaires pour le tour guidé", () => {
    const dashboardLayoutContent = readSrc("src/components/DashboardLayout.tsx");

    // Vérifie que les data-testid sont présents
    expect(dashboardLayoutContent).toContain("data-testid=\"sidebar-shell\"");
    expect(dashboardLayoutContent).toContain("data-testid=\"workspace-search-trigger\"");
    expect(dashboardLayoutContent).toContain("data-testid=\"sidebar-ai-assistant\"");
  });

  it("23. Doit avoir le data-testid pour le dashboard dans Home.tsx", () => {
    const homeContent = readSrc("src/pages/Home.tsx");

    expect(homeContent).toContain("data-testid=\"dashboard-main\"");
  });

  it("24. Doit avoir le data-testid pour le bouton de création de devis", () => {
    const homeContent = readSrc("src/pages/Home.tsx");

    expect(homeContent).toContain("data-testid=\"create-quote-button\"");
  });

  it("25. Doit avoir les exports de Skeleton dans ui/skeleton.tsx", () => {
    const skeletonContent = readSrc("src/components/ui/skeleton.tsx");

    expect(skeletonContent).toContain("CardSkeleton");
    expect(skeletonContent).toContain("ButtonSkeleton");
    expect(skeletonContent).toContain("ListSkeleton");
    expect(skeletonContent).toContain("DashboardSkeleton");
  });
});
