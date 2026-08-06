import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LabShell } from "@/lab/LabShell";
import { Showcase } from "@/lab/Showcase";
import { RecordingProvider } from "@/lab/recording";
import { getComponent, labComponents } from "@/lab/registry";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";

// Component pages carry their own chrome (the showcase's framed lab
// bench); LabShell wraps only the landing page and 404.
function ComponentRoute({ slug }: { slug: string }) {
  const component = getComponent(slug);
  if (!component)
    return (
      <LabShell>
        <NotFound />
      </LabShell>
    );
  return <Showcase component={component} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <LabShell>
          <Home />
        </LabShell>
      </Route>
      {labComponents.flatMap(c =>
        [c.slug, ...(c.aliases ?? [])].map(path => (
          <Route key={path} path={`/${path}`}>
            <ComponentRoute slug={path} />
          </Route>
        ))
      )}
      <Route>
        <LabShell>
          <NotFound />
        </LabShell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <RecordingProvider>
            <Router />
          </RecordingProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
