import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { MessagingProvider } from "@/contexts/MessagingContext";
import { PortalProvider } from "@/context/PortalContext";
import { RoleSelectorModal } from "@/components/RoleSelectorModal";
import BottomNav from "@/components/BottomNav";
import ProBottomNav from "@/components/ProBottomNav";
import ProHeader from "@/components/ProHeader";
import ClientHeader from "@/components/ClientHeader";
import PageLoader from "@/components/PageLoader";
import { Loader2 } from "lucide-react";
import { Component, ErrorInfo, ReactNode, lazy, Suspense, useEffect } from "react";
import { apiRequest } from "./lib/queryClient";

// Eager imports - needed immediately for login flow
import LoginPage from "@/pages/LoginPage";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";
import ProLoginPage from "@/pages/pro/ProLoginPage";

// Lazy imports - Client pages (loaded after login)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const TrainerStorefront = lazy(() => import("@/pages/TrainerStorefront"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Train = lazy(() => import("@/pages/Train"));
const WeighIn = lazy(() => import("@/pages/WeighIn"));
const Settings = lazy(() => import("@/pages/Settings"));
const CheckInForm = lazy(() => import("@/pages/CheckInForm"));
const Messages = lazy(() => import("@/pages/Messages"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const SubscriptionSuccess = lazy(() => import("@/pages/SubscriptionSuccess"));
const SubscriptionCancel = lazy(() => import("@/pages/SubscriptionCancel"));
const MessagingPreferences = lazy(() => import("@/pages/MessagingPreferences"));

// Lazy imports - Admin pages (v2 layout with 4 sections)
const AdminLoginPage = lazy(() => import("@/pages/admin-v2/AdminLoginPage"));
const AdminBusinessPage = lazy(() => import("@/pages/admin-v2/AdminBusinessPage"));
const AdminUsersPage = lazy(() => import("@/pages/admin-v2/AdminUsersPage"));
const AdminCatalogPage = lazy(() => import("@/pages/admin-v2/AdminCatalogPage"));
const AdminSystemPage = lazy(() => import("@/pages/admin-v2/AdminSystemPage"));


// Lazy imports - Pro pages (loaded only for professionals)
const ProDashboard = lazy(() => import("@/pages/pro/ProDashboard"));
const ProProducts = lazy(() => import("@/pages/pro/ProProducts"));
const ProProfileSetup = lazy(() => import("@/pages/pro/ProProfileSetup"));
const ProInvite = lazy(() => import("@/pages/pro/ProInvite"));
const ProClientView = lazy(() => import("@/pages/pro/ProClientView"));
const ProAcceptInvite = lazy(() => import("@/pages/pro/ProAcceptInvite"));
const ProProgrammeNew = lazy(() => import("@/pages/pro/ProProgrammeNew"));
const ProProgrammeEdit = lazy(() => import("@/pages/pro/ProProgrammeEdit"));
const ProCheckInTemplateEdit = lazy(() => import("@/pages/pro/ProCheckInTemplateEdit"));
const ProCheckInTemplates = lazy(() => import("@/pages/pro/ProCheckInTemplates"));
const ProCheckInSubmissionView = lazy(() => import("@/pages/pro/ProCheckInSubmissionView"));
const ProStorefront = lazy(() => import("@/pages/pro/ProStorefront"));
const StorefrontPreview = lazy(() => import("@/pages/pro/StorefrontPreview"));

// Public pages (no auth required)
const PublicStorefront = lazy(() => import("@/pages/public/PublicStorefront"));
const MarketplaceDemo = lazy(() => import("@/pages/public/MarketplaceDemo"));
const TrainerProfileDemo = lazy(() => import("@/pages/public/TrainerProfileDemo"));
const StorefrontTemplates = lazy(() => import("@/pages/public/StorefrontTemplates"));
const ProfessionalDetail = lazy(() => import("@/pages/ProfessionalDetail"));
const ClientRequestConnection = lazy(() => import("@/pages/ClientRequestConnection"));

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full bg-card border rounded-lg p-6 space-y-4">
            <h1 className="text-xl font-bold text-destructive">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              The app encountered an error. Please try refreshing the page.
            </p>
            <div className="bg-muted p-3 rounded text-xs font-mono overflow-auto max-h-40">
              {this.state.error?.message || "Unknown error"}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/log" component={Analytics} />
        <Route path="/train" component={Train} />
        <Route path="/messages/preferences" component={MessagingPreferences} />
        <Route path="/messages/:id" component={Messages} />
        <Route path="/messages" component={Messages} />
        <Route path="/check-in/:id" component={CheckInForm} />
        <Route path="/weigh-in" component={WeighIn} />
        <Route path="/settings" component={Settings} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/marketplace/pro/:id" component={ProfessionalDetail} />
        <Route path="/marketplace/request/:id" component={ClientRequestConnection} />
        <Route path="/trainer/:slug" component={TrainerStorefront} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/subscription/success" component={SubscriptionSuccess} />
        <Route path="/subscription/cancel" component={SubscriptionCancel} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AuthenticatedApp() {
  const { user, profile, isLoading } = useSupabaseAuth();

  // Prefetch client permissions/connections data for faster navigation
  useEffect(() => {
    if (user && profile) {
      queryClient.prefetchQuery({
        queryKey: ['/api/client/permissions'],
        queryFn: async () => {
          const res = await apiRequest('GET', '/api/client/permissions');
          return res.json();
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
      });
    }
  }, [user, profile]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <ClientHeader />
      <main className="flex-1">
        <Router />
      </main>
      <BottomNav />
    </div>
  );
}

function ProLoginRedirect() {
  const [location] = useLocation();
  // Guard against redirect loops - only redirect if not already at /pro
  if (location === "/pro") {
    return null;
  }
  return <Redirect to="/pro" />;
}

function ProRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/pro" component={ProDashboard} />
        <Route path="/pro/login" component={ProLoginRedirect} />
        <Route path="/pro/invite" component={ProInvite} />
        <Route path="/pro/profile" component={ProProfileSetup} />
        <Route path="/pro/messages/preferences" component={MessagingPreferences} />
        <Route path="/pro/messages/:id" component={Messages} />
        <Route path="/pro/messages" component={Messages} />
        <Route path="/pro/client/:clientId" component={ProClientView} />
        <Route path="/pro/programmes/new" component={ProProgrammeNew} />
        <Route path="/pro/programmes/:id" component={ProProgrammeEdit} />
        <Route path="/pro/programmes/:id/edit" component={ProProgrammeEdit} />
        <Route path="/pro/check-ins/templates" component={ProCheckInTemplates} />
        <Route path="/pro/check-ins/templates/new" component={ProCheckInTemplateEdit} />
        <Route path="/pro/check-ins/templates/:id" component={ProCheckInTemplateEdit} />
        <Route path="/pro/check-ins/submissions/:id" component={ProCheckInSubmissionView} />
        <Route path="/pro/products" component={ProProducts} />
        <Route path="/pro/storefront" component={ProStorefront} />
        <Route path="/pro/storefront-preview" component={StorefrontPreview} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function ProAccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Professional Access Only</h1>
        <p className="text-muted-foreground mb-4">
          This area is for fitness professionals. If you're a client, please use the main app to track your health.
        </p>
        <p className="text-sm text-muted-foreground">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}

function ProApp() {
  const { user, isLoading, profile, professionalProfile, isProfessionalCandidate } = useSupabaseAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <ProLoginPage />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isProfessionalCandidate) {
    return (
      <div className="min-h-screen flex flex-col">
        <ProHeader />
        <main className="flex-1">
          <Suspense fallback={<PageLoader />}>
            <ProProfileSetup />
          </Suspense>
        </main>
      </div>
    );
  }

  if (profile.role !== "professional") {
    return <ProAccessDenied />;
  }

  if (!professionalProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <ProHeader />
        <main className="flex-1">
          <Suspense fallback={<PageLoader />}>
            <ProProfileSetup />
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <ProHeader />
      <main className="flex-1">
        <ProRouter />
      </main>
      <ProBottomNav />
    </div>
  );
}

function AppContent() {
  const [location] = useLocation();
  
  // Public storefront routes (no auth required) - only /s/:slug paths
  if (location.startsWith("/s/")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/s/demo/:template" component={StorefrontTemplates} />
          <Route path="/s/demo">
            <Redirect to="/" />
          </Route>
          <Route path="/s/:slug" component={PublicStorefront} />
        </Switch>
      </Suspense>
    );
  }
  
  // Marketplace demo routes (no auth required)
  if (location === "/marketplace/demo" || location.startsWith("/marketplace/trainer/")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/marketplace/demo" component={MarketplaceDemo} />
          <Route path="/marketplace/trainer/:id" component={TrainerProfileDemo} />
        </Switch>
      </Suspense>
    );
  }
  
  // Admin routes - now using v2 layout (4 sections with lazy loading)
  if (location.startsWith("/admin")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Backward compatibility redirects from old /admin-v2/* paths */}
          <Route path="/admin-v2/business/:rest*">
            {(params: { "rest*"?: string }) => <Redirect to={`/admin/business/${params["rest*"] || ''}`} />}
          </Route>
          <Route path="/admin-v2/users/:rest*">
            {(params: { "rest*"?: string }) => <Redirect to={`/admin/users/${params["rest*"] || ''}`} />}
          </Route>
          <Route path="/admin-v2/catalog/:rest*">
            {(params: { "rest*"?: string }) => <Redirect to={`/admin/catalog/${params["rest*"] || ''}`} />}
          </Route>
          <Route path="/admin-v2/system/:rest*">
            {(params: { "rest*"?: string }) => <Redirect to={`/admin/system/${params["rest*"] || ''}`} />}
          </Route>
          <Route path="/admin-v2">
            <Redirect to="/admin/business/stats" />
          </Route>
          
          {/* Admin login route */}
          <Route path="/admin/login" component={AdminLoginPage} />
          
          {/* Main admin routes */}
          <Route path="/admin/business/:rest*" component={AdminBusinessPage} />
          <Route path="/admin/users/:rest*" component={AdminUsersPage} />
          <Route path="/admin/catalog/:rest*" component={AdminCatalogPage} />
          <Route path="/admin/system/:rest*" component={AdminSystemPage} />
          <Route path="/admin">
            <Redirect to="/admin/login" />
          </Route>
        </Switch>
      </Suspense>
    );
  }
  
  if (location.startsWith("/reset-password")) {
    return <ResetPassword />;
  }
  
  if (location.startsWith("/pro/accept")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ProAcceptInvite />
      </Suspense>
    );
  }
  
  if (location.startsWith("/pro")) {
    return <ProApp />;
  }
  
  return <AuthenticatedApp />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SupabaseAuthProvider>
          <PortalProvider>
            <MessagingProvider>
              <TooltipProvider>
                <AppContent />
                <RoleSelectorModal />
                <Toaster />
              </TooltipProvider>
            </MessagingProvider>
          </PortalProvider>
        </SupabaseAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
