import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LabShell } from "@/lab/LabShell";
import { ComponentPage } from "@/lab/ComponentPage";
import { RecordingProvider } from "@/lab/recording";
import { getComponent, labComponents } from "@/lab/registry";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";

function ComponentRoute({ slug }: { slug: string }) {
  const component = getComponent(slug);
  if (!component) return <NotFound />;
  return <ComponentPage component={component} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      {labComponents.flatMap(c =>
        [c.slug, ...(c.aliases ?? [])].map(path => (
          <Route key={path} path={`/${path}`}>
            <ComponentRoute slug={path} />
          </Route>
        ))
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <RecordingProvider>
            <LabShell>
              <Router />
            </LabShell>
          </RecordingProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
