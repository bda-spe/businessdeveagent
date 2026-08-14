import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
} from "@tanstack/react-query";
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";

import LandingPage from "./pages/landing";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import ForgotPasswordPage from "./pages/forgot-password";
import ResetPasswordPage from "./pages/reset-password";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";
import OnboardingPage from "./pages/onboarding";
import AppShell from "./components/app-shell";
import DashboardPage from "./pages/dashboard";
import BusinessPage from "./pages/business";
import ServicesPage from "./pages/services";
import PricingPage from "./pages/pricing";
import InvoiceFormattingPage from "./pages/invoice-formatting";
import AgentSettingsPage from "./pages/agent-settings";
import LeadsPage from "./pages/leads";
import BillingPage from "./pages/billing";
import TrialLockGate from "./components/trial-lock-gate";

// Any successful mutation may unlock the next setup step in the sidebar, so
// refresh the account (which carries setupProgress) after every mutation.
// This also covers login/signup/logout — /api/me is always refetched right
// after the session changes.
const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  }),
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function FullPageSpinner() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <Spinner className="h-6 w-6 text-slate-400" />
    </div>
  );
}

/** /api/me 401s when signed out — that's an expected, not-logged-in state,
 * not a transient failure, so it's never worth retrying. */
function useSession() {
  const { data, isLoading } = useGetMe({
    query: { retry: false, queryKey: getGetMeQueryKey() },
  });
  return { me: data, isLoading, signedIn: !!data };
}

function HomeRedirect() {
  const { isLoading, signedIn } = useSession();
  if (isLoading) return <FullPageSpinner />;
  return signedIn ? <Redirect to="/dashboard" /> : <LandingPage />;
}

function OnboardingGate() {
  const { isLoading, signedIn } = useSession();
  if (isLoading) return <FullPageSpinner />;
  return signedIn ? <OnboardingPage /> : <Redirect to="/sign-in" />;
}

function ProtectedApp({ children }: { children: React.ReactNode }) {
  const { isLoading, signedIn } = useSession();
  if (isLoading) return <FullPageSpinner />;
  if (!signedIn) return <Redirect to="/sign-in" />;
  return <AppShell>{children}</AppShell>;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/landing" component={LandingPage} />
            <Route path="/sign-in" component={SignInPage} />
            <Route path="/sign-up" component={SignUpPage} />
            <Route path="/forgot-password" component={ForgotPasswordPage} />
            <Route path="/reset-password" component={ResetPasswordPage} />
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/terms" component={TermsPage} />

            <Route path="/onboarding" component={OnboardingGate} />

            <Route path="/dashboard"><ProtectedApp><TrialLockGate><DashboardPage /></TrialLockGate></ProtectedApp></Route>
            <Route path="/business"><ProtectedApp><TrialLockGate><BusinessPage /></TrialLockGate></ProtectedApp></Route>
            <Route path="/services"><ProtectedApp><TrialLockGate><ServicesPage /></TrialLockGate></ProtectedApp></Route>
            <Route path="/pricing"><ProtectedApp><TrialLockGate><PricingPage /></TrialLockGate></ProtectedApp></Route>
            <Route path="/invoice-formatting"><ProtectedApp><TrialLockGate><InvoiceFormattingPage /></TrialLockGate></ProtectedApp></Route>
            <Route path="/agent-settings"><ProtectedApp><TrialLockGate><AgentSettingsPage /></TrialLockGate></ProtectedApp></Route>
            <Route path="/training"><Redirect to="/agent-settings" /></Route>
            <Route path="/widget"><Redirect to="/agent-settings" /></Route>
            <Route path="/leads"><ProtectedApp><TrialLockGate><LeadsPage /></TrialLockGate></ProtectedApp></Route>
            <Route path="/billing"><ProtectedApp><BillingPage /></ProtectedApp></Route>

            <Route>
              <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-slate-900">404 - Not Found</h1>
                  <p className="mt-2 text-slate-600">The page you're looking for doesn't exist.</p>
                </div>
              </div>
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
