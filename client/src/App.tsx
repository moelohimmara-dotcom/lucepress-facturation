import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";

const Home = lazy(() => import("./pages/Home"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const DocumentEditorPage = lazy(() => import("./pages/DocumentEditorPage"));
const DocumentEditRoute = lazy(() => import("./pages/DocumentEditRoute"));
const DocumentPreviewPage = lazy(() => import("./pages/DocumentPreviewPage"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const AgentDelegationsPage = lazy(() => import("./pages/AgentDelegationsPage"));
const AgentCampaignSchedulerPage = lazy(() => import("./pages/AgentCampaignSchedulerPage"));
const AgentAuditPage = lazy(() => import("./pages/AgentAuditPage"));
const AgentTestEmailPage = lazy(() => import("./pages/AgentTestEmailPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const ClientPortalPage = lazy(() => import("./pages/ClientPortalPage"));
const ProjectCostsPage = lazy(() => import("./pages/ProjectCostsPage"));
const ReceivablesPage = lazy(() => import("./pages/ReceivablesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const EmailTemplatesPage = lazy(() => import("./pages/EmailTemplatesPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const InvitationAcceptPage = lazy(() => import("./pages/InvitationAcceptPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));

const LazyFallback = () => <DashboardLayoutSkeleton />;

function Router() {
  return (
    <Suspense fallback={<LazyFallback />}>
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
        <Route path="/calendrier" component={CalendarPage} />
        <Route path="/couts-chantier" component={ProjectCostsPage} />
        <Route path="/creances" component={ReceivablesPage} />
        <Route path="/portail-client" component={ClientPortalPage} />
        <Route path={"/parametres"} component={SettingsPage} />
        <Route path={"/parametres/e-mails"} component={EmailTemplatesPage} />
        <Route path={"/compte/mot-de-passe"} component={ChangePasswordPage} />
        <Route path={"/parametres/utilisateurs"} component={UsersPage} />
        <Route path={"/invitation"} component={InvitationAcceptPage} />
        <Route path={"/forgot-password"} component={ForgotPasswordPage} />
        <Route path={"/reset-password"} component={ResetPasswordPage} />
        <Route path={"/relances"} component={RemindersPage} />
        <Route path={"/login"} component={LoginPage} />
        <Route path={"/documents/:id/edit"} component={DocumentEditRoute} />
        <Route path={"/documents/:id"} component={DocumentPreviewPage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
        switchable
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
