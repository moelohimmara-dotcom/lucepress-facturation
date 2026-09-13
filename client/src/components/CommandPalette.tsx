"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Users, ReceiptText, TrendingUp, Sparkles, Search, Plus, Calendar, Settings, UserPlus, BarChart3, HelpCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandAction {
  id: string;
  title: string;
  group: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action?: () => void;
  href?: string;
}

export function useCommandActions(): { allActions: CommandAction[] } {
  const [, navigate] = useLocation();

  const allActions = useMemo<CommandAction[]>(() => [
    // Navigation rapide
    {
      id: "home",
      title: "Tableau de bord",
      group: "Navigation",
      icon: <BarChart3 className="h-4 w-4" />,
      shortcut: "Ctrl+1",
      href: "/",
    },
    {
      id: "clients",
      title: "Clients",
      group: "Navigation",
      icon: <Users className="h-4 w-4" />,
      shortcut: "Ctrl+2",
      href: "/clients",
    },
    {
      id: "quotes",
      title: "Devis",
      group: "Navigation",
      icon: <FileText className="h-4 w-4" />,
      shortcut: "Ctrl+3",
      href: "/quotes",
    },
    {
      id: "invoices",
      title: "Factures",
      group: "Navigation",
      icon: <ReceiptText className="h-4 w-4" />,
      shortcut: "Ctrl+4",
      href: "/invoices",
    },
    {
      id: "receivables",
      title: "Créances",
      group: "Navigation",
      icon: <TrendingUp className="h-4 w-4" />,
      shortcut: "Ctrl+5",
      href: "/receivables",
    },
    {
      id: "calendar",
      title: "Calendrier",
      group: "Navigation",
      icon: <Calendar className="h-4 w-4" />,
      shortcut: "Ctrl+6",
      href: "/calendar",
    },
    {
      id: "settings",
      title: "Paramètres",
      group: "Navigation",
      icon: <Settings className="h-4 w-4" />,
      shortcut: "Ctrl+,",
      href: "/settings",
    },
    {
      id: "help",
      title: "Aide",
      group: "Navigation",
      icon: <HelpCircle className="h-4 w-4" />,
      shortcut: "Ctrl+?",
      href: "/help",
    },

    // Création rapide
    {
      id: "new-quote",
      title: "Nouveau devis",
      group: "Création rapide",
      icon: <Plus className="h-4 w-4" />,
      shortcut: "Ctrl+N",
      href: "/quotes/new",
    },
    {
      id: "new-quote-ai",
      title: "Nouveau devis avec IA",
      group: "Création rapide",
      icon: <Sparkles className="h-4 w-4" />,
      shortcut: "Ctrl+Shift+N",
      href: "/quotes/new?ai=true",
    },
    {
      id: "new-invoice",
      title: "Nouvelle facture",
      group: "Création rapide",
      icon: <ReceiptText className="h-4 w-4" />,
      shortcut: "Ctrl+I",
      href: "/invoices/new",
    },
    {
      id: "new-client",
      title: "Nouveau client",
      group: "Création rapide",
      icon: <UserPlus className="h-4 w-4" />,
      shortcut: "Ctrl+C",
      href: "/clients/new",
    },

    // Actions IA
    {
      id: "ai-assistant",
      title: "Assistant IA",
      group: "Intelligence Artificielle",
      icon: <Sparkles className="h-4 w-4" />,
      shortcut: "Ctrl+A",
      href: "/ai-assistant",
    },
    {
      id: "ai-generate-quote",
      title: "Générer devis IA",
      group: "Intelligence Artificielle",
      icon: <Sparkles className="h-4 w-4" />,
      shortcut: "Ctrl+Shift+A",
      action: () => {
        navigate("/quotes/new?ai=true");
      },
    },

    // Recherche
    {
      id: "search",
      title: "Recherche globale",
      group: "Recherche",
      icon: <Search className="h-4 w-4" />,
      shortcut: "Ctrl+K",
      action: () => {
        // Trigger search modal
      },
    },
    {
      id: "search-clients",
      title: "Rechercher clients",
      group: "Recherche",
      icon: <Users className="h-4 w-4" />,
      shortcut: "Ctrl+Shift+K",
      href: "/clients?search=true",
    },

    // Actions utilisateur
    {
      id: "logout",
      title: "Déconnexion",
      group: "Compte",
      icon: <LogOut className="h-4 w-4" />,
      shortcut: "Ctrl+Shift+Q",
      href: "/logout",
    },
  ], [navigate]);

  return { allActions };
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { allActions } = useCommandActions();
  const [, navigate] = useLocation();

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+K or Ctrl+K
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Handle Escape to close
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const filteredActions = useMemo(() => {
    if (!searchQuery) return allActions;
    const query = searchQuery.toLowerCase();
    return allActions.filter(
      (action) =>
        action.title.toLowerCase().includes(query) ||
        action.group.toLowerCase().includes(query) ||
        (action.shortcut && action.shortcut.toLowerCase().includes(query))
    );
  }, [searchQuery, allActions]);

  const handleActionSelect = useCallback(
    (action: CommandAction) => {
      if (action.action) {
        action.action();
      } else if (action.href) {
        navigate(action.href);
      }
      setIsOpen(false);
      setSearchQuery("");
    },
    [navigate]
  );

  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    filteredActions.forEach((action) => {
      if (!groups[action.group]) {
        groups[action.group] = [];
      }
      groups[action.group].push(action);
    });
    return groups;
  }, [filteredActions]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="p-0 gap-0 max-w-2xl w-full bg-background border-border shadow-2xl"
        onEscapeKeyDown={() => setIsOpen(false)}
        onPointerDownOutside={() => setIsOpen(false)}
      >
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher des commandes ou des pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-lg"
              autoFocus
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-muted text-xs text-muted-foreground rounded">
              Ctrl+K
            </kbd>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {Object.entries(groupedActions).map(([groupName, actions]) => (
            <div key={groupName} className="p-2">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {groupName}
              </div>
              <div className="space-y-1">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionSelect(action)}
                    className="w-full flex items-center gap-3 px-2 py-2 text-left text-sm rounded hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {action.icon && (
                        <div className="p-1.5 bg-muted rounded-md">
                          {action.icon}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium">{action.title}</span>
                        {action.shortcut && (
                          <span className="text-xs text-muted-foreground">
                            {action.shortcut}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filteredActions.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <p>Aucune commande trouvée</p>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>Total: {filteredActions.length} commandes</span>
          <div className="flex gap-2">
            <kbd className="px-2 py-1 bg-muted rounded">↑↓</kbd>
            <span>Navigation</span>
            <kbd className="px-2 py-1 bg-muted rounded">⏎</kbd>
            <span>Sélectionner</span>
            <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd>
            <span>Fermer</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
