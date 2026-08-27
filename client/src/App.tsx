import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DocumentEditorPage from "./pages/DocumentEditorPage";
import DocumentEditRoute from "./pages/DocumentEditRoute";
import DocumentPreviewPage from "./pages/DocumentPreviewPage";
import DocumentsPage from "./pages/DocumentsPage";
import CatalogPage from "./pages/CatalogPage";
import AgentDelegationsPage from "./pages/AgentDelegationsPage";
import AgentCampaignSchedulerPage from "./pages/AgentCampaignSchedulerPage";
import AgentAuditPage from "./pages/AgentAuditPage";
import AgentTestEmailPage from "./pages/AgentTestEmailPage";
import Home from "./pages/Home";
import IntegrationsPage from "./pages/IntegrationsPage";
import ClientPortalPage from "./pages/ClientPortalPage";
import ProjectCostsPage from "./pages/ProjectCostsPage";
import ReceivablesPage from "./pages/ReceivablesPage";
import SettingsPage from "./pages/SettingsPage";
import RemindersPage from "./pages/RemindersPage";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tableau-de-bord" component={Home} />
      <Route path={"/devis"} component={() => <DocumentsPage kind="devis" />} />
      <Route path={"/factures"} component={() => <DocumentsPage kind="facture" />} />
      <Route path={"/devis/nouveau"} component={() => <DocumentEditorPage kind="devis" mode="create" />} />
      <Route path={"/factures/nouveau"} component={() => <DocumentEditorPage kind="facture" mode="create" />} />
      <Route path={"/clients"} component={() => <CatalogPage kind="clients" />} />
      <Route path={"/chantiers"} component={() => <CatalogPage kind="chantiers" />} />
      <Route path={"/prestations"} component={() => <CatalogPage kind="prestations" />} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/agent-ia" component={AgentDelegationsPage} />
      <Route path="/agent-ia/planification" component={AgentCampaignSchedulerPage} />
      <Route path="/agent-ia/audit" component={AgentAuditPage} />
      <Route path="/agent-ia/e-mails-test" component={AgentTestEmailPage} />
      <Route path="/couts-chantier" component={ProjectCostsPage} />
      <Route path="/creances" component={ReceivablesPage} />
      <Route path="/portail-client" component={ClientPortalPage} />
      <Route path={"/parametres"} component={SettingsPage} />
      <Route path={"/relances"} component={RemindersPage} />
      <Route path={"/documents/:id/edit"} component={DocumentEditRoute} />
      <Route path={"/documents/:id"} component={DocumentPreviewPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
