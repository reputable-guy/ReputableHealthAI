import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Input from "@/pages/input";
import LiteratureReview from "@/pages/literature-review";
import ProtocolDesigner from "@/pages/protocol-designer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/input" component={Input} />
      <Route path="/literature-review" component={LiteratureReview} />
      <Route path="/design" component={ProtocolDesigner} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;