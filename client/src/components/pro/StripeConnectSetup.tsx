import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  RefreshCw,
  Building2,
  ShieldCheck
} from "lucide-react";

interface ConnectAccountStatus {
  hasAccount: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  onboardingComplete?: boolean;
  requirementsDisabledReason?: string | null;
  requirementsCurrentDeadline?: string | null;
  defaultCurrency?: string;
  error?: string;
}

export default function StripeConnectSetup() {
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data: accountStatus, isLoading, refetch } = useQuery({
    queryKey: ["/api/stripe/connect/status"],
    queryFn: async (): Promise<ConnectAccountStatus> => {
      const response = await fetch("/api/stripe/connect/status", {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to load status" }));
        if (response.status === 403) {
          setStatusError(errorData.error || "You don't have permission to access payment features");
          return { hasAccount: false, error: errorData.error };
        }
        setStatusError(errorData.error || "Failed to load payment status");
        return { hasAccount: false, error: errorData.error };
      }
      setStatusError(null);
      return response.json();
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/stripe/connect/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create account");
      }
      return response.json();
    },
    onSuccess: async () => {
      setIsRedirecting(true);
      const currentUrl = window.location.href;
      const linkResponse = await fetch("/api/stripe/connect/onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          refreshUrl: currentUrl,
          returnUrl: currentUrl,
          type: "account_onboarding",
        }),
      });
      
      if (!linkResponse.ok) {
        setIsRedirecting(false);
        const errorData = await linkResponse.json().catch(() => ({}));
        toast({
          title: "Error",
          description: errorData.error || "Failed to create onboarding link",
          variant: "destructive",
        });
        return;
      }
      
      const { url } = await linkResponse.json();
      window.location.href = url;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  const startOnboardingMutation = useMutation({
    mutationFn: async () => {
      const currentUrl = window.location.href;
      const response = await fetch("/api/stripe/connect/onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          refreshUrl: currentUrl,
          returnUrl: currentUrl,
          type: "account_onboarding",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create onboarding link");
      }
      return response.json();
    },
    onSuccess: ({ url }) => {
      setIsRedirecting(true);
      window.location.href = url;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start onboarding",
        variant: "destructive",
      });
    },
  });

  const openDashboardMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/stripe/connect/dashboard-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get dashboard link");
      }
      return response.json();
    },
    onSuccess: ({ url }) => {
      setIsRedirecting(true);
      window.open(url, "_blank");
      setIsRedirecting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open Stripe dashboard",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = () => {
    if (!accountStatus?.hasAccount) {
      return <Badge variant="secondary" data-testid="badge-connect-status">Not Set Up</Badge>;
    }
    
    if (accountStatus.onboardingComplete) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20" data-testid="badge-connect-status">Active</Badge>;
    }
    
    if (accountStatus.requirementsDisabledReason) {
      return <Badge variant="destructive" data-testid="badge-connect-status">Restricted</Badge>;
    }
    
    return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20" data-testid="badge-connect-status">Pending</Badge>;
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (statusError) {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {statusError}
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => refetch()}
            data-testid="button-retry-status"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      );
    }

    if (!accountStatus?.hasAccount) {
      return (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-muted-foreground">
              Set up payments to sell products and services through the LOBA marketplace.
            </p>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Accept credit cards and other payment methods</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Get paid directly to your bank account</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Secure payments powered by Stripe</span>
            </div>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => createAccountMutation.mutate()}
            disabled={createAccountMutation.isPending || isRedirecting}
            data-testid="button-setup-payments"
          >
            {(createAccountMutation.isPending || isRedirecting) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Set Up Payments
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You'll be redirected to Stripe to complete your account setup
          </p>
        </div>
      );
    }

    if (!accountStatus.onboardingComplete) {
      return (
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Complete your account setup to start accepting payments.
              {accountStatus.requirementsCurrentDeadline && (
                <span className="block mt-1 text-xs">
                  Deadline: {new Date(accountStatus.requirementsCurrentDeadline).toLocaleDateString()}
                </span>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {accountStatus.detailsSubmitted ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              )}
              <span>Business details submitted</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {accountStatus.chargesEnabled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              )}
              <span>Payments enabled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {accountStatus.payoutsEnabled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              )}
              <span>Payouts enabled</span>
            </div>
          </div>

          <Button 
            className="w-full"
            onClick={() => startOnboardingMutation.mutate()}
            disabled={startOnboardingMutation.isPending || isRedirecting}
            data-testid="button-continue-setup"
          >
            {(startOnboardingMutation.isPending || isRedirecting) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                Continue Setup
                <ExternalLink className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <ShieldCheck className="h-8 w-8 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-700">Payments Active</p>
            <p className="text-sm text-green-600/80">
              Your account is set up and ready to accept payments
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Account ID</span>
            <span className="font-mono text-xs">{accountStatus.accountId?.slice(0, 20)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Currency</span>
            <span className="uppercase">{accountStatus.defaultCurrency || "USD"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payments</span>
            <span className="text-green-600">Enabled</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payouts</span>
            <span className="text-green-600">Enabled</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => openDashboardMutation.mutate()}
          disabled={openDashboardMutation.isPending || isRedirecting}
          data-testid="button-manage-account"
        >
          {(openDashboardMutation.isPending || isRedirecting) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening Dashboard...
            </>
          ) : (
            <>
              Manage Stripe Account
              <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Payment Setup</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {accountStatus?.hasAccount && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="button-refresh-status"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Accept payments for your products and services
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
