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
import Home from "./pages/Home";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/devis"} component={() => <DocumentsPage kind="devis" />} />
      <Route path={"/factures"} component={() => <DocumentsPage kind="facture" />} />
      <Route path={"/devis/nouveau"} component={() => <DocumentEditorPage kind="devis" mode="create" />} />
      <Route path={"/factures/nouveau"} component={() => <DocumentEditorPage kind="facture" mode="create" />} />
      <Route path={"/clients"} component={() => <CatalogPage kind="clients" />} />
      <Route path={"/chantiers"} component={() => <CatalogPage kind="chantiers" />} />
      <Route path={"/prestations"} component={() => <CatalogPage kind="prestations" />} />
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
